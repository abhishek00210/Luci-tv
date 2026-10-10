import { NextResponse } from 'next/server';
import {
  adminCookieName,
  adminIsConfigured,
  createAdminSession,
  credentialsAreValid,
  verifyAdminRequest,
} from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attempts = new Map();
const attemptWindowMs = 15 * 60 * 1000;

function clientKey(request) {
  return request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < attemptWindowMs);
  attempts.set(key, recent);
  return recent.length >= 5;
}

export async function GET(request) {
  if (!adminIsConfigured()) return NextResponse.json({ error: 'Admin access is not configured.' }, { status: 503 });
  const session = verifyAdminRequest(request);
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username || null }, { status: session ? 200 : 401 });
}

export async function POST(request) {
  if (!adminIsConfigured()) return NextResponse.json({ error: 'Admin access is not configured.' }, { status: 503 });
  const key = clientKey(request);
  if (isRateLimited(key)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!credentialsAreValid(username, password)) {
    attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
    return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 });
  }

  attempts.delete(key);
  const response = NextResponse.json({ authenticated: true, username });
  response.cookies.set(adminCookieName, createAdminSession(username), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
