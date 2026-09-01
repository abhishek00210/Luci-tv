'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const librarySections = [
  { label: 'Trending', type: 'trending', group: 'Library', path: '/api/trending', flat: true },
  { label: 'Movies', type: 'movies', group: 'Library', path: '/api/movies', collection: 'movies' },
  { label: 'Series', type: 'series', group: 'Library', path: '/api/series', collection: 'series' },
  { label: 'Anime', type: 'anime', group: 'Library', path: '/api/anime', collection: 'anime' },
  { label: 'Bolly Movies', type: 'bolly_movies', group: 'Library', path: '/api/bolly_movies', collection: 'bolly_movies' },
  { label: 'Bolly Series', type: 'bolly_series', group: 'Library', path: '/api/bolly_series', collection: 'bolly_series' },
];

const platformSections = [
  { label: 'Netflix', type: 'netflix', group: 'Platforms', path: '/rpc/platform/netflix', flat: true },
  { label: 'Amazon', type: 'amazon', group: 'Platforms', path: '/rpc/platform/amazon', flat: true },
  { label: 'Disney+', type: 'disney', group: 'Platforms', path: '/rpc/platform/disney', flat: true },
  { label: 'Hotstar', type: 'hotstar', group: 'Platforms', path: '/rpc/platform/hotstar', flat: true },
  { label: 'JioHotstar', type: 'jiohotstar', group: 'Platforms', path: '/rpc/platform/jiohotstar', flat: true },
  { label: 'Apple TV+', type: 'apple', group: 'Platforms', path: '/rpc/platform/apple', flat: true },
  { label: 'Zee5', type: 'zee5', group: 'Platforms', path: '/rpc/platform/zee5', flat: true },
  { label: 'SonyLIV', type: 'sony', group: 'Platforms', path: '/rpc/platform/sony', flat: true },
  { label: 'Hulu', type: 'hulu', group: 'Platforms', path: '/rpc/platform/hulu', flat: true },
  { label: 'HBO', type: 'hbo', group: 'Platforms', path: '/rpc/platform/hbo', flat: true },
];

const categorySections = [
  { label: 'Dual Audio', type: 'dual_audio', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Dual Audio Movies' },
  { label: 'Action', type: 'action', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Action' },
  { label: 'Comedy', type: 'comedy', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Comedy' },
  { label: 'Romance', type: 'romance', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Romance' },
  { label: 'Family', type: 'family', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Family' },
  { label: 'Horror', type: 'horror', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Horror' },
  { label: 'Thriller', type: 'thriller', group: 'Categories', path: '/api/movies', collection: 'movies', category: 'Thriller' },
];

const qualitySections = [
  { label: 'WEB-DL', type: 'webdl', group: 'Quality', path: '/api/movies', collection: 'movies', category: 'WEB-DL' },
  { label: 'HDRip', type: 'hdrip', group: 'Quality', path: '/api/movies', collection: 'movies', category: 'HDRip' },
  { label: '1080p', type: '1080p', group: 'Quality', path: '/api/movies', collection: 'movies', category: '1080p' },
  { label: '720p', type: '720p', group: 'Quality', path: '/api/movies', collection: 'movies', category: '720p' },
  { label: '480p', type: '480p', group: 'Quality', path: '/api/movies', collection: 'movies', category: '480p' },
  { label: '2026', type: 'year_2026', group: 'Quality', path: '/api/movies', collection: 'movies', category: '2026' },
];

const sections = [...librarySections, ...platformSections, ...categorySections, ...qualitySections];
const navGroups = [
  { label: 'Library', sections: librarySections },
  { label: 'Platforms', sections: platformSections },
  { label: 'Categories', sections: categorySections },
  { label: 'Quality', sections: qualitySections },
];
const globalSearchSections = librarySections.filter((item) => item.type !== 'trending');
const searchableCollections = librarySections.filter((item) => item.collection);
const HICINE_ORIGIN = 'https://api.hicine.info';
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || HICINE_ORIGIN;
const defaultFilters = { genre: '', year: '', quality: '', language: '' };
const adminUsername = 'babu';

function apiUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/resolve-stream')) return path;
  if (apiOrigin === HICINE_ORIGIN && (path.startsWith('/api/') || path.startsWith('/rpc/') || path.startsWith('/health'))) {
    const [pathname, query = ''] = path.split('?');
    const endpoint = pathname.replace(/^\/+/, '').replace(/^api\/+/, '');
    const params = new URLSearchParams(query);
    params.set('endpoint', endpoint);
    return `/api/proxy?${params.toString()}`;
  }
  return `${apiOrigin}${path}`;
}

function decodeText(value = '') {
  return String(value)
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/â/g, '-')
    .replace(/â/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getYear(item) {
  const fromTitle = String(item.title || '').match(/\b(19|20)\d{2}\b/);
  if (fromTitle) return fromTitle[0];
  if (item.date) return new Date(item.date).getFullYear().toString();
  return '';
}

function fieldText(item) {
  return `${item.title || ''} ${item.categories || ''} ${item.quality || ''}`.toLowerCase();
}

function getQualityHints(item) {
  const text = `${item.quality || ''} ${item.links || ''} ${item.cloudlinks || ''}`.toLowerCase();
  return ['2160p', '1080p', '720p', '480p', 'web-dl', 'hdrip', 'camrip', 'bluray']
    .filter((quality) => text.includes(quality));
}

function getLanguageHints(item) {
  const text = fieldText(item);
  return ['hindi', 'english', 'dual audio', 'tamil', 'telugu', 'korean', 'japanese']
    .filter((language) => text.includes(language));
}

function getFormatHint(item) {
  const text = `${item.quality || ''} ${item.links || ''} ${item.cloudlinks || ''}`.toLowerCase();
  if (text.includes('.mp4') || text.includes('mp4')) return 'MP4';
  if (text.includes('.m3u8') || text.includes('hls')) return 'HLS';
  if (text.includes('.webm')) return 'WebM';
  if (text.includes('.mkv') || text.includes('x264') || text.includes('x265')) return 'MKV';
  return '';
}

function resolveCollection(item, fallbackType) {
  const source = item.contentType || item.source_table || item.collection || fallbackType;
  const aliases = {
    hollywood_movies: 'movies',
    hollywood_series: 'series',
    bollywood_movies: 'bolly_movies',
    bollywood_series: 'bolly_series',
  };
  return aliases[source] || source;
}

function normalizeItem(item, fallbackType) {
  const contentType = resolveCollection(item, fallbackType);
  const image = item.featured_image || item.poster || item.image;
  const slug = item.url_slug || item.slug;

  return {
    ...item,
    id: item._id || item.record_id || slug || item.title,
    title: decodeText(item.title || 'Untitled'),
    image,
    featured_image: image,
    contentType,
    year: getYear(item),
    categories: decodeText(item.categories || ''),
    overview: decodeText(item.excerpt || item.content || item.categories || ''),
    qualityHints: getQualityHints(item),
    languageHints: getLanguageHints(item),
    formatHint: getFormatHint(item),
    slug,
    url_slug: slug,
  };
}

async function fetchJson(url, signal) {
  const res = await fetch(apiUrl(url), { signal });
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(preview || `Request returned non-JSON response: ${res.status}`);
  }

  if (!res.ok) throw new Error(data?.message || data?.error || `Request failed: ${res.status}`);
  return data;
}

function parseList(payload, type) {
  const rows = Array.isArray(payload) ? payload : payload.data || payload.results || payload.items || [];
  return {
    data: rows.map((item) => normalizeItem(item, type)),
    pagination: payload.pagination || null,
  };
}

function itemMatchesCategory(item, category) {
  if (!category) return true;
  const haystack = `${item.categories || ''} ${item.title || ''}`.toLowerCase();
  return haystack.includes(category.toLowerCase());
}

function parseMovieLinks(linksString) {
  if (!linksString) return [];

  return linksString
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(', ');
      return {
        downloadUrl: parts[0] || '',
        quality: parts[7] || parts.slice(1, -1).join(' ') || 'Download option',
        size: parts[8] || parts.at(-1) || '',
        mediaKind: 'movie',
        formatHint: getFormatHint({ quality: line, links: line }),
      };
    })
    .filter((item) => item.downloadUrl && item.downloadUrl !== 'empty');
}

function parseSeason(seasonString) {
  if (!seasonString) return null;
  const lines = seasonString.split('\n');
  const header = decodeText(lines[0] || 'Season downloads');
  const episodes = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const blocks = line.split(' : ');
    const label = blocks[0].trim();
    const qualities = blocks
      .slice(1)
      .map((block) => {
        const parts = block.split(',');
        return {
          downloadUrl: parts[0]?.trim() || '',
          size: parts.length >= 3 ? parts.slice(1, -1).join(',').trim() : '',
          quality: parts.at(-1)?.trim() || 'Download',
          formatHint: getFormatHint({ quality: block, links: block }),
        };
      })
      .filter((item) => item.downloadUrl && item.downloadUrl !== 'empty');

    if (qualities.length) episodes.push({ label, qualities });
  }

  return { header, episodes };
}

function parseSeasons(item) {
  const seasons = [];
  for (let i = 1; i <= 15; i += 1) {
    const parsed = parseSeason(item[`season_${i}`]);
    if (parsed?.episodes.length) {
      seasons.push({
        seasonNumber: i,
        ...parsed,
        episodes: parsed.episodes.map((episode) => ({
          ...episode,
          qualities: episode.qualities.map((quality) => ({
            ...quality,
            mediaKind: 'episode',
            seasonNumber: i,
            episodeLabel: episode.label,
          })),
        })),
      });
    }
  }
  const zip = parseSeason(item.season_zip);
  if (zip?.episodes.length) {
    seasons.push({
      seasonNumber: 'ZIP',
      ...zip,
      episodes: zip.episodes.map((episode) => ({
        ...episode,
        qualities: episode.qualities.map((quality) => ({
          ...quality,
          mediaKind: 'season_zip',
          seasonNumber: 'ZIP',
          episodeLabel: episode.label,
        })),
      })),
    });
  }
  return seasons;
}

function getPlayableDownloads(detail) {
  return [
    ...parseMovieLinks(detail.links || detail.cloudlinks),
    ...parseSeasons(detail).flatMap((season) => season.episodes.flatMap((episode) => episode.qualities)),
  ];
}

function findResumeDownload(detail, resume) {
  if (!resume?.downloadUrl) return null;
  const downloads = getPlayableDownloads(detail);
  return downloads.find((download) => download.downloadUrl === resume.downloadUrl)
    || downloads.find((download) => (
      String(download.seasonNumber || '') === String(resume.seasonNumber || '')
      && (download.episodeLabel || '') === (resume.episodeLabel || '')
      && (download.quality || '') === (resume.quality || '')
    ))
    || null;
}

function buildSectionUrl(section, query = '', limitOverride) {
  const params = new URLSearchParams();
  if (section.path.startsWith('/rpc/')) {
    params.set('limit', limitOverride || '300');
  } else {
    params.set('page', '1');
    params.set('limit', limitOverride || (query ? '80' : '60'));
  }
  if (section.category) params.set('category', section.category);
  if (query) {
    params.set('search', query);
    params.set('q', query);
  }
  return `${section.path}?${params.toString()}`;
}

function buildSearchUrl(query) {
  return `/api/search/${encodeURIComponent(query)}`;
}

function detailUrl(contentType, slug) {
  if (!contentType || !slug) return '';
  return `/api/${contentType}/${slug}`;
}

function downloadUrl(rawUrl) {
  return `/api/resolve-stream?url=${encodeURIComponent(rawUrl)}&redirect=true`;
}

function reportKey(username) {
  return `luci_reports_${username}`;
}

function getReports(username) {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(reportKey(username)) || '[]');
  } catch {
    return [];
  }
}

function saveReports(username, reports) {
  localStorage.setItem(reportKey(username), JSON.stringify(reports));
  return reports;
}

function applyFilters(list, filters) {
  return list.filter((item) => {
    const text = fieldText(item);
    if (filters.genre && !text.includes(filters.genre.toLowerCase())) return false;
    if (filters.year && item.year !== filters.year) return false;
    if (filters.quality && !text.includes(filters.quality.toLowerCase())) return false;
    if (filters.language && !text.includes(filters.language.toLowerCase())) return false;
    return true;
  });
}

function getFilterOptions(list) {
  const years = [...new Set(list.map((item) => item.year).filter(Boolean))].sort((a, b) => b.localeCompare(a)).slice(0, 12);
  return {
    genres: ['Action', 'Comedy', 'Romance', 'Family', 'Horror', 'Thriller', 'Sci-Fi', 'Fantasy'],
    years,
    qualities: ['2160p', '1080p', '720p', '480p', 'WEB-DL', 'HDRip', 'CAMRip', 'BluRay'],
    languages: ['Hindi', 'English', 'Dual Audio', 'Tamil', 'Telugu', 'Korean', 'Japanese'],
  };
}

function sourceUrl(rawUrl) {
  return rawUrl;
}

function formatResumeTime(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getVideoFormat(url = '') {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.m3u8')) return 'HLS';
  if (cleanUrl.endsWith('.mp4')) return 'MP4';
  if (cleanUrl.endsWith('.mkv')) return 'MKV';
  if (cleanUrl.endsWith('.webm')) return 'WebM';
  if (cleanUrl.endsWith('.mov')) return 'MOV';
  return 'Auto';
}

function parseSubtitleTime(value) {
  const normalized = value.replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
}

function formatSubtitleTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function buildSubtitleUrl(text, offsetSeconds = 0) {
  const hasWebVttHeader = text.trimStart().startsWith('WEBVTT');
  const body = text
    .replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})/g, (_, start, end) => (
      `${formatSubtitleTime(parseSubtitleTime(start) + offsetSeconds)} --> ${formatSubtitleTime(parseSubtitleTime(end) + offsetSeconds)}`
    ));
  const normalized = hasWebVttHeader ? body : `WEBVTT\n\n${body.replace(/^\d+\n/gm, '')}`;
  return URL.createObjectURL(new Blob([normalized], { type: 'text/vtt' }));
}

async function resolveStream(download, preferredServer = '') {
  const params = new URLSearchParams({ url: download.downloadUrl });
  if (preferredServer) params.set('server', preferredServer);
  const response = await fetch(`/api/resolve-stream?${params.toString()}`);
  const data = await response.json();

  if (!response.ok || !data.success || !data.downloadUrl) {
    throw new Error(data.message || 'Unable to resolve stream URL.');
  }

  return {
    ...download,
    title: data.title || download.quality,
    size: data.size || download.size,
    resolvedUrl: data.downloadUrl,
    server: data.server,
    allServers: data.allServers || [],
    contentType: data.contentType || '',
    contentDisposition: data.contentDisposition || '',
  };
}

async function hashPassword(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function recentKey(username) {
  return `luci_recent_${username}`;
}

function watchlistKey(username) {
  return `luci_watchlist_${username}`;
}

function historyKey(username) {
  return `luci_history_${username}`;
}

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('luci_current_user');
  return raw ? JSON.parse(raw) : null;
}

function readLibrary(key, username) {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(key(username)) || '[]');
  } catch {
    return [];
  }
}

function compactItem(item, extras = {}) {
  const compact = {
    id: item.id,
    title: item.title,
    image: item.image,
    featured_image: item.image,
    poster: item.poster || null,
    contentType: item.contentType,
    year: item.year,
    categories: item.categories,
    overview: item.overview,
    formatHint: item.formatHint || '',
    slug: item.slug,
    url_slug: item.slug,
    resume: item.resume || null,
    ...extras,
  };
  return compact;
}

function getRecent(username) {
  return readLibrary(recentKey, username);
}

function getWatchlist(username) {
  return readLibrary(watchlistKey, username);
}

function getHistory(username) {
  return readLibrary(historyKey, username);
}

function saveRecent(username, item) {
  if (!username || !item?.id) return [];
  const compact = compactItem(item, { watchedAt: Date.now() });
  const next = [compact, ...getRecent(username).filter((entry) => entry.id !== item.id)].slice(0, 24);
  localStorage.setItem(recentKey(username), JSON.stringify(next));
  return next;
}

function saveHistory(username, item) {
  if (!username || !item?.id) return [];
  const compact = compactItem(item, { watchedAt: Date.now() });
  const next = [compact, ...getHistory(username).filter((entry) => entry.id !== item.id)].slice(0, 80);
  localStorage.setItem(historyKey(username), JSON.stringify(next));
  return next;
}

function saveWatchlist(username, items) {
  localStorage.setItem(watchlistKey(username), JSON.stringify(items));
  return items;
}

function dedupe(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.contentType || 'item'}:${item.slug || item.id || item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

async function globalSearch(query, signal) {
  const lowered = query.toLowerCase();
  const directSearch = fetchJson(buildSearchUrl(query), signal)
    .then((payload) => parseList(payload, 'search').data.map((item) => ({ ...item, searchGroup: 'All' })));

  const bruteForceSearch = Promise.allSettled(
    globalSearchSections.map(async (section) => {
      const payload = await fetchJson(buildSectionUrl(section, section.path.startsWith('/rpc/') ? '' : query, section.path.startsWith('/rpc/') ? '300' : '30'), signal);
      const parsed = parseList(payload, section.collection || section.type).data;
      const filtered = section.path.startsWith('/rpc/')
        ? parsed.filter((item) => item.title.toLowerCase().includes(lowered))
        : parsed;
      return filtered.map((item) => ({ ...item, searchGroup: section.label }));
    }),
  );

  const [directResult, bruteForceResult] = await Promise.allSettled([directSearch, bruteForceSearch]);
  const directItems = directResult.status === 'fulfilled' ? directResult.value : [];
  const bruteForceItems = bruteForceResult.status === 'fulfilled'
    ? bruteForceResult.value.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    : [];

  return dedupe([...directItems, ...bruteForceItems]).slice(0, 160);
}

async function fetchSectionItems(section, signal, limitOverride) {
  if (section.category && !section.forceSingleCollection) {
    const results = await Promise.allSettled(
      searchableCollections.map(async (collectionSection) => {
        const payload = await fetchJson(buildSectionUrl(collectionSection, '', limitOverride || '80'), signal);
        return parseList(payload, collectionSection.collection).data
          .filter((item) => itemMatchesCategory(item, section.category));
      }),
    );

    return dedupe(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
  }

  const payload = await fetchJson(buildSectionUrl(section, '', limitOverride), signal);
  return parseList(payload, section.collection || section.type).data
    .filter((item) => itemMatchesCategory(item, section.category));
}

function AuthGate({ onAuth }) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    const cleanName = username.trim().toLowerCase();
    if (cleanName.length < 3 || password.length < 4) {
      setMessage('Use at least 3 letters for ID and 4 characters for password.');
      return;
    }

    const users = JSON.parse(localStorage.getItem('luci_users') || '{}');
    if (mode === 'signup' && users[cleanName]) {
      setMessage('This ID already exists. Sign in instead.');
      return;
    }
    if (mode === 'signin' && !users[cleanName]) {
      setMessage('No account found for this ID. Create one first.');
      return;
    }

    const passwordHash = await hashPassword(password);
    if (mode === 'signin' && users[cleanName].passwordHash !== passwordHash) {
      setMessage('Password is incorrect.');
      return;
    }

    const user = { username: cleanName, createdAt: users[cleanName]?.createdAt || Date.now() };
    if (mode === 'signup') {
      users[cleanName] = { ...user, passwordHash };
      localStorage.setItem('luci_users', JSON.stringify(users));
    }
    localStorage.setItem('luci_current_user', JSON.stringify(user));
    onAuth(user);
  }

  return (
    <main className="authShell">
      <div className="authBackdrop" />
      <form className="authPanel" onSubmit={submit}>
        <button className="authBrand" type="button">
          LUCI<span>TV</span>
        </button>
        <h1>{mode === 'signup' ? 'Create your profile' : 'Sign in'}</h1>
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="User ID" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
        {message && <p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit">{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        <button className="authSwitch" type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMessage(''); }}>
          {mode === 'signup' ? 'Already have an ID? Sign in' : 'New here? Create an ID'}
        </button>
      </form>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [activeType, setActiveType] = useState('trending');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [homeRows, setHomeRows] = useState([]);
  const [recent, setRecent] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState(null);
  const [heroItem, setHeroItem] = useState(null);
  const playerRef = useRef(null);

  const activeSection = useMemo(
    () => sections.find((section) => section.type === activeType) || sections[0],
    [activeType],
  );
  const isSearching = query.trim().length > 0;
  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);
  const filterOptions = useMemo(() => getFilterOptions(items), [items]);
  const similarItems = useMemo(() => {
    if (!player?.detail) return [];
    const terms = fieldText(player.detail).split(/\W+/).filter((term) => term.length > 4);
    return dedupe([...items, ...homeRows.flatMap((row) => row.items), ...watchlist, ...history])
      .filter((item) => item.id !== player.detail.id)
      .map((item) => ({
        item,
        score: terms.reduce((total, term) => total + (fieldText(item).includes(term) ? 1 : 0), 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((entry) => entry.item);
  }, [history, homeRows, items, player?.detail, watchlist]);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setRecent(getRecent(stored.username).map((item) => normalizeItem(item, item.contentType)));
      setWatchlist(getWatchlist(stored.username).map((item) => normalizeItem(item, item.contentType)));
      setHistory(getHistory(stored.username).map((item) => normalizeItem(item, item.contentType)));
      setReports(getReports(stored.username));
    }
    setActiveType(sessionStorage.getItem('luci_tab') || 'trending');
    setQuery(sessionStorage.getItem('luci_query') || '');
  }, []);

  useEffect(() => {
    if (!user) return;
    setRecent(getRecent(user.username).map((item) => normalizeItem(item, item.contentType)));
    setWatchlist(getWatchlist(user.username).map((item) => normalizeItem(item, item.contentType)));
    setHistory(getHistory(user.username).map((item) => normalizeItem(item, item.contentType)));
    setReports(getReports(user.username));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        if (isSearching) {
          const data = await globalSearch(query.trim(), controller.signal);
          setItems(data);
          setHomeRows([]);
          if (data[0]) setHeroItem(data[0]);
          return;
        }

        const sectionItems = await fetchSectionItems(activeSection, controller.signal);
        setItems(sectionItems);
        setHeroItem(sectionItems[0] || null);

        if (activeType === 'trending') {
          const rows = await Promise.all(
            [librarySections[1], librarySections[2], categorySections[1], qualitySections[2]].map(async (section) => {
              return {
                title: section.label,
                items: (await fetchSectionItems(section, controller.signal, '18')).slice(0, 18),
              };
            }),
          );
          setHomeRows(rows);
        } else {
          setHomeRows([]);
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message);
          setItems([]);
          setHomeRows([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, isSearching ? 320 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSection, activeType, isSearching, query, user]);

  function logout() {
    localStorage.removeItem('luci_current_user');
    setUser(null);
    setPlayer(null);
    setQuery('');
    setWatchlist([]);
    setHistory([]);
    setRecent([]);
    setReports([]);
    setFilters(defaultFilters);
  }

  function goHome() {
    setActiveType('trending');
    setQuery('');
    setPlayer(null);
    sessionStorage.setItem('luci_tab', 'trending');
    sessionStorage.removeItem('luci_query');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeTab(type) {
    setActiveType(type);
    setPlayer(null);
    setQuery('');
    setFilters(defaultFilters);
    sessionStorage.setItem('luci_tab', type);
    sessionStorage.removeItem('luci_query');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitSearch(event) {
    event.preventDefault();
    sessionStorage.setItem('luci_query', query.trim());
  }

  async function openItem(item) {
    const normalized = normalizeItem(item, item.contentType || activeSection.collection || activeSection.type);
    setPlayer({ item: normalized, detail: normalized, loading: true, stream: null });
    setHeroItem(normalized);

    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

    try {
      const payload = normalized.slug && normalized.contentType ? await fetchJson(detailUrl(normalized.contentType, normalized.slug)) : normalized;
      const detail = normalizeItem({ ...normalized, ...(payload.data || payload) }, normalized.contentType);
      setPlayer({ item: normalized, detail, loading: false, stream: null });

      const resumeDownload = findResumeDownload(detail, normalized.resume);
      if (resumeDownload) {
        startStream(resumeDownload, {
          detail,
          resumeAt: normalized.resume?.time || 0,
          shouldRemember: false,
        });
      }
    } catch {
      setPlayer({ item: normalized, detail: normalized, loading: false, stream: null });
    }
  }

  function rememberWatched(item, resume = item.resume || null) {
    if (!user) return;
    const withResume = { ...item, resume };
    setRecent(saveRecent(user.username, withResume).map((entry) => normalizeItem(entry, entry.contentType)));
    setHistory(saveHistory(user.username, withResume).map((entry) => normalizeItem(entry, entry.contentType)));
  }

  function toggleWatchlist(item) {
    if (!user || !item?.id) return;
    const normalized = normalizeItem(item, item.contentType || activeSection.collection || activeSection.type);
    const exists = watchlist.some((entry) => entry.id === normalized.id);
    const next = exists
      ? watchlist.filter((entry) => entry.id !== normalized.id)
      : [normalizeItem(compactItem(normalized, { savedAt: Date.now() }), normalized.contentType), ...watchlist].slice(0, 80);
    setWatchlist(saveWatchlist(user.username, next).map((entry) => normalizeItem(entry, entry.contentType)));
  }

  function changeFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  function reportBrokenStream(detail, stream, reason) {
    if (!user || !detail) return;
    const report = {
      id: `${detail.id}-${Date.now()}`,
      title: detail.title,
      contentType: detail.contentType,
      quality: stream?.quality || 'Unknown',
      server: stream?.server || '',
      reason,
      url: stream?.downloadUrl || '',
      resolvedUrl: stream?.resolvedUrl || '',
      createdAt: new Date().toISOString(),
    };
    setReports(saveReports(user.username, [report, ...getReports(user.username)].slice(0, 60)));
  }

  function clearReports() {
    if (!user) return;
    setReports(saveReports(user.username, []));
  }

  async function startStream(download, options = {}) {
    const resumeAt = options.resumeAt || 0;
    const streamSeed = { ...download, resumeAt, resolving: true };
    setPlayer((current) => ({
      ...current,
      stream: streamSeed,
      streamError: '',
    }));
    const detail = options.detail || player?.detail;
    if (detail && options.shouldRemember !== false) {
      rememberWatched(detail, {
        downloadUrl: download.downloadUrl,
        quality: download.quality,
        size: download.size,
        mediaKind: download.mediaKind || 'movie',
        seasonNumber: download.seasonNumber || null,
        episodeLabel: download.episodeLabel || '',
        time: resumeAt,
        duration: 0,
        updatedAt: Date.now(),
      });
    }

    try {
      const resolved = await resolveStream(download, options.preferredServer || download.server || '');
      setPlayer((current) => ({ ...current, stream: { ...resolved, resumeAt }, streamError: '' }));
    } catch (streamError) {
      setPlayer((current) => ({
        ...current,
        stream: { ...download, resumeAt, resolving: false },
        streamError: streamError.message,
      }));
    }
  }

  function updateProgress(detail, stream, time, duration) {
    if (!user || !detail || !stream?.downloadUrl) return;
    const resume = {
      downloadUrl: stream.downloadUrl,
      quality: stream.quality,
      size: stream.size,
      mediaKind: stream.mediaKind || 'movie',
      seasonNumber: stream.seasonNumber || null,
      episodeLabel: stream.episodeLabel || '',
      time: Math.max(0, Math.floor(time || 0)),
      duration: Math.max(0, Math.floor(duration || 0)),
      updatedAt: Date.now(),
    };
    setRecent(saveRecent(user.username, { ...detail, resume }).map((entry) => normalizeItem(entry, entry.contentType)));
    setHistory(saveHistory(user.username, { ...detail, resume }).map((entry) => normalizeItem(entry, entry.contentType)));
    setPlayer((current) => {
      if (!current?.detail?.id || current.detail.id !== detail.id) return current;
      return {
        ...current,
        detail: { ...current.detail, resume },
        item: { ...current.item, resume },
      };
    });
  }

  if (!user) return <AuthGate onAuth={setUser} />;

  const hero = heroItem || items[0];
  const visibleRows = [
    ...(watchlist.length ? [{ title: 'Watchlist', items: watchlist }] : []),
    ...(recent.length ? [{ title: 'Recent watched', items: recent }] : []),
    ...(history.length ? [{ title: 'History', items: history }] : []),
    ...homeRows,
  ];
  const currentInWatchlist = player?.detail ? watchlist.some((item) => item.id === player.detail.id) : false;

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={goHome} aria-label="Go to home">LUCI<span>TV</span></button>
        <nav className="tabs" aria-label="Categories">
          {navGroups.map((group) => (
            <div className="tabGroup" key={group.label}>
              <span className="tabGroupLabel">{group.label}</span>
              <div className="tabGroupButtons">
                {group.sections.map((section) => (
                  <button key={section.type} className={`tab ${activeType === section.type && !isSearching ? 'active' : ''}`} onClick={() => changeTab(section.type)}>
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="userArea">
          <span>{user.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      {hero && <Hero item={hero} onPlay={openItem} onWatchlist={toggleWatchlist} inWatchlist={watchlist.some((item) => item.id === hero.id)} />}

      <main className="main">
        <form className="searchRow" onSubmit={submitSearch}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all movies, series and platforms..." className="input" />
          <button type="submit" className="btn">Search</button>
        </form>

        <FilterBar filters={filters} options={filterOptions} total={items.length} shown={filteredItems.length} onChange={changeFilter} onClear={clearFilters} />

        {player && (
          <div ref={playerRef}>
            <Player
              player={player}
              onClose={() => setPlayer(null)}
              onStream={startStream}
              onProgress={updateProgress}
              onWatchlist={toggleWatchlist}
              inWatchlist={currentInWatchlist}
              onReport={reportBrokenStream}
              similarItems={similarItems}
              onSelectSimilar={openItem}
            />
          </div>
        )}

        {visibleRows.map((row) => <MediaRail key={row.title} title={row.title} items={row.items} onSelect={openItem} selectedId={player?.item.id} />)}

        {user.username === adminUsername && <AdminPanel reports={reports} onClear={clearReports} />}

        <p className="sectionLabel">{isSearching ? `Global results for "${query.trim()}"` : activeSection.label}</p>
        <MediaGrid items={filteredItems} loading={loading} error={error} selectedId={player?.item.id} onSelect={openItem} />
      </main>
    </div>
  );
}

function Hero({ item, onPlay, onWatchlist, inWatchlist }) {
  return (
    <section className="hero" style={{ backgroundImage: item.image ? `url(${item.image})` : undefined }}>
      <div className="heroShade" />
      <div className="heroContent">
        <span className="heroKicker">Now on Luci-TV</span>
        <h1>{item.title}</h1>
        <p>{item.overview || item.categories || 'Browse, stream and continue from your recent watched list.'}</p>
        <div className="heroActions">
          <button onClick={() => onPlay(item)}>Play</button>
          <button className="secondaryBtn" onClick={() => onWatchlist(item)}>{inWatchlist ? 'Saved' : 'Watchlist'}</button>
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </section>
  );
}

function FilterBar({ filters, options, total, shown, onChange, onClear }) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section className="filterBar" aria-label="Filters">
      <div className="filterStat">
        <strong>{shown}</strong>
        <span>{shown === total ? 'titles' : `of ${total}`}</span>
      </div>
      <label>
        <span>Genre</span>
        <select value={filters.genre} onChange={(event) => onChange('genre', event.target.value)}>
          <option value="">All</option>
          {options.genres.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select value={filters.year} onChange={(event) => onChange('year', event.target.value)}>
          <option value="">All</option>
          {options.years.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Quality</span>
        <select value={filters.quality} onChange={(event) => onChange('quality', event.target.value)}>
          <option value="">All</option>
          {options.qualities.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Language</span>
        <select value={filters.language} onChange={(event) => onChange('language', event.target.value)}>
          <option value="">All</option>
          {options.languages.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <button type="button" onClick={onClear} disabled={!hasFilters}>Clear</button>
    </section>
  );
}

function Player({ player, onClose, onStream, onProgress, onWatchlist, inWatchlist, onReport, similarItems, onSelectSimilar }) {
  const { detail, loading, stream, streamError } = player;
  const [streamFailed, setStreamFailed] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitle, setSubtitle] = useState(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const progressTick = useRef(0);
  const videoRef = useRef(null);
  const downloads = parseMovieLinks(detail.links || detail.cloudlinks);
  const seasons = parseSeasons(detail);
  const firstStream = downloads[0] || seasons[0]?.episodes[0]?.qualities[0] || null;
  const activeStreamUrl = stream?.resolvedUrl || '';
  const rawSourceUrl = stream?.downloadUrl || '';
  const resume = detail.resume;
  const format = stream?.contentType?.includes('mkv') ? 'MKV' : getVideoFormat(activeStreamUrl || rawSourceUrl || stream?.contentDisposition || stream?.formatHint);
  const browserPlayable = !stream || ['MP4', 'HLS', 'WebM', 'Auto'].includes(format);
  const playbackMessage = format === 'MKV'
    ? 'This source is an MKV file. Most browsers cannot play MKV directly, so use download/VLC or try another server.'
    : 'The source blocked browser playback or returned a file the browser cannot decode.';

  useEffect(() => {
    setStreamFailed(false);
    progressTick.current = 0;
  }, [stream?.downloadUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, activeStreamUrl]);

  useEffect(() => () => {
    if (subtitle?.url) URL.revokeObjectURL(subtitle.url);
  }, [subtitle?.url]);

  async function loadSubtitle(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (subtitle?.url) URL.revokeObjectURL(subtitle.url);
    setSubtitle({
      name: file.name,
      raw: text,
      url: buildSubtitleUrl(text, subtitleOffset),
    });
  }

  function changeSubtitleOffset(value) {
    const nextOffset = Number(value);
    setSubtitleOffset(nextOffset);
    if (!subtitle?.raw) return;
    if (subtitle.url) URL.revokeObjectURL(subtitle.url);
    setSubtitle({ ...subtitle, url: buildSubtitleUrl(subtitle.raw, nextOffset) });
  }

  async function enterPictureInPicture() {
    if (!videoRef.current || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      setStreamFailed(true);
    }
  }

  return (
    <section className="playerWrap">
      <div className="meta">
        <div className="metaTop">
          <h2 className="playerTitle">{detail.title}</h2>
          <button className="closeBtn" onClick={onClose} aria-label="Close player">x</button>
        </div>
        <div className="pills">
          {detail.year && <span className="pill">{detail.year}</span>}
          {detail.contentType && <span className="pill gold">{detail.contentType.replace('_', ' ')}</span>}
          {detail.categories && <span className="pill badge">{detail.categories.split(',').slice(0, 2).join(', ')}</span>}
          {detail.formatHint && <span className={`pill ${detail.formatHint === 'MP4' ? 'playable' : 'badge'}`}>{detail.formatHint} source</span>}
          {stream && <span className={`pill ${browserPlayable ? 'playable' : 'blocked'}`}>{format} stream</span>}
          {resume?.time > 8 && <span className="pill resume">Resume {resume.episodeLabel || resume.quality} at {formatResumeTime(resume.time)}</span>}
        </div>
        {detail.overview && <p className="overview">{detail.overview.slice(0, 240)}</p>}
        <div className="metaActions">
          <button type="button" onClick={() => onWatchlist(detail)}>{inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}</button>
        </div>
      </div>

      <div className="playerBox" style={{ backgroundImage: stream ? undefined : `url(${detail.image})` }}>
        {stream?.resolving ? (
          <div className="playerFallback">
            <strong>Preparing stream...</strong>
            <span>Resolving a fresh direct video link from the source.</span>
          </div>
        ) : stream && activeStreamUrl ? (
          <>
            <video
              ref={videoRef}
              src={activeStreamUrl}
              controls
              autoPlay
              playsInline
              onLoadedMetadata={(event) => {
                if (stream.resumeAt > 8 && stream.resumeAt < event.currentTarget.duration - 5) {
                  event.currentTarget.currentTime = stream.resumeAt;
                }
              }}
              onTimeUpdate={(event) => {
                const now = Date.now();
                if (now - progressTick.current < 5000) return;
                progressTick.current = now;
                onProgress(detail, stream, event.currentTarget.currentTime, event.currentTarget.duration);
              }}
              onPause={(event) => onProgress(detail, stream, event.currentTarget.currentTime, event.currentTarget.duration)}
              onError={() => setStreamFailed(true)}
            >
              {subtitle?.url && <track key={subtitle.url} src={subtitle.url} kind="subtitles" srcLang="en" label={subtitle.name || 'Custom'} default />}
            </video>
            {streamFailed && (
              <div className="playerFallback">
                <strong>Browser playback is not available for this file.</strong>
                <span>{playbackMessage}</span>
                <div className="fallbackActions">
                  <a href={activeStreamUrl || sourceUrl(rawSourceUrl)} target="_blank" rel="noreferrer">Open source</a>
                  <a href={downloadUrl(stream.downloadUrl)}>Download</a>
                  <button type="button" onClick={() => onReport(detail, stream, playbackMessage)}>Report link</button>
                </div>
              </div>
            )}
          </>
        ) : streamError ? (
          <div className="playerFallback">
            <strong>Stream could not be prepared.</strong>
            <span>{streamError}</span>
            <div className="fallbackActions">
              <a href={sourceUrl(rawSourceUrl)} target="_blank" rel="noreferrer">Open raw link</a>
              <a href={downloadUrl(rawSourceUrl)}>Try download</a>
            </div>
          </div>
        ) : (
          <button
            className="startBtn"
            disabled={!firstStream}
            onClick={() => firstStream && onStream(firstStream)}
            type="button"
          >
            Play
          </button>
        )}
      </div>

      <section className="playerTools">
        <div className="toolGroup">
          <span>Speed</span>
          <select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}>
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => <option value={speed} key={speed}>{speed}x</option>)}
          </select>
        </div>
        <button type="button" onClick={enterPictureInPicture} disabled={!activeStreamUrl}>Picture in picture</button>
        {stream?.allServers?.length > 1 && (
          <div className="serverGroup">
            <span>Servers</span>
            {stream.allServers.map((server) => (
              <button
                type="button"
                className={server === stream.server ? 'active' : ''}
                onClick={() => onStream(stream, { preferredServer: server })}
                key={server}
              >
                {server}
              </button>
            ))}
          </div>
        )}
        <label className="subtitleUpload">
          <span>{subtitle?.name || 'Custom subtitles'}</span>
          <input type="file" accept=".vtt,.srt,text/vtt" onChange={loadSubtitle} />
        </label>
        <div className="toolGroup">
          <span>Subtitle sync</span>
          <input type="number" step="0.5" min="-30" max="30" value={subtitleOffset} onChange={(event) => changeSubtitleOffset(event.target.value)} />
          <small>sec</small>
        </div>
      </section>

      {loading && <p className="empty">Loading full title details...</p>}

      {!loading && Boolean(downloads.length) && (
        <section className="downloads">
          <p className="sectionLabel">Downloads</p>
          <div className="downloadList">
            {downloads.slice(0, 8).map((download, index) => (
              <DownloadRow download={download} active={stream?.downloadUrl === download.downloadUrl} onStream={onStream} key={`${download.downloadUrl}-${index}`} />
            ))}
          </div>
        </section>
      )}

      {!loading && Boolean(seasons.length) && (
        <section className="downloads">
          <p className="sectionLabel">Seasons</p>
          <div className="seasonList">
            {seasons.slice(0, 8).map((season) => (
              <div className="seasonGroup" key={season.seasonNumber}>
                <h3>Season {season.seasonNumber}</h3>
                <p>{season.header}</p>
                {season.episodes.slice(0, 12).map((episode) => (
                  <div className="episodeRow" key={`${season.seasonNumber}-${episode.label}`}>
                    <span>{episode.label}</span>
                    <div className="episodeDownloads">
                      {episode.qualities.map((download, index) => (
                        <DownloadRow compact download={download} active={stream?.downloadUrl === download.downloadUrl} onStream={onStream} key={`${episode.label}-${index}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && Boolean(similarItems.length) && (
        <MediaRail title="Similar titles" items={similarItems} selectedId={detail.id} onSelect={onSelectSimilar} />
      )}
    </section>
  );
}

function DownloadRow({ download, onStream, active = false, compact = false }) {
  return (
    <div className={`downloadRow ${compact ? 'compact' : ''} ${active ? 'selected' : ''}`}>
      <div className="downloadMeta">
        <strong>{download.quality}</strong>
        <span>{download.size || 'Available'}{download.formatHint ? ` · ${download.formatHint}` : ''}</span>
      </div>
      <div className="downloadActions">
        <button type="button" onClick={() => onStream(download)}>Stream</button>
        <a href={downloadUrl(download.downloadUrl)}>Download</a>
      </div>
    </div>
  );
}

function AdminPanel({ reports, onClear }) {
  return (
    <section className="adminPanel">
      <div className="railHeader">
        <h2>Admin tools</h2>
        <span>{reports.length} broken stream reports</span>
      </div>
      {!reports.length ? (
        <p className="adminEmpty">No broken links reported.</p>
      ) : (
        <>
          <div className="reportList">
            {reports.slice(0, 8).map((report) => (
              <div className="reportRow" key={report.id}>
                <div>
                  <strong>{report.title}</strong>
                  <span>{report.quality} {report.server ? `via ${report.server}` : ''}</span>
                </div>
                <p>{report.reason}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={onClear}>Clear reports</button>
        </>
      )}
    </section>
  );
}

function MediaRail({ title, items, selectedId, onSelect }) {
  if (!items.length) return null;

  return (
    <section className="rail">
      <div className="railHeader">
        <h2>{title}</h2>
        <span>{items.length} titles</span>
      </div>
      <div className="railTrack">
        {items.map((item) => (
          <MediaCard item={item} selected={item.id === selectedId} onClick={onSelect} key={`${title}-${item.id}`} />
        ))}
      </div>
    </section>
  );
}

function MediaGrid({ items, loading, error, selectedId, onSelect }) {
  if (loading) {
    return (
      <div className="grid">
        {Array.from({ length: 12 }).map((_, index) => <div className="skeleton" key={index} />)}
      </div>
    );
  }

  if (error) return <p className="empty">{error}</p>;
  if (!items.length) return <p className="empty">No results found.</p>;

  return (
    <div className="grid">
      {items.map((item) => (
        <MediaCard item={item} selected={item.id === selectedId} onClick={onSelect} key={item.id} />
      ))}
    </div>
  );
}

function MediaCard({ item, selected, onClick }) {
  const resume = item.resume;

  return (
    <button className={`card ${selected ? 'selected' : ''}`} onClick={() => onClick(item)}>
      <div className="poster">
        {item.image ? <img src={item.image} alt={item.title} loading="lazy" /> : <div className="noPoster">{item.title.slice(0, 2)}</div>}
        {resume?.time > 8 && (
          <span className="continueTag">Continue {resume.episodeLabel || formatResumeTime(resume.time)}</span>
        )}
      </div>
      <div className="info">
        {item.year && <span className="rating">{item.year}</span>}
        <div className="title">{item.title}</div>
        <div className="year">{item.contentType?.replace('_', ' ')}</div>
      </div>
    </button>
  );
}

export default App;
