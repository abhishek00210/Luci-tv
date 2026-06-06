export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_WORKER_ORIGIN =
  process.env.DOWNLOAD_WORKER_ORIGIN || 'https://polished-hall-486c.brandaq.workers.dev';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function extractVcloudUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';

  try {
    const parsed = new URL(input);
    return parsed.searchParams.get('vcloud') || input;
  } catch {
    return input;
  }
}

function getWorkerOrigin(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.get('vcloud')) return parsed.origin;
  } catch {
    // Fall through to default worker origin.
  }

  return DEFAULT_WORKER_ORIGIN;
}

async function resolveCdnUrl(rawUrl, preferredServer = '') {
  const vcloudUrl = extractVcloudUrl(rawUrl);
  const workerOrigin = getWorkerOrigin(rawUrl);

  if (!vcloudUrl || vcloudUrl === 'empty') {
    throw Object.assign(new Error('Missing or invalid url parameter.'), { statusCode: 400 });
  }

  const linksResponse = await fetch(
    `${workerOrigin}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
    { cache: 'no-store' },
  );

  if (!linksResponse.ok) {
    throw Object.assign(new Error(`Worker links request failed: ${linksResponse.status}`), {
      statusCode: 502,
    });
  }

  const linksData = await linksResponse.json();
  const tokens = linksData.tokens || linksData.servers || {};
  const tokenKeys = Object.keys(tokens);

  if (!tokenKeys.length) {
    throw Object.assign(new Error('No download servers available for this file.'), {
      statusCode: 404,
    });
  }

  const server = preferredServer && tokens[preferredServer] ? preferredServer : tokenKeys[0];
  const { ts, sig } = tokens[server] || {};

  if (!ts || !sig) {
    throw Object.assign(new Error('Selected server token is missing.'), { statusCode: 502 });
  }

  const goUrl =
    `${workerOrigin}/go?type=${server}` +
    `&vcloud=${encodeURIComponent(vcloudUrl)}` +
    `&ts=${encodeURIComponent(ts)}` +
    `&sig=${encodeURIComponent(sig)}`;

  const goResponse = await fetch(goUrl, {
    cache: 'no-store',
    redirect: 'manual',
  });
  const downloadUrl = goResponse.headers.get('location');

  if (!downloadUrl) {
    throw Object.assign(new Error('Worker did not return a direct CDN URL.'), {
      statusCode: 502,
    });
  }

  return {
    success: true,
    title: linksData.title || '',
    size: linksData.size || '',
    server,
    downloadUrl,
    allServers: tokenKeys,
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
    const { searchParams } = new URL(request.url);
    const result = await resolveCdnUrl(
      searchParams.get('url') || '',
      searchParams.get('server') || '',
    );

    if (searchParams.get('redirect') === 'true') {
      return Response.redirect(result.downloadUrl, 302);
    }

    return json(result);
  } catch (error) {
    return json(
      {
        success: false,
        message: error.message || 'Unable to resolve stream URL.',
      },
      error.statusCode || 500,
    );
  }
}
