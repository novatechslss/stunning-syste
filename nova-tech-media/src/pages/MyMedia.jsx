import { useCallback, useEffect, useState } from 'react';
import { Search, Images } from 'lucide-react';
import { fetchList, fetchMedia, readHistory, clearHistory } from '../services/api.js';
import { GridSkeleton, EmptyState } from '../components/States.jsx';
import ResultCard, { Preview } from '../components/ResultCard.jsx';
import { useToast } from '../components/Toast.jsx';

const PER_PAGE = 8;

export default function MyMedia({ config }) {
  const remote = config.publicListEnabled;
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, items: [], total: 0, error: null, scanLimited: false });
  const [found, setFound] = useState(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (remote) {
        const r = await fetchList({ page, type, q: query });
        setState({ loading: false, items: r.items, total: r.total, error: null, scanLimited: r.scanLimited });
      } else {
        const all = readHistory().filter((h) => (type === 'all' || h.mediaType === type) && (!query || h.id.includes(query)));
        setState({ loading: false, items: all.slice((page - 1) * PER_PAGE, page * PER_PAGE), total: all.length, error: null, scanLimited: false });
      }
    } catch (e) {
      setState({ loading: false, items: [], total: 0, error: e.message, scanLimited: false });
    }
  }, [remote, page, type, query]);

  useEffect(() => { load(); }, [load]);

  const perPage = remote ? 12 : PER_PAGE;
  const pages = Math.max(1, Math.ceil(state.total / perPage));

  async function lookup(e) {
    e.preventDefault();
    const id = q.trim().toLowerCase();
    if (!id) return;
    if (config.publicLookupEnabled) {
      try {
        const r = await fetchMedia(id);
        setFound(r.media);
      } catch (err) {
        setFound(null);
        push(err.message, 'error');
      }
    } else {
      setQuery(id);
      setPage(1);
    }
  }

  return (
    <div className="page">
      <h1>My media</h1>
      <p className="lead">
        {remote
          ? 'Recent uploads from this site, newest first. The operator has turned on public browsing.'
          : 'Uploads made from this browser. This list lives only on this device, because the site has no accounts or database.'}
      </p>

      <form className="toolbar" onSubmit={lookup} role="search">
        <label className="field">
          <span className="sr">Search by media ID</span>
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) { setQuery(''); setFound(null); } }} placeholder="Search by media ID" inputMode="text" autoComplete="off" />
        </label>
        <button className="btn btn-primary" type="submit">Search</button>
        <div className="chips" role="group" aria-label="Filter by type">
          {['all', 'image', 'video'].map((t) => (
            <button key={t} type="button" className={`chip ${type === t ? 'on' : ''}`} aria-pressed={type === t} onClick={() => { setType(t); setPage(1); }}>
              {t === 'all' ? 'All' : t === 'image' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>
      </form>

      {found && <ResultCard media={found} />}
      {state.error && <div className="card notice" role="alert"><p>{state.error}</p><button className="btn btn-primary" onClick={load}>Try again</button></div>}
      {state.loading && <GridSkeleton />}
      {!state.loading && !state.error && state.items.length === 0 && (
        <EmptyState icon={Images} title="Nothing here yet" action={<a className="btn btn-primary" href="#/upload">Upload media</a>}>
          {query || type !== 'all' ? 'No media matches these filters.' : 'Uploaded files will appear here.'}
        </EmptyState>
      )}
      {!state.loading && state.items.length > 0 && (
        <div className="media-grid">
          {state.items.map((m) => (
            <article key={m.id} className="card media-card">
              <Preview media={m} className="thumb" />
              <strong className="wrap">{m.originalName || m.id}</strong>
              <span className="mono muted wrap">{m.id}</span>
              <button className="btn btn-ghost" onClick={() => setFound(m)}>Details</button>
            </article>
          ))}
        </div>
      )}
      {state.scanLimited && <p className="hint">Type filters look at the newest 100 uploads only.</p>}

      <div className="pager">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
      {!remote && readHistory().length > 0 && (
        <button className="btn btn-ghost" onClick={() => { clearHistory(); setPage(1); load(); push('Local list cleared', 'success'); }}>
          Clear this browser's list
        </button>
      )}
    </div>
  );
}
