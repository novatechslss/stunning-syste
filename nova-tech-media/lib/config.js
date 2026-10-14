const num = (v, d) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const bool = (v) => String(v ?? '').trim().toLowerCase() === 'true';
const list = (v, d = '') => String(v || d).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Vercel rejects serverless request bodies above ~4.5 MB. Leave headroom for multipart overhead. */
export const VERCEL_BODY_CAP_MB = 4.4;

/** MEDIA_API_KEYS="id:sha256hex,id2:sha256hex" -> [{id, hash}] (invalid entries are ignored). */
export function parseApiKeys(raw) {
  const out = [];
  for (const part of String(raw || '').split(',')) {
    const [id, hash] = part.trim().split(':');
    if (id && /^[a-z0-9_-]{1,32}$/i.test(id) && hash && /^[0-9a-f]{64}$/i.test(hash)) {
      out.push({ id, hash: hash.toLowerCase() });
    }
  }
  return out;
}

export function getConfig(env = process.env) {
  let maxMb = num(env.MEDIA_MAX_UPLOAD_MB, 4);
  if (env.VERCEL && maxMb > VERCEL_BODY_CAP_MB) maxMb = VERCEL_BODY_CAP_MB;
  const base = String(env.MEDIA_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return {
    github: {
      owner: env.MEDIA_GITHUB_OWNER || '',
      repo: env.MEDIA_GITHUB_REPO || '',
      branch: env.MEDIA_GITHUB_BRANCH || 'main',
      token: env.MEDIA_GITHUB_TOKEN || ''
    },
    repoVisibility: String(env.MEDIA_REPO_VISIBILITY || '').toLowerCase() === 'public' ? 'public' : 'private',
    publicBaseUrl: base.startsWith('https://') ? base : '',
    maxUploadBytes: Math.floor(maxMb * 1024 * 1024),
    allowedFormats: list(env.MEDIA_ALLOWED_TYPES, 'jpg,jpeg,png,webp,gif,mp4,webm,mov'),
    uploadsDisabled: bool(env.MEDIA_UPLOADS_DISABLED),
    apiKeys: parseApiKeys(env.MEDIA_API_KEYS),
    trustedProxy: (env.MEDIA_TRUSTED_PROXY || (env.VERCEL ? 'vercel' : 'none')).toLowerCase(),
    rateWindowMs: Math.floor(num(env.MEDIA_RATE_WINDOW_MIN, 60) * 60000),
    webRateLimit: Math.floor(num(env.MEDIA_WEB_RATE_LIMIT, 10)),
    apiRateLimit: Math.floor(num(env.MEDIA_API_RATE_LIMIT, 120)),
    globalDailyLimit: Math.floor(num(env.MEDIA_GLOBAL_DAILY_LIMIT, 500)),
    requestTimeoutMs: 25000,
    githubTimeoutMs: 15000,
    publicList: bool(env.MEDIA_ENABLE_PUBLIC_LIST),
    publicLookup: bool(env.MEDIA_ENABLE_PUBLIC_LOOKUP),
    enableDelete: bool(env.MEDIA_ENABLE_DELETE),
    allowedOrigins: list(env.MEDIA_ALLOWED_ORIGINS),
    serverUrl: String(env.MEDIA_SERVER_URL || '').trim().replace(/\/+$/, '')
  };
}

export function isStorageConfigured(cfg) {
  const g = cfg.github;
  const ok = (s) => /^[A-Za-z0-9_.-]+$/.test(s);
  return Boolean(g.token && ok(g.owner) && ok(g.repo) && /^[A-Za-z0-9_./-]+$/.test(g.branch));
}

/** Safe, secret-free configuration for the frontend. */
export function publicConfig(cfg, req) {
  const host = req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  const proto = (req && req.headers && req.headers['x-forwarded-proto']) || 'https';
  const origin = cfg.serverUrl || (host ? `${String(proto).split(',')[0]}://${String(host).split(',')[0]}` : '');
  return {
    apiBaseUrl: origin ? `${origin}/api/v1` : '/api/v1',
    maxUploadBytes: cfg.maxUploadBytes,
    allowedFormats: cfg.allowedFormats,
    uploadsDisabled: cfg.uploadsDisabled,
    repoVisibility: cfg.repoVisibility,
    publicLinks: cfg.repoVisibility === 'public',
    publicListEnabled: cfg.publicList,
    publicLookupEnabled: cfg.publicLookup,
    deleteEnabled: cfg.enableDelete,
    webRateLimit: cfg.webRateLimit,
    apiRateLimit: cfg.apiRateLimit,
    rateWindowMinutes: Math.round(cfg.rateWindowMs / 60000)
  };
}
