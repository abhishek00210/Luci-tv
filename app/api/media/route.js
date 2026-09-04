import { verifyMediaToken } from './signing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORWARDED_REQUEST_HEADERS = ['range', 'if-range', 'if-none-match', 'if-modified-since'];
const FORWARDED_RESPONSE_HEADERS = [
  'accept-ranges',
  'content-disposition',
  'content-length',
  'content-range',
  'etag',
  'last-modified',
];

function errorResponse(message, status) {
  return Response.json({ success: false, message }, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function validSourceUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function mediaContentType(sourceUrl, upstreamType) {
  const type = String(upstreamType || '').toLowerCase();
  if (sourceUrl.pathname.toLowerCase().endsWith('.mkv')) return 'video/x-matroska';
  if (type.startsWith('video/') || type.includes('mpegurl')) return upstreamType;
  return upstreamType || 'application/octet-stream';
}

async function proxyMedia(request, method) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url') || '';
  const sourceUrl = validSourceUrl(rawUrl);

  if (!sourceUrl || !verifyMediaToken(
    rawUrl,
    searchParams.get('token') || '',
    searchParams.get('expires') || '',
  )) {
    return errorResponse('Invalid or unsigned media source.', 403);
  }

  const requestHeaders = new Headers({
    Accept: 'video/*,application/octet-stream,*/*;q=0.8',
  });
  for (const header of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(header);
    if (value) requestHeaders.set(header, value);
  }
  if (method === 'HEAD') requestHeaders.set('Range', 'bytes=0-0');

  let upstream;
  try {
    upstream = await fetch(sourceUrl, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'follow',
      cache: 'no-store',
      signal: request.signal,
    });
  } catch {
    return errorResponse('The media server could not be reached.', 502);
  }

  const responseHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
    'Cache-Control': 'private, no-store',
    'Content-Type': mediaContentType(sourceUrl, upstream.headers.get('content-type')),
  });
  for (const header of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  if (method === 'HEAD') {
    const totalLength = upstream.headers.get('content-range')?.split('/').pop();
    if (totalLength && totalLength !== '*') responseHeaders.set('Content-Length', totalLength);
    responseHeaders.delete('Content-Range');
    await upstream.body?.cancel();
    return new Response(null, {
      status: upstream.ok ? 200 : upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-Range, If-None-Match, If-Modified-Since',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export function HEAD(request) {
  return proxyMedia(request, 'HEAD');
}

export function GET(request) {
  return proxyMedia(request, 'GET');
}
