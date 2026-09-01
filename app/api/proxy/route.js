export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HICINE_ORIGIN = process.env.PRODUCTION_API_URL || 'https://api.hicine.info';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const HICINE_UNAVAILABLE_MESSAGE = 'Hicine API is unavailable right now. api.hicine.info is closing requests or returning an expired-domain page.';

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

function mergeSearchParams(targetUrl, requestUrl) {
  const params = new URL(requestUrl).searchParams;
  params.forEach((value, key) => {
    if (key !== 'endpoint') targetUrl.searchParams.append(key, value);
  });
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

    const upstream = await fetchHicine(upstreamUrl);
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
