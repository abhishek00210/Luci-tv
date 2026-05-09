import 'dotenv/config';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { movies } from './src/data/movies.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 5173;
const isProduction = process.env.NODE_ENV === 'production';
const productionApiUrl = process.env.PRODUCTION_API_URL;
const contentCollectionList = [
  'movies',
  'series',
  'anime',
  'bolly_movies',
  'bolly_series',
  'hollywood_movies',
  'hollywood_series',
  'bollywood_movies',
  'bollywood_series',
  'kdrama',
  'chinese_drama',
  'tvshows',
];
const contentCollections = new Set(contentCollectionList);

app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=600');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

function getProductionApiRoot() {
  if (!productionApiUrl) {
    return '';
  }

  let root = productionApiUrl.replace(/\/$/, '');
  const apiPathIndex = root.indexOf('/api/');

  if (apiPathIndex >= 0) {
    root = root.slice(0, apiPathIndex);
  } else if (root.endsWith('/api')) {
    root = root.slice(0, -4);
  }

  return root;
}

function buildProductionUrl(path, query = {}) {
  const root = getProductionApiRoot();
  const target = new URL(`${root}/api/${path.replace(/^\/+/, '')}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value);
    }
  });

  return target;
}

function buildProductionRootUrl(path, query = {}) {
  const root = getProductionApiRoot();
  const target = new URL(`${root}/${path.replace(/^\/+/, '')}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value);
    }
  });

  return target;
}

function extractVcloudUrl(rawUrl) {
  const input = String(rawUrl || '').trim();

  if (!input) {
    return '';
  }

  try {
    const parsed = new URL(input);
    return parsed.searchParams.get('vcloud') || input;
  } catch {
    return input;
  }
}

function getDownloadWorkerOrigin(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.searchParams.get('vcloud') ? parsed.origin : process.env.DOWNLOAD_WORKER_ORIGIN || '';
  } catch {
    return process.env.DOWNLOAD_WORKER_ORIGIN || '';
  }
}

async function proxyJson(res, target) {
  const response = await fetch(target);
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return res.status(response.status).json({
      success: false,
      message: contentType.includes('text/html')
        ? 'Production API returned a page instead of JSON'
        : text.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Production API returned a non-JSON response',
    });
  }

  return res.status(response.status).json(data);
}

function publicMovie(movie) {
  return {
    ...movie,
    featured_image: movie.featured_image || movie.poster,
  };
}

function searchCatalog(query, filters = {}) {
  const q = query.trim().toLowerCase();

  return movies
    .filter((movie) => {
      const searchable = [movie.title, movie.genre, movie.year, movie.mood, movie.url_slug]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = searchable.includes(q);
      const matchesQuality = !filters.quality || movie.quality === filters.quality;
      const matchesLang = !filters.lang || movie.lang === filters.lang;

      return matchesQuery && matchesQuality && matchesLang;
    })
    .slice(0, 20)
    .map(publicMovie);
}

async function proxyMovieSearch(req, res, q) {
  const target = buildProductionUrl('/movies/', {
    search: q,
    q,
    limit: req.query.limit || 20,
    page: req.query.page || 1,
    category: req.query.category,
  });

  const response = await fetch(target);
  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json(data);
  }

  const results = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

  return res.status(response.status).json({
    success: true,
    count: results.length,
    data: results,
    pagination: data.pagination,
  });
}

app.get('/api/movies/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query required',
      });
    }

    if (productionApiUrl) {
      return await proxyMovieSearch(req, res, q);
    }

    const data = searchCatalog(q, {
      quality: req.query.quality,
      lang: req.query.lang,
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/search/universal', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || '').trim();

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query required',
      });
    }

    if (!productionApiUrl) {
      const data = searchCatalog(q).map((item) => ({ ...item, contentType: 'movies' }));

      return res.json({
        success: true,
        query: q,
        count: data.length,
        data,
        groups: [
          {
            type: 'movies',
            total: data.length,
            items: data,
          },
        ],
      });
    }

    const groups = await Promise.all(
      contentCollectionList.map(async (collection) => {
        const response = await fetch(
          buildProductionUrl(`/${collection}/`, {
            search: q,
            q,
            category: req.query.category,
            limit: req.query.limit || 10,
            page: 1,
          }),
        );
        const payload = await response.json();
        const items = Array.isArray(payload.data) ? payload.data : [];

        return {
          type: collection,
          total: payload.pagination?.total || items.length,
          items: items.map((item) => ({ ...item, contentType: collection })),
        };
      }),
    );
    const activeGroups = groups.filter((group) => group.total > 0);
    const data = activeGroups.flatMap((group) => group.items);

    return res.json({
      success: true,
      query: q,
      count: data.length,
      data,
      groups: activeGroups,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get('/api/trending/', async (_req, res) => {
  try {
    if (productionApiUrl) {
      return await proxyJson(res, buildProductionUrl('/trending/'));
    }

    const data = movies.filter((movie) => movie.trending).map((movie) => ({
      ...publicMovie(movie),
      contentType: 'movies',
    }));

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/rpc/:group/:name', async (req, res) => {
  try {
    if (productionApiUrl) {
      return await proxyJson(
        res,
        buildProductionRootUrl(`/rpc/${req.params.group}/${req.params.name}`, {
          limit: req.query.limit || 300,
          offset: req.query.offset,
        }),
      );
    }

    const data = movies.filter((movie) => movie.trending).map((movie) => ({
      ...publicMovie(movie),
      contentType: 'movies',
    }));

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/:collection/', async (req, res, next) => {
  try {
    const { collection } = req.params;

    if (!contentCollections.has(collection)) {
      return next();
    }

    if (productionApiUrl) {
      return await proxyJson(
        res,
        buildProductionUrl(`/${collection}/`, {
          page: req.query.page || 1,
          limit: req.query.limit || 20,
          search: req.query.search || req.query.q,
          q: req.query.q,
          category: req.query.category,
        }),
      );
    }

    const filtered = movies.filter((movie) => {
      const search = String(req.query.search || req.query.q || '').toLowerCase();
      const category = String(req.query.category || '').toLowerCase();
      const matchesSearch = !search || movie.title.toLowerCase().includes(search);
      const matchesCategory =
        !category ||
        movie.genre.toLowerCase().includes(category) ||
        movie.url_slug.toLowerCase().includes(category);

      return collection === 'movies' && matchesSearch && matchesCategory;
    });

    return res.json({
      data: filtered.map(publicMovie),
      pagination: {
        page: 1,
        limit: filtered.length,
        total: filtered.length,
        pages: 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/:collection/:slugOrId', async (req, res, next) => {
  try {
    const { collection, slugOrId } = req.params;

    if (!contentCollections.has(collection)) {
      return next();
    }

    if (productionApiUrl) {
      return await proxyJson(res, buildProductionUrl(`/${collection}/${slugOrId}`));
    }

    const movie = movies.find((item) => item.url_slug === slugOrId || String(item.id) === slugOrId);

    if (!movie) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    return res.json(publicMovie(movie));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const DEFAULT_WORKER_ORIGIN =
  process.env.DOWNLOAD_WORKER_ORIGIN || 'https://frosty-snowflake-407a.renker2364.workers.dev';

const SERVER_NAMES = {
  fsl: 'FSL Server',
  fsl2: 'FSLv2 Server',
  pixel: 'Pixel Server',
  trs: 'TRS Server',
  ten: '10Gbps Server',
  server1: 'Server 1',
};

const MIME_TYPES = {
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
};

/**
 * Resolves a vcloud URL into a direct CDN download URL.
 * Returns { cdnUrl, title, size, server, allServers } or throws.
 */
async function resolveCdnUrl(rawUrl, preferredServer = '') {
  const vcloudUrl = extractVcloudUrl(rawUrl);
  const workerOrigin = getDownloadWorkerOrigin(rawUrl) || DEFAULT_WORKER_ORIGIN;

  if (!vcloudUrl || vcloudUrl === 'empty') {
    throw Object.assign(new Error('Missing or invalid "url" parameter.'), {
      statusCode: 400,
    });
  }

  const linksResponse = await fetch(
    `${workerOrigin}/api/links?vcloud=${encodeURIComponent(vcloudUrl)}`,
  );

  if (!linksResponse.ok) {
    throw Object.assign(new Error(`Worker /api/links returned HTTP ${linksResponse.status}`), {
      statusCode: 502,
    });
  }

  const linksData = await linksResponse.json();
  const tokens = linksData.tokens || linksData.servers || {};
  const tokenKeys = Object.keys(tokens);

  if (tokenKeys.length === 0) {
    const err = Object.assign(new Error('No download servers available for this file.'), {
      statusCode: 404,
      title: linksData.title,
      size: linksData.size,
    });
    throw err;
  }

  const serverType =
    preferredServer && tokens[preferredServer] ? preferredServer : tokenKeys[0];

  const { ts, sig } = tokens[serverType];

  const goUrl =
    `${workerOrigin}/go?type=${serverType}` +
    `&vcloud=${encodeURIComponent(vcloudUrl)}` +
    `&ts=${ts}&sig=${sig}`;

  const goResponse = await fetch(goUrl, { redirect: 'manual' });
  const cdnUrl = goResponse.headers.get('location');

  if (!cdnUrl) {
    throw Object.assign(new Error('Worker /go did not return a redirect URL.'), {
      statusCode: 502,
    });
  }

  return {
    cdnUrl,
    title: linksData.title || '',
    size: linksData.size || '',
    server: serverType,
    allServers: tokenKeys.map((key) => ({ type: key, name: SERVER_NAMES[key] || key })),
  };
}

/**
 * GET /api/download?url=<vcloud_url>&server=fsl&redirect=true
 */
app.get('/api/download', async (req, res) => {
  try {
    const result = await resolveCdnUrl(req.query.url, req.query.server || '');

    if (req.query.redirect === 'true') {
      return res.redirect(result.cdnUrl);
    }

    return res.json({
      success: true,
      title: result.title,
      size: result.size,
      server: result.server,
      downloadUrl: result.cdnUrl,
      allServers: result.allServers,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      title: error.title,
      size: error.size,
    });
  }
});

/**
 * GET /api/stream?url=<vcloud_url>&server=fsl
 *
 * Streaming proxy — resolves the CDN URL and pipes the video back to the
 * browser with the correct Content-Type (video/x-matroska, video/mp4, etc.)
 * and full Range-request support so <video> players can seek.
 *
 * Use this as the `src` of a <video> tag:
 *   <video src="/api/stream?url=https://vcloud.zip/xxxxx" controls></video>
 */
app.get('/api/stream', async (req, res) => {
  try {
    const { cdnUrl, title } = await resolveCdnUrl(req.query.url, req.query.server || '');

    // First do a HEAD request to get file info
    const headRes = await fetch(cdnUrl, { method: 'HEAD' });
    const totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
    const disposition = headRes.headers.get('content-disposition') || '';

    // Determine content type from filename
    const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/i);
    const filename = filenameMatch
      ? decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
      : title || 'video';
    const ext = (filename.match(/\.\w+$/) || ['.mkv'])[0].toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Parse Range header from the client
    const rangeHeader = req.headers.range;

    if (rangeHeader && totalSize) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      // Fetch the requested range from the CDN
      const cdnRes = await fetch(cdnUrl, {
        headers: { Range: `bytes=${start}-${end}` },
      });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      });

      // Pipe the CDN response body to the client
      const reader = cdnRes.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(Buffer.from(value))) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      };

      req.on('close', () => reader.cancel());
      await pump();
    } else {
      // No range — send the full file (initial request from video player)
      const cdnRes = await fetch(cdnUrl);

      res.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': totalSize || cdnRes.headers.get('content-length') || '',
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      });

      const reader = cdnRes.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (!res.write(Buffer.from(value))) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      };

      req.on('close', () => reader.cancel());
      await pump();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }
  }
});

if (isProduction) {
  const distPath = resolve(__dirname, 'dist');

  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(resolve(distPath, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`Luci-TV running at http://localhost:${port}`);
});
