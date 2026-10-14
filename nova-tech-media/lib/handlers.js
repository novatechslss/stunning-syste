// Handler logic lives here (not in /api) so Vercel only creates functions for real routes
// and tests can call it directly.
import { getConfig, isStorageConfigured, publicConfig } from './config.js';
import { HttpError, sendJson, sendError, applyCors, requireMethod, enforceRate, rateHeaders } from './http-errors.js';
import { authenticate, requireAuth } from './auth.js';
import { rateLimit, clientIp } from './rate-limit.js';
import { parseMultipart } from './multipart.js';
import { storeUpload, toPublic } from './upload-service.js';
import { readMetadata, listMedia } from './catalogue.js';
import { getFile, deleteFile } from './github-storage.js';
import { ID_RE } from './ids.js';

const DAY = 24 * 60 * 60 * 1000;

function guardUploads(cfg) {
  if (cfg.uploadsDisabled) throw new HttpError(503, 'UPLOADS_DISABLED', 'Uploads are temporarily disabled by the site operator.');
  if (!isStorageConfigured(cfg)) throw new HttpError(503, 'NOT_CONFIGURED', 'Storage is not configured on this server yet.');
}

function uploadResponse(cfg, meta) {
  return {
    success: true,
    id: meta.id,
    url: meta.publicUrl,
    visibility: meta.publicUrl ? 'public-link' : 'private-no-link',
    createdAt: meta.createdAt,
    mediaType: meta.mediaType,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    originalName: meta.originalName
  };
}

function wrap(fn, methods) {
  return async function handler(req, res) {
    const cfg = getConfig();
    try {
      if (applyCors(req, res, cfg)) return;
      requireMethod(req, methods);
      await fn(req, res, cfg);
    } catch (err) {
      sendError(res, err);
    }
  };
}

function sameOrigin(req, cfg) {
  const origin = String(req.headers.origin || '').toLowerCase();
  if (!origin) return false;
  if (cfg.allowedOrigins.includes(origin)) return true;
  try {
    return new URL(origin).host === String(req.headers.host || '').toLowerCase();
  } catch {
    return false;
  }
}

/** POST /api/web/upload  - anonymous website uploads with anti-abuse controls. */
export const webUpload = wrap(async (req, res, cfg) => {
  guardUploads(cfg);
  if (!sameOrigin(req, cfg) || req.headers['x-nova-client'] !== 'web') {
    throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Uploads must come from the NOVA TECH MEDIA website.');
  }
  const ip = clientIp(req, cfg);
  const rl = rateLimit(`web:${ip}`, cfg.webRateLimit, cfg.rateWindowMs);
  enforceRate(rl, 'Upload limit reached for your connection. Please wait before uploading again.');
  enforceRate(rateLimit('global-daily', cfg.globalDailyLimit, DAY), 'The site has reached its daily upload limit. Try again tomorrow.');

  const { file, fields } = await parseMultipart(req, cfg);
  if (fields.website) throw new HttpError(400, 'REJECTED', 'Request rejected.'); // honeypot field
  const meta = await storeUpload(
    { buffer: file.buffer, filename: file.filename, declaredMime: file.mimeType, method: 'website' },
    cfg
  );
  sendJson(res, 201, uploadResponse(cfg, meta), rateHeaders(rl));
}, ['POST']);

/** POST /api/v1/upload  - authenticated bot/API uploads. */
export const apiUpload = wrap(async (req, res, cfg) => {
  guardUploads(cfg);
  const ip = clientIp(req, cfg);
  let auth;
  try {
    auth = requireAuth(req, cfg);
  } catch (e) {
    // Throttle repeated bad keys per IP (best effort).
    enforceRate(rateLimit(`authfail:${ip}`, 30, 15 * 60000), 'Too many failed authentication attempts.');
    throw e;
  }
  const rl = rateLimit(`key:${auth.keyId}`, cfg.apiRateLimit, cfg.rateWindowMs);
  enforceRate(rl, 'API key rate limit reached. Slow down and retry later.');
  const { file } = await parseMultipart(req, cfg);
  const meta = await storeUpload(
    { buffer: file.buffer, filename: file.filename, declaredMime: file.mimeType, method: 'api' },
    cfg
  );
  sendJson(res, 201, uploadResponse(cfg, meta), rateHeaders(rl));
}, ['POST']);

/** GET|DELETE /api/v1/media/:id */
export const mediaById = wrap(async (req, res, cfg) => {
  const id = String((req.query && req.query.id) || '').toLowerCase();
  const ip = clientIp(req, cfg);
  enforceRate(rateLimit(`media:${ip}`, 120, 60000));
  if (!isStorageConfigured(cfg)) throw new HttpError(503, 'NOT_CONFIGURED', 'Storage is not configured on this server yet.');

  if (req.method === 'DELETE') {
    if (!cfg.enableDelete) throw new HttpError(403, 'DELETE_DISABLED', 'Deletion is disabled on this server.');
    requireAuth(req, cfg);
  } else if (!authenticate(req, cfg) && !cfg.publicLookup) {
    throw new HttpError(401, 'MISSING_API_KEY', 'Send your API key as: Authorization: Bearer YOUR_API_KEY', { 'WWW-Authenticate': 'Bearer' });
  }
  if (!ID_RE.test(id)) throw new HttpError(400, 'INVALID_ID', 'That is not a valid media ID.');
  const meta = await readMetadata(cfg, id);
  if (!meta) throw new HttpError(404, 'NOT_FOUND', 'No media found with that ID.');

  if (req.method === 'DELETE') {
    const file = await getFile(cfg, meta.storedPath);
    if (file) await deleteFile(cfg, meta.storedPath, file.sha, `delete ${id}`);
    const metaFile = await getFile(cfg, `metadata/${id}.json`);
    if (metaFile) await deleteFile(cfg, `metadata/${id}.json`, metaFile.sha, `delete metadata ${id}`);
    return sendJson(res, 200, { success: true, id, deleted: true });
  }
  sendJson(res, 200, { success: true, media: toPublic(meta) });
}, ['GET', 'DELETE']);

/** GET /api/v1/media  - bounded recent list, only when the operator enabled it (or a valid key is sent). */
export const mediaList = wrap(async (req, res, cfg) => {
  if (!cfg.publicList && !authenticate(req, cfg)) {
    throw new HttpError(403, 'LIST_DISABLED', 'Public browsing is not enabled on this server.');
  }
  if (!isStorageConfigured(cfg)) throw new HttpError(503, 'NOT_CONFIGURED', 'Storage is not configured on this server yet.');
  enforceRate(rateLimit(`list:${clientIp(req, cfg)}`, 60, 60000));
  const qs = req.query || {};
  const page = Math.min(Math.max(parseInt(qs.page, 10) || 1, 1), 1000);
  const limit = Math.min(Math.max(parseInt(qs.limit, 10) || 12, 1), 24);
  const type = ['image', 'video'].includes(qs.type) ? qs.type : 'all';
  const q = /^[0-9a-z]{1,40}$/.test(String(qs.q || '').toLowerCase()) ? String(qs.q).toLowerCase() : '';
  const result = await listMedia(cfg, { page, limit, type, q });
  sendJson(res, 200, { success: true, ...result });
}, ['GET']);

/** GET /api/v1/health  - minimal, no environment details. */
export const health = wrap(async (req, res, cfg) => {
  sendJson(res, 200, { status: 'ok', uploadsEnabled: !cfg.uploadsDisabled && isStorageConfigured(cfg), time: new Date().toISOString() });
}, ['GET']);

/** GET /api/v1/config  - secret-free settings for the frontend. */
export const configInfo = wrap(async (req, res, cfg) => {
  sendJson(res, 200, publicConfig(cfg, req));
}, ['GET']);
