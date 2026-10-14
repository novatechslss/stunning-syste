import { listDir, getFile } from './github-storage.js';
import { toPublic } from './upload-service.js';
import { ID_RE } from './ids.js';

const MAX_SCAN = 100; // newest N records scanned when filtering by type
const TREE_TTL_MS = 30000;
let treeCache = { at: 0, ids: [] };
const metaCache = new Map(); // metadata files are immutable once written

export function clearCatalogueCache() {
  treeCache = { at: 0, ids: [] };
  metaCache.clear();
}

async function recentIds(cfg) {
  if (Date.now() - treeCache.at < TREE_TTL_MS) return treeCache.ids;
  const names = await listDir(cfg, 'metadata');
  const ids = names
    .filter((n) => n.endsWith('.json'))
    .map((n) => n.slice(0, -5))
    .filter((id) => ID_RE.test(id))
    .sort()
    .reverse(); // IDs start with a base36 timestamp => newest first
  treeCache = { at: Date.now(), ids };
  return ids;
}

export async function readMetadata(cfg, id) {
  if (!ID_RE.test(id)) return null;
  if (metaCache.has(id)) return metaCache.get(id);
  const f = await getFile(cfg, `metadata/${id}.json`);
  if (!f) return null;
  let meta;
  try {
    meta = JSON.parse(f.buffer.toString('utf8'));
  } catch {
    return null;
  }
  if (!meta || meta.id !== id || meta.status !== 'stored') return null;
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(id, meta);
  return meta;
}

async function readMany(cfg, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batch = await Promise.all(ids.slice(i, i + 8).map((id) => readMetadata(cfg, id).catch(() => null)));
    out.push(...batch);
  }
  return out.filter(Boolean);
}

/** Bounded, paginated newest-first listing. Returns only public-safe fields. */
export async function listMedia(cfg, { page = 1, limit = 12, type = 'all', q = '' }) {
  let ids = await recentIds(cfg);
  if (q) ids = ids.filter((id) => id.includes(q));
  const start = (page - 1) * limit;
  if (type === 'all') {
    const items = await readMany(cfg, ids.slice(start, start + limit));
    return { items: items.map(toPublic), page, limit, total: ids.length, scanLimited: false };
  }
  const scanned = await readMany(cfg, ids.slice(0, MAX_SCAN));
  const filtered = scanned.filter((m) => m.mediaType === type);
  return {
    items: filtered.slice(start, start + limit).map(toPublic),
    page,
    limit,
    total: filtered.length,
    scanLimited: ids.length > MAX_SCAN
  };
}
