import { NextResponse } from 'next/server';
import { getAnalyticsSnapshot } from '../../analytics/store';
import { verifyAdminRequest } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await getAnalyticsSnapshot(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Admin analytics failed:', error);
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500 });
  }
}
