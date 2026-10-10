import { createHmac, timingSafeEqual } from 'node:crypto';

export const adminCookieName = 'luci_admin';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.MEDIA_PROXY_SECRET || '';
}

function sign(value) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function adminIsConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && sessionSecret());
}

export function credentialsAreValid(username, password) {
  if (!adminIsConfigured()) return false;
  return safeEqual(username, process.env.ADMIN_USERNAME) && safeEqual(password, process.env.ADMIN_PASSWORD);
}

export function createAdminSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function verifyAdminRequest(request) {
  if (!adminIsConfigured()) return null;
  const token = readCookie(request, adminCookieName);
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.expiresAt <= Date.now() || session.username !== process.env.ADMIN_USERNAME) return null;
    return session;
  } catch {
    return null;
  }
}
