export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HICINE_ORIGIN = process.env.PRODUCTION_API_URL || 'https://api.hicine.info';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

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

function normalizePath(path) {
  const parts = [...path];
  if (parts[0] === 'api') parts.shift();

  if (parts[0] === 'rpc') {
    if (parts[1] === 'platform' && parts[2]) {
      return `/api/platform/${parts.slice(2).join('/')}`;
    }
    if (parts[1] === 'genre' && parts[2]) {
      return `/api/search/${parts.slice(2).join(' ')}`;
    }
    return '/api/trending';
  }

  if (parts[0] === 'health') return '/health';
  return `/api/${parts.join('/')}`;
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
        preview: text.replace(/\s+/g, ' ').trim().slice(0, 180),
      },
    };
  }
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

export async function GET(request, { params }) {
  try {
    const path = (await params).path || [];
    const upstreamUrl = new URL(normalizePath(path), HICINE_ORIGIN);
    upstreamUrl.search = new URL(request.url).search;

    const upstream = await fetchHicine(upstreamUrl);
    return json(upstream.data, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json(
      {
        error: 'Hicine request failed',
        message: error.cause?.message || error.message || 'Unable to fetch api.hicine.info.',
      },
      502,
    );
  }
}
