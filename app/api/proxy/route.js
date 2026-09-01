export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HICINE_ORIGIN = process.env.PRODUCTION_API_URL || 'https://api.hicine.info';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const HICINE_UNAVAILABLE_MESSAGE = 'Hicine API is unavailable right now. api.hicine.info is closing requests or returning an expired-domain page.';
const POPCORN_ORIGIN = 'https://my-popcorn.vercel.app';
const POPCORN_SECRET = process.env.POPCORN_ASSET_SECRET || 'popcorn-stealth-8822';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeEndpoint(endpoint) {
  const clean = String(endpoint || '').replace(/^\/+/, '').replace(/^api\/+/, '');
  const parts = clean.split('/').filter(Boolean);

  if (!parts.length) return '/api/trending';
  if (parts[0] === 'health') return '/health';

  if (parts[0] === 'rpc') {
    if (parts[1] === 'platform' && parts[2]) return `/api/platform/${parts.slice(2).join('/')}`;
    if (parts[1] === 'genre' && parts[2]) return `/api/search/${parts.slice(2).join(' ')}`;
    if (parts[1] === 'mixed' || parts[1] === 'featured') return '/api/trending';
    return '/api/trending';
  }

  return `/api/${parts.join('/')}`;
}

function normalizeProxyEndpoint(endpoint) {
  return String(endpoint || 'trending').replace(/^\/+/, '').replace(/^api\/+/, '') || 'trending';
}

function mergeSearchParams(targetUrl, requestUrl) {
  const params = new URL(requestUrl).searchParams;
  params.forEach((value, key) => {
    if (key !== 'endpoint') targetUrl.searchParams.append(key, value);
  });
}

function deobfuscate(payload) {
  try {
    const encoded = String(payload || '').replace(/-/g, '+').replace(/_/g, '/');
    const source = Buffer.from(encoded, 'base64');
    const decoded = Buffer.alloc(source.length);

    for (let index = 0; index < source.length; index += 1) {
      decoded[index] = source[index] ^ POPCORN_SECRET.charCodeAt(index % POPCORN_SECRET.length);
    }

    return JSON.parse(decoded.toString('utf8'));
  } catch {
    return null;
  }
}

async function fetchHicine(upstreamUrl) {
  const response = await fetch(upstreamUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Origin: 'https://www.hicine.info',
      Referer: 'https://www.hicine.info/',
      'User-Agent': 'Luci-TV/1.0',
    },
  });
  const text = await response.text();

  try {
    if (/parklogic|openprovider-expired|<html/i.test(text)) {
      return {
        ok: false,
        status: 502,
        data: {
          error: 'Hicine API unavailable',
          message: HICINE_UNAVAILABLE_MESSAGE,
          upstream: upstreamUrl.toString(),
        },
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data: text ? JSON.parse(text) : null,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      data: {
        error: 'Invalid upstream response',
        message: 'api.hicine.info did not return JSON.',
        upstream: upstreamUrl.toString(),
        preview: text.replace(/\s+/g, ' ').trim().slice(0, 180),
      },
    };
  }
}

async function fetchPopcorn(endpoint, requestUrl) {
  const username = process.env.POPCORN_USERNAME;
  const password = process.env.POPCORN_PASSWORD;

  if (!username || !password) {
    return {
      ok: false,
      status: 502,
      data: {
        error: 'Fallback unavailable',
        message: 'Hicine is down and POPCORN_USERNAME / POPCORN_PASSWORD are not configured.',
      },
    };
  }

  const loginResponse = await fetch(`${POPCORN_ORIGIN}/api/auth`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!loginResponse.ok) {
    return {
      ok: false,
      status: loginResponse.status,
      data: {
        error: 'Fallback login failed',
        message: 'Popcorn fallback login failed. Check POPCORN_USERNAME and POPCORN_PASSWORD.',
      },
    };
  }

  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0] || '';
  const fallbackUrl = new URL('/api/proxy', POPCORN_ORIGIN);
  fallbackUrl.searchParams.set('endpoint', normalizeProxyEndpoint(endpoint));
  mergeSearchParams(fallbackUrl, requestUrl);

  const response = await fetch(fallbackUrl, {
    cache: 'no-store',
    headers: {
      Cookie: cookie,
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
  const data = await response.json().catch(() => null);
  const decoded = data?.p ? deobfuscate(data.p) : data;

  return {
    ok: response.ok && Boolean(decoded),
    status: response.ok && decoded ? 200 : 502,
    data: decoded || {
      error: 'Fallback decode failed',
      message: 'Popcorn fallback returned an unreadable response.',
    },
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);
    const endpoint = requestUrl.searchParams.get('endpoint') || 'trending';
    const upstreamUrl = new URL(normalizeEndpoint(endpoint), HICINE_ORIGIN);
    mergeSearchParams(upstreamUrl, request.url);

    const upstream = await fetchHicine(upstreamUrl).catch((error) => ({
      ok: false,
      status: 502,
      data: {
        error: 'Hicine API unavailable',
        message: error.cause?.message || error.message || HICINE_UNAVAILABLE_MESSAGE,
      },
    }));

    if (!upstream.ok) {
      const fallback = await fetchPopcorn(endpoint, request.url);
      return json(fallback.data, fallback.ok ? 200 : fallback.status);
    }

    return json(upstream.data, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    const upstreamMessage = error.cause?.message || error.message || '';
    return json(
      {
        error: 'Hicine API unavailable',
        message: /other side closed|empty reply|terminated|fetch failed|timeout/i.test(upstreamMessage)
          ? HICINE_UNAVAILABLE_MESSAGE
          : upstreamMessage || 'Unable to fetch api.hicine.info.',
      },
      502,
    );
  }
}
