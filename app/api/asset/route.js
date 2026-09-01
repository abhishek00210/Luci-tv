export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POPCORN_ORIGIN = 'https://my-popcorn.vercel.app';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

async function loginToPopcorn() {
  const username = process.env.POPCORN_USERNAME;
  const password = process.env.POPCORN_PASSWORD;

  if (!username || !password) return null;

  const response = await fetch(`${POPCORN_ORIGIN}/api/auth`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) return null;
  return response.headers.get('set-cookie')?.split(';')[0] || null;
}

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);
    const key = requestUrl.searchParams.get('key');

    if (!key) {
      return json({ error: 'Missing asset key' }, 400);
    }

    const cookie = await loginToPopcorn();
    if (!cookie) {
      return json({
        error: 'Asset unavailable',
        message: 'POPCORN_USERNAME and POPCORN_PASSWORD are required to load fallback posters.',
      }, 502);
    }

    const assetUrl = new URL('/api/asset', POPCORN_ORIGIN);
    assetUrl.searchParams.set('key', key);

    const response = await fetch(assetUrl, {
      cache: 'force-cache',
      headers: {
        Cookie: cookie,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok || !response.body) {
      return json({ error: 'Asset fetch failed', message: `Popcorn asset request failed: ${response.status}` }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return json({ error: 'Asset proxy failed', message: error.message || 'Unable to load poster.' }, 502);
  }
}
