'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const librarySections = [
  { label: 'Trending', type: 'trending', group: 'Library', path: '/api/trending', flat: true },
  { label: 'Movies', type: 'movies', group: 'Library', path: '/api/movies', collection: 'movies' },
  { label: 'Series', type: 'series', group: 'Library', path: '/api/series', collection: 'series' },
  { label: 'Anime', type: 'anime', group: 'Library', path: '/api/anime', collection: 'anime' },
  { label: 'Bolly Movies', type: 'bollywood_movies', group: 'Library', path: '/api/bollywood_movies', collection: 'bollywood_movies' },
  { label: 'Bolly Series', type: 'bollywood_series', group: 'Library', path: '/api/bollywood_series', collection: 'bollywood_series' },
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
const globalSearchSections = [...librarySections.filter((item) => item.type !== 'trending'), ...platformSections];
const HICINE_ORIGIN = 'https://api.hicine.info';
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || HICINE_ORIGIN;

function apiUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
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

function resolveCollection(item, fallbackType) {
  const source = item.contentType || item.source_table || item.collection || fallbackType;
  const aliases = {
    hollywood_movies: 'movies',
    hollywood_series: 'series',
    bolly_movies: 'bollywood_movies',
    bolly_series: 'bollywood_series',
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
    if (parsed?.episodes.length) seasons.push({ seasonNumber: i, ...parsed });
  }
  const zip = parseSeason(item.season_zip);
  if (zip?.episodes.length) seasons.push({ seasonNumber: 'ZIP', ...zip });
  return seasons;
}

function buildSectionUrl(section, query = '', limitOverride) {
  const params = new URLSearchParams();
  if (section.path.startsWith('/rpc/')) {
    params.set('limit', limitOverride || '300');
  } else {
    params.set('offset', '0');
    params.set('limit', limitOverride || (query ? '80' : '60'));
  }
  if (section.category) params.set('category', section.category);
  if (query) {
    params.set('search', query);
    params.set('q', query);
  }
  return `${section.path}?${params.toString()}`;
}

function detailUrl(contentType, slug) {
  if (!contentType || !slug) return '';
  return `/api/${contentType}/${slug}`;
}

function downloadUrl(rawUrl) {
  return `/api/resolve-stream?url=${encodeURIComponent(rawUrl)}&redirect=true`;
}

function sourceUrl(rawUrl) {
  return rawUrl;
}

async function resolveStream(download) {
  const response = await fetch(`/api/resolve-stream?url=${encodeURIComponent(download.downloadUrl)}`);
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

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('luci_current_user');
  return raw ? JSON.parse(raw) : null;
}

function getRecent(username) {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(recentKey(username)) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(username, item) {
  if (!username || !item?.id) return [];
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
    slug: item.slug,
    url_slug: item.slug,
    watchedAt: Date.now(),
  };
  const next = [compact, ...getRecent(username).filter((entry) => entry.id !== item.id)].slice(0, 24);
  localStorage.setItem(recentKey(username), JSON.stringify(next));
  return next;
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
  const results = await Promise.allSettled(
    globalSearchSections.map(async (section) => {
      const payload = await fetchJson(buildSectionUrl(section, section.path.startsWith('/rpc/') ? '' : query, section.path.startsWith('/rpc/') ? '300' : '30'), signal);
      const parsed = parseList(payload, section.collection || section.type).data;
      const filtered = section.path.startsWith('/rpc/')
        ? parsed.filter((item) => item.title.toLowerCase().includes(lowered))
        : parsed;
      return filtered.map((item) => ({ ...item, searchGroup: section.label }));
    }),
  );

  return dedupe(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))).slice(0, 120);
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

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setRecent(getRecent(stored.username).map((item) => normalizeItem(item, item.contentType)));
    }
    setActiveType(sessionStorage.getItem('luci_tab') || 'trending');
    setQuery(sessionStorage.getItem('luci_query') || '');
  }, []);

  useEffect(() => {
    if (!user) return;
    setRecent(getRecent(user.username).map((item) => normalizeItem(item, item.contentType)));
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

        const payload = await fetchJson(buildSectionUrl(activeSection, ''), controller.signal);
        const parsed = parseList(payload, activeSection.collection || activeSection.type);
        setItems(parsed.data);
        setHeroItem(parsed.data[0] || null);

        if (activeType === 'trending') {
          const rows = await Promise.all(
            [librarySections[1], platformSections[0], categorySections[1], qualitySections[2]].map(async (section) => {
              const rowPayload = await fetchJson(buildSectionUrl(section, '', '18'), controller.signal);
              return {
                title: section.label,
                items: parseList(rowPayload, section.collection || section.type).data.slice(0, 18),
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
    } catch {
      setPlayer({ item: normalized, detail: normalized, loading: false, stream: null });
    }
  }

  function rememberWatched(item) {
    if (!user) return;
    setRecent(saveRecent(user.username, item).map((entry) => normalizeItem(entry, entry.contentType)));
  }

  async function startStream(download) {
    setPlayer((current) => ({
      ...current,
      stream: { ...download, resolving: true },
      streamError: '',
    }));
    if (player?.detail) rememberWatched(player.detail);

    try {
      const resolved = await resolveStream(download);
      setPlayer((current) => ({ ...current, stream: resolved, streamError: '' }));
    } catch (streamError) {
      setPlayer((current) => ({
        ...current,
        stream: { ...download, resolving: false },
        streamError: streamError.message,
      }));
    }
  }

  if (!user) return <AuthGate onAuth={setUser} />;

  const hero = heroItem || items[0];
  const visibleRows = [
    ...(recent.length ? [{ title: 'Recent watched', items: recent }] : []),
    ...homeRows,
  ];

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

      {hero && <Hero item={hero} onPlay={openItem} />}

      <main className="main">
        <form className="searchRow" onSubmit={submitSearch}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all movies, series and platforms..." className="input" />
          <button type="submit" className="btn">Search</button>
        </form>

        {player && (
          <div ref={playerRef}>
            <Player player={player} onClose={() => setPlayer(null)} onStream={startStream} />
          </div>
        )}

        {visibleRows.map((row) => <MediaRail key={row.title} title={row.title} items={row.items} onSelect={openItem} selectedId={player?.item.id} />)}

        <p className="sectionLabel">{isSearching ? `Global results for "${query.trim()}"` : activeSection.label}</p>
        <MediaGrid items={items} loading={loading} error={error} selectedId={player?.item.id} onSelect={openItem} />
      </main>
    </div>
  );
}

function Hero({ item, onPlay }) {
  return (
    <section className="hero" style={{ backgroundImage: item.image ? `url(${item.image})` : undefined }}>
      <div className="heroShade" />
      <div className="heroContent">
        <span className="heroKicker">Now on Luci-TV</span>
        <h1>{item.title}</h1>
        <p>{item.overview || item.categories || 'Browse, stream and continue from your recent watched list.'}</p>
        <div className="heroActions">
          <button onClick={() => onPlay(item)}>Play</button>
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </section>
  );
}

function Player({ player, onClose, onStream }) {
  const { detail, loading, stream, streamError } = player;
  const [streamFailed, setStreamFailed] = useState(false);
  const downloads = parseMovieLinks(detail.links || detail.cloudlinks);
  const seasons = parseSeasons(detail);
  const firstStream = downloads[0] || seasons[0]?.episodes[0]?.qualities[0] || null;
  const activeStreamUrl = stream?.resolvedUrl || '';
  const rawSourceUrl = stream?.downloadUrl || '';

  useEffect(() => {
    setStreamFailed(false);
  }, [stream?.downloadUrl]);

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
        </div>
        {detail.overview && <p className="overview">{detail.overview.slice(0, 240)}</p>}
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
              src={activeStreamUrl}
              controls
              autoPlay
              playsInline
              onError={() => setStreamFailed(true)}
            />
            {streamFailed && (
              <div className="playerFallback">
                <strong>Browser playback is not available for this file.</strong>
                <span>Try opening the resolved source directly, or download it to play in VLC/MX Player.</span>
                <div className="fallbackActions">
                  <a href={activeStreamUrl || sourceUrl(rawSourceUrl)} target="_blank" rel="noreferrer">Open source</a>
                  <a href={downloadUrl(stream.downloadUrl)}>Download</a>
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
    </section>
  );
}

function DownloadRow({ download, onStream, active = false, compact = false }) {
  return (
    <div className={`downloadRow ${compact ? 'compact' : ''} ${active ? 'selected' : ''}`}>
      <div className="downloadMeta">
        <strong>{download.quality}</strong>
        <span>{download.size || 'Available'}</span>
      </div>
      <div className="downloadActions">
        <button type="button" onClick={() => onStream(download)}>Stream</button>
        <a href={downloadUrl(download.downloadUrl)}>Download</a>
      </div>
    </div>
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
  return (
    <button className={`card ${selected ? 'selected' : ''}`} onClick={() => onClick(item)}>
      <div className="poster">
        {item.image ? <img src={item.image} alt={item.title} loading="lazy" /> : <div className="noPoster">{item.title.slice(0, 2)}</div>}
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
