'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const sections = [
  { label: 'Movies', type: 'movies', path: '/api/movies' },
  { label: 'Series', type: 'hollywood_series', path: '/api/hollywood_series' },
  { label: 'Anime', type: 'anime', path: '/api/anime' },
  { label: 'Bolly Movies', type: 'bollywood_movies', path: '/api/bollywood_movies' },
  { label: 'Bolly Series', type: 'bollywood_series', path: '/api/bollywood_series' },
  { label: 'Trending', type: 'trending', path: '/api/trending', flat: true },
  { label: 'Dual Audio', type: 'dual', path: '/rpc/category/dual', flat: true },
  { label: 'Netflix', type: 'netflix', path: '/rpc/platform/netflix', flat: true },
  { label: 'Disney+', type: 'disney', path: '/rpc/platform/disney', flat: true },
  { label: 'Amazon', type: 'amazon', path: '/rpc/platform/amazon', flat: true },
  { label: 'Apple TV+', type: 'apple', path: '/rpc/platform/apple', flat: true },
  { label: 'Zee5', type: 'zee5', path: '/rpc/platform/zee5', flat: true },
  { label: 'SonyLIV', type: 'sony', path: '/rpc/platform/sony', flat: true },
  { label: 'JioHotstar', type: 'jiohotstar', path: '/rpc/platform/jiohotstar', flat: true },
  { label: 'Hollywood Movies', type: 'hollywood_movies', path: '/api/hollywood_movies' },
  { label: 'KDrama', type: 'kdrama', path: '/api/kdrama' },
  { label: 'Chinese Drama', type: 'chinese_drama', path: '/api/chinese_drama' },
  { label: 'TV Shows', type: 'tvshows', path: '/api/tvshows' },
];

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

function normalizeItem(item, fallbackType) {
  const contentType = item.contentType || item.source_table || fallbackType;
  const image = item.featured_image || item.poster;

  return {
    ...item,
    id: item._id || item.record_id || item.url_slug || item.title,
    title: decodeText(item.title || 'Untitled'),
    image,
    contentType,
    year: getYear(item),
    categories: decodeText(item.categories || ''),
    overview: decodeText(item.excerpt || item.content || item.categories || ''),
    slug: item.url_slug,
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

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed: ${res.status}`);
  }

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

function buildSectionUrl(section, query) {
  const params = new URLSearchParams();
  if (section.path.startsWith('/rpc/')) {
    params.set('limit', '300');
  } else {
    params.set('offset', '0');
    params.set('limit', query ? '80' : '500');
  }
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

function App() {
  const [activeType, setActiveType] = useState('movies');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState(null);
  const playerRef = useRef(null);

  const activeSection = useMemo(
    () => sections.find((section) => section.type === activeType) || sections[0],
    [activeType],
  );

  useEffect(() => {
    setActiveType(sessionStorage.getItem('luci_tab') || 'movies');
    setQuery(sessionStorage.getItem('luci_query') || '');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await fetchJson(buildSectionUrl(activeSection, query.trim()), controller.signal);
        const parsed = parseList(payload, activeSection.type);
        const filtered = query.trim()
          ? parsed.data.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
          : parsed.data;
        setItems(filtered);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message);
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 260 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSection, query]);

  function goHome() {
    setActiveType('movies');
    setQuery('');
    setPlayer(null);
    sessionStorage.setItem('luci_tab', 'movies');
    sessionStorage.removeItem('luci_query');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeTab(type) {
    setActiveType(type);
    setPlayer(null);
    sessionStorage.setItem('luci_tab', type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitSearch(event) {
    event.preventDefault();
    sessionStorage.setItem('luci_query', query.trim());
  }

  async function openItem(item) {
    const normalized = normalizeItem(item, item.contentType || activeSection.type);
    setPlayer({ item: normalized, detail: normalized, loading: true, stream: null });

    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    try {
      const detailPath = detailUrl(normalized.contentType, normalized.slug);
      const payload = await fetchJson(detailPath);
      const detail = normalizeItem({ ...normalized, ...(payload.data || payload) }, normalized.contentType);
      setPlayer({ item: normalized, detail, loading: false, stream: null });
    } catch {
      setPlayer({ item: normalized, detail: normalized, loading: false, stream: null });
    }
  }

  function closePlayer() {
    setPlayer(null);
  }

  async function startStream(download) {
    setPlayer((current) => ({
      ...current,
      stream: {
        ...download,
        resolving: true,
      },
      streamError: '',
    }));

    try {
      const resolved = await resolveStream(download);
      setPlayer((current) => ({ ...current, stream: resolved, streamError: '' }));
    } catch (streamError) {
      setPlayer((current) => ({
        ...current,
        stream: {
          ...download,
          resolving: false,
        },
        streamError: streamError.message,
      }));
    }
  }

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={goHome} aria-label="Go to home">
          <span className="logoAccent">Luci</span><span className="logoDot">·</span>TV
        </button>
        <nav className="tabs" aria-label="Categories">
          {sections.map((section) => (
            <button
              key={section.type}
              className={`tab ${activeType === section.type ? 'active' : ''}`}
              onClick={() => changeTab(section.type)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        <form className="searchRow" onSubmit={submitSearch}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${activeSection.label.toLowerCase()}...`}
            className="input"
          />
          <button type="submit" className="btn">Search</button>
        </form>

        {player && (
          <div ref={playerRef}>
            <Player
              player={player}
              onClose={closePlayer}
              onStream={startStream}
            />
          </div>
        )}

        <p className="sectionLabel">{query.trim() ? 'Results' : activeSection.label}</p>
        <MediaGrid
          items={items}
          loading={loading}
          error={error}
          selectedId={player?.item.id}
          onSelect={openItem}
        />
      </main>

      <footer className="footer">
        <p className="footerText">
          &copy; {new Date().getFullYear()} Luci-TV | Digital Entertainment Democratized
        </p>
      </footer>
    </div>
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
