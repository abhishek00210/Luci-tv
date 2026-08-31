import https from 'node:https';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HICINE_ORIGIN = process.env.PRODUCTION_API_URL || 'https://api.hicine.info';

function proxyHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: proxyHeaders(),
  });
}

function fetchUpstream(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Accept: 'application/json',
          Origin: 'https://www.hicine.info',
          'User-Agent': 'Luci-TV/1.0',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 502,
            contentType: res.headers['content-type'],
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.setTimeout(15000, () => req.destroy(new Error('Hicine API request timed out.')));
    req.on('error', reject);
    req.end();
  });
}

export async function GET(request, { params }) {
  try {
    const path = (await params).path || [];
    const upstreamUrl = new URL(`/${path.join('/')}`, HICINE_ORIGIN);
    upstreamUrl.search = new URL(request.url).search;

    const upstream = await fetchUpstream(upstreamUrl);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: proxyHeaders(upstream.contentType || undefined),
    });
  } catch (error) {
    return Response.json(
      {
        error: 'Proxy request failed',
        message: 'Hicine API is unavailable right now. api.hicine.info is not returning movie JSON.',
        detail: error.message || 'Unable to fetch Hicine API.',
      },
      {
        status: 502,
        headers: proxyHeaders(),
      },
    );
  }
}
