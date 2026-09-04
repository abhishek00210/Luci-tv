import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

function getSigningSecret() {
  return process.env.MEDIA_PROXY_SECRET
    || process.env.POPCORN_ASSET_SECRET
    || process.env.POPCORN_PASSWORD
    || '';
}

export function createMediaToken(url, expires) {
  const secret = getSigningSecret();
  if (!secret || !url || !expires) return '';
  return createHmac('sha256', secret).update(`${url}\n${expires}`).digest('base64url');
}

export function verifyMediaToken(url, token, expires) {
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = createMediaToken(url, expires);
  if (!expected || !token) return false;

  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function createMediaProxyPath(url) {
  const expires = String(Date.now() + TOKEN_TTL_MS);
  const token = createMediaToken(url, expires);
  if (!token) return '';
  const params = new URLSearchParams({ url, expires, token });
  return `/api/media?${params.toString()}`;
}
