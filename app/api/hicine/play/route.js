export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createMediaProxyPath } from '../../media/signing';

const BASE = 'https://hicine.biz';
const HEADERS = {
  Accept: 'application/json',
  Origin: BASE,
  Referer: `${BASE}/`,
  'User-Agent': 'Mozilla/5.0',
};

async function getJson(path) {
  const response = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: HEADERS,
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.json();
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const key = params.get('k') || '';
  const episode = params.get('ep');
  if (!/^[\w-]{20,500}$/.test(key) || (episode && !/^\d{1,4}$/.test(episode))) {
    return Response.json({ error: 'Invalid video selection' }, { status: 400 });
  }
  try {
    const group = await getJson(`/hapi/g?k=${encodeURIComponent(key)}`);
    const items = Array.isArray(group.items) ? group.items : [];
    const item = episode
      ? items.find((entry) => String(entry.ep) === episode)
      : [...items].sort((a, b) => (Number(b.ep) || 0) - (Number(a.ep) || 0))[0];
    if (!item) return Response.json({ error: 'Episode unavailable' }, { status: 404 });
    const hosts = [...(item.hosts || [])].sort((a, b) => {
      const order = ['vcloud', 'gdirect', 'vdrive'];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
    for (const host of hosts.slice(0, 3)) {
      if (!host.k) continue;
      try {
        const download = await getJson(`/hapi/dl?k=${encodeURIComponent(host.k)}`);
        const order = ['fsl2', 'fsl', 'server1', 'ten', 'gdirect'];
        const options = (download.options || [])
          .filter((entry) => entry.kind === 'direct')
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        for (const option of options) {
          const optionKey = option.ks || option.k;
          if (!optionKey) continue;
          try {
            const result = await getJson(`/hapi/go?k=${encodeURIComponent(optionKey)}&m=u`);
            const videoUrl = new URL(result.url);
            if (videoUrl.protocol !== 'https:') continue;
            if (videoUrl.hostname.endsWith('.r2.dev')) {
              const probe = await fetch(videoUrl, {
                headers: { ...HEADERS, Range: 'bytes=10000000-10000001' },
                cache: 'no-store',
                signal: AbortSignal.timeout(10000),
              });
              await probe.body?.cancel();
              if (probe.status !== 206) continue;
              const proxyPath = createMediaProxyPath(videoUrl.toString());
              if (proxyPath) return Response.json({ url: proxyPath, episode: item.ep, host: option.id, seekable: true }, { headers: { 'Cache-Control': 'no-store' } });
            } else {
              const proxyPath = createMediaProxyPath(videoUrl.toString());
              return Response.json({ url: proxyPath || videoUrl.toString(), episode: item.ep, host: option.id, seekable: false }, { headers: { 'Cache-Control': 'no-store' } });
            }
          } catch { /* Try the next source. */ }
        }
      } catch { /* Try the next host. */ }
    }
    return Response.json({ error: 'No playable server is available' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message || 'Video lookup failed' }, { status: 502 });
  }
}
