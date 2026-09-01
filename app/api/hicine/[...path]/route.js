export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POPCORN_ORIGIN = process.env.POPCORN_PROXY_ORIGIN || 'https://my-popcorn.vercel.app';
const POPCORN_USERNAME = process.env.POPCORN_USERNAME;
const POPCORN_PASSWORD = process.env.POPCORN_PASSWORD;
const ASSET_SECRET = process.env.POPCORN_ASSET_SECRET || 'popcorn-stealth-8822';

const endpointAliases = {
  bolly_movies: 'bollywood_movies',
  bolly_series: 'bollywood_series',
  hollywood_movies: 'movies',
  hollywood_series: 'series',
};

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

function deobfuscate(payload) {
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const encoded = Buffer.from(base64, 'base64');
  const decoded = Buffer.alloc(encoded.length);

  for (let i = 0; i < encoded.length; i += 1) {
    decoded[i] = encoded[i] ^ ASSET_SECRET.charCodeAt(i % ASSET_SECRET.length);
  }

  const text = decoded.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toPopcornEndpoint(path, search) {
  const parts = [...path];
  if (parts[0] === 'api') parts.shift();

  if (parts[0] === 'search') {
    return `search/${parts.slice(1).join('/')}${search}`;
  }

  const head = endpointAliases[parts[0]] || parts[0];
  return [head, ...parts.slice(1)].filter(Boolean).join('/') + search;
}

async function getAuthCookie() {
  if (!POPCORN_USERNAME || !POPCORN_PASSWORD) {
    throw new Error('Missing POPCORN_USERNAME or POPCORN_PASSWORD environment variable.');
  }

  const response = await fetch(`${POPCORN_ORIGIN}/api/auth`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: POPCORN_USERNAME,
      password: POPCORN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Popcorn auth failed: ${response.status}`);
  }

  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Popcorn auth did not return a session cookie.');
  return cookie;
}

async function fetchPopcornEndpoint(endpoint) {
  const cookie = await getAuthCookie();
  const url = new URL('/api/proxy', POPCORN_ORIGIN);
  url.searchParams.set('endpoint', endpoint);

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Cookie: cookie,
      'ngrok-skip-browser-warning': 'true',
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Popcorn proxy failed: ${response.status}`);
  }

  return data?.p ? deobfuscate(data.p) : data;
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
    const { search } = new URL(request.url);

    if (path.join('/') === 'health') {
      return json({ status: 'OK', message: 'Luci-TV Popcorn proxy is running' });
    }

    const endpoint = toPopcornEndpoint(path, search);
    const data = await fetchPopcornEndpoint(endpoint);
    return json(data);
  } catch (error) {
    return json(
      {
        error: 'Proxy request failed',
        message: error.message || 'Unable to fetch movie API.',
      },
      502,
    );
  }
}
