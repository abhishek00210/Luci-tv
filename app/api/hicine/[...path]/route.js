export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HICINE_ORIGIN = process.env.PRODUCTION_API_URL || 'https://hicine.biz';

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

const ALLOWED_PATHS = new Set(['home', 'browse', 'list', 'search', 't', 'g', 'health']);

function normalizePath(path) {
  if (path.length !== 1 || !ALLOWED_PATHS.has(path[0])) return null;
  return `/hapi/${path[0]}`;
}

async function fetchHicine(upstreamUrl) {
  const response = await fetch(upstreamUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
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
        message: 'hicine.biz did not return JSON.',
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
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) return json({ error: 'Unknown catalog endpoint' }, 404);
    const upstreamUrl = new URL(normalizedPath, HICINE_ORIGIN);
    upstreamUrl.search = new URL(request.url).search;

    const upstream = await fetchHicine(upstreamUrl);
    return json(upstream.data, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json(
      {
        error: 'Hicine request failed',
        message: error.cause?.message || error.message || 'Unable to fetch hicine.biz.',
      },
      502,
    );
  }
}
