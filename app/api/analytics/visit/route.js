import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { getVisitor, recordVisit } from '../store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeText(value, length = 160) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function readCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function getClientIp(request) {
  const candidate = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || '';
  const normalized = candidate.trim().replace(/^::ffff:/, '');
  return isIP(normalized) ? normalized : '';
}

function isPublicIp(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return false;
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(ip)) return false;
  const secondOctet = Number(ip.split('.')[1]);
  return !(ip.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31);
}

function detectClient(userAgent) {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('firefox/') ? 'Firefox'
      : ua.includes('chrome/') ? 'Chrome'
        : ua.includes('safari/') ? 'Safari' : 'Other';
  const os = ua.includes('android') ? 'Android'
    : /iphone|ipad|ipod/.test(ua) ? 'iOS'
      : ua.includes('windows') ? 'Windows'
        : ua.includes('mac os') ? 'macOS'
          : ua.includes('linux') ? 'Linux' : 'Other';
  const device = ua.includes('ipad') || ua.includes('tablet') ? 'Tablet'
    : /mobile|iphone|android/.test(ua) ? 'Mobile' : 'Desktop';
  return { browser, os, device };
}

async function lookupLocation(ip) {
  if (!isPublicIp(ip)) return {};
  try {
    const fields = 'success,country,country_code,region,city,timezone,connection';
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=${fields}`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok || data.success === false) return {};
    return {
      city: safeText(data.city, 80),
      region: safeText(data.region, 80),
      country: safeText(data.country, 80),
      countryCode: safeText(data.country_code, 8),
      timezone: safeText(data.timezone?.id, 80),
      isp: safeText(data.connection?.isp, 120),
    };
  } catch {
    return {};
  }
}

export async function POST(request) {
  try {
    const requestBody = await request.json();
    const body = requestBody && typeof requestBody === 'object' ? requestBody : {};
    const visitorId = readCookie(request, 'luci_vid') || randomUUID();
    const ip = getClientIp(request);
    const existing = await getVisitor(visitorId);
    const location = existing?.country && existing.ip === ip ? {} : await lookupLocation(ip);
    const userAgent = safeText(request.headers.get('user-agent'), 500);
    const width = Number(body.screen?.width);
    const height = Number(body.screen?.height);

    await recordVisit({
      visitorId,
      username: safeText(body.username, 80).toLowerCase(),
      ip,
      location,
      timezone: safeText(body.timezone, 80),
      language: safeText(body.language, 32),
      path: safeText(body.path, 180) || '/',
      screen: Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null,
      userAgent,
      client: detectClient(userAgent),
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('luci_vid', visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error('Analytics visit failed:', error);
    return NextResponse.json({ error: 'Unable to record visit.' }, { status: 500 });
  }
}
