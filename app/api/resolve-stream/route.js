export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_WORKER_ORIGIN =
  process.env.DOWNLOAD_WORKER_ORIGIN || 'https://polished-hall-486c.brandaq.workers.dev';
const SERVER_PRIORITY = ['ten', 'hubcloud', 'gdrive', 'google', 'pixel'];

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

function chooseServer(tokens, preferredServer = '') {
  const tokenKeys = Object.keys(tokens);
  if (preferredServer && tokens[preferredServer]) return preferredServer;

  return SERVER_PRIORITY.find((server) => tokens[server]) || tokenKeys[0];
}

function unwrapUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const nestedLink = parsed.searchParams.get('link') || parsed.searchParams.get('url');
    return nestedLink || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function resolveRedirects(rawUrl) {
  let currentUrl = rawUrl;

  for (let step = 0; step < 4; step += 1) {
    const response = await fetch(currentUrl, {
      cache: 'no-store',
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        Accept: 'video/*,*/*;q=0.8',
        Range: 'bytes=0-1',
      },
    });

    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      currentUrl = unwrapUrl(new URL(location, currentUrl).toString());
      continue;
    }

    return {
      downloadUrl: unwrapUrl(currentUrl),
      contentType: response.headers.get('content-type') || '',
      contentLength: response.headers.get('content-length') || '',
      contentDisposition: response.headers.get('content-disposition') || '',
    };
  }

  return { downloadUrl: unwrapUrl(currentUrl), contentType: '', contentLength: '', contentDisposition: '' };
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

  const server = chooseServer(tokens, preferredServer);
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

  const direct = await resolveRedirects(downloadUrl).catch(() => ({
    downloadUrl: unwrapUrl(downloadUrl),
    contentType: '',
    contentLength: '',
    contentDisposition: '',
  }));

  return {
    success: true,
    title: linksData.title || '',
    size: linksData.size || '',
    server,
    downloadUrl: direct.downloadUrl,
    contentType: direct.contentType,
    contentLength: direct.contentLength,
    contentDisposition: direct.contentDisposition,
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
