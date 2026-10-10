import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dataFile = process.env.ANALYTICS_DATA_FILE || path.join(process.cwd(), '.data', 'analytics.json');
const retentionMs = 90 * 24 * 60 * 60 * 1000;
const sessionGapMs = 30 * 60 * 1000;
let mutationQueue = Promise.resolve();

function emptyDatabase() {
  return { visitors: {}, events: [] };
}

function cleanDatabase(value) {
  return {
    visitors: value?.visitors && typeof value.visitors === 'object' ? value.visitors : {},
    events: Array.isArray(value?.events) ? value.events : [],
  };
}

async function readDatabase() {
  try {
    return cleanDatabase(JSON.parse(await readFile(dataFile, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDatabase();
    throw error;
  }
}

async function writeDatabase(database) {
  await mkdir(path.dirname(dataFile), { recursive: true, mode: 0o750 });
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(database), { mode: 0o600 });
  await rename(temporaryFile, dataFile);
}

function mutateDatabase(callback) {
  const operation = mutationQueue.then(async () => {
    const database = await readDatabase();
    const result = await callback(database);
    await writeDatabase(database);
    return result;
  });
  mutationQueue = operation.catch(() => {});
  return operation;
}

export async function getVisitor(visitorId) {
  const database = await readDatabase();
  return database.visitors[visitorId] || null;
}

export async function recordVisit(input) {
  return mutateDatabase((database) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const existing = database.visitors[input.visitorId];
    const startsSession = !existing || now.getTime() - new Date(existing.lastSeen).getTime() > sessionGapMs;
    const location = input.location || {};
    const currentIp = {
      ip: input.ip,
      city: location.city || '',
      region: location.region || '',
      country: location.country || '',
      countryCode: location.countryCode || '',
      lastSeen: nowIso,
    };
    const ipHistory = Array.isArray(existing?.ipHistory) ? [...existing.ipHistory] : [];
    const knownIp = ipHistory.find((entry) => entry.ip === input.ip);

    if (knownIp) Object.assign(knownIp, currentIp);
    else if (input.ip) ipHistory.unshift(currentIp);

    const visitor = {
      id: input.visitorId,
      username: input.username || existing?.username || '',
      ip: input.ip || existing?.ip || '',
      city: location.city || existing?.city || '',
      region: location.region || existing?.region || '',
      country: location.country || existing?.country || '',
      countryCode: location.countryCode || existing?.countryCode || '',
      timezone: input.timezone || location.timezone || existing?.timezone || '',
      isp: location.isp || existing?.isp || '',
      language: input.language || existing?.language || '',
      browser: input.client.browser,
      os: input.client.os,
      device: input.client.device,
      screen: input.screen || existing?.screen || null,
      userAgent: input.userAgent,
      firstSeen: existing?.firstSeen || nowIso,
      lastSeen: nowIso,
      visits: (existing?.visits || 0) + (startsSession ? 1 : 0),
      lastPath: input.path || existing?.lastPath || '/',
      ipHistory: ipHistory.slice(0, 8),
    };

    database.visitors[input.visitorId] = visitor;

    if (startsSession) {
      database.events.unshift({
        id: randomUUID(),
        visitorId: input.visitorId,
        username: visitor.username,
        type: 'visit',
        path: visitor.lastPath,
        at: nowIso,
      });
    }

    const cutoff = now.getTime() - retentionMs;
    database.events = database.events
      .filter((event) => new Date(event.at).getTime() >= cutoff)
      .slice(0, 10000);

    const visitorEntries = Object.entries(database.visitors);
    if (visitorEntries.length > 5000) {
      visitorEntries
        .sort(([, a], [, b]) => new Date(b.lastSeen) - new Date(a.lastSeen))
        .slice(5000)
        .forEach(([id]) => delete database.visitors[id]);
    }

    return visitor;
  });
}

export async function getAnalyticsSnapshot() {
  const database = await readDatabase();
  const allVisitors = Object.values(database.visitors)
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  const now = Date.now();
  const active24h = allVisitors.filter((visitor) => now - new Date(visitor.lastSeen).getTime() <= 24 * 60 * 60 * 1000).length;
  const observedUsers = new Set(allVisitors.map((visitor) => visitor.username).filter(Boolean)).size;
  const countries = new Set(allVisitors.map((visitor) => visitor.countryCode || visitor.country).filter(Boolean)).size;

  return {
    generatedAt: new Date().toISOString(),
    stats: { totalVisitors: allVisitors.length, observedUsers, active24h, countries },
    visitors: allVisitors.slice(0, 1000),
    recentActivity: database.events.slice(0, 100),
  };
}
