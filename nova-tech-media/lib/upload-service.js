import { putFile, getFile, deleteFile, PathConflictError } from './github-storage.js';
import { validateUpload } from './validation.js';
import { newId } from './ids.js';
import { HttpError } from './http-errors.js';

const pad = (n) => String(n).padStart(2, '0');

export function buildPaths(id, validated, now = new Date()) {
  const dir = validated.kind === 'image' ? 'img' : 'videos';
  const stored = `${dir}/${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${id}.${validated.ext}`;
  return { storedPath: stored, metadataPath: `metadata/${id}.json` };
}

export function publicUrlFor(cfg, storedPath) {
  if (cfg.repoVisibility !== 'public') return null;
  const base = cfg.publicBaseUrl || `https://raw.githubusercontent.com/${cfg.github.owner}/${cfg.github.repo}/${cfg.github.branch}`;
  return `${base}/${storedPath}`;
}

/** Fields safe to show to API/website clients. Never includes the repo path. */
export function toPublic(meta) {
  return {
    id: meta.id,
    originalName: meta.originalName,
    mediaType: meta.mediaType,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    createdAt: meta.createdAt,
    publicUrl: meta.publicUrl || null,
    uploadMethod: meta.uploadMethod,
    status: meta.status
  };
}

/**
 * The single upload pipeline used by BOTH the website route and the bot API:
 * validate -> unique ID -> store file -> store metadata (only after the file is confirmed).
 */
export async function storeUpload({ buffer, filename, declaredMime, method }, cfg, { now = () => new Date() } = {}) {
  const validated = validateUpload({ buffer, filename, declaredMime }, cfg);

  let id = null;
  let paths = null;
  let created = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const candidate = newId();
    const p = buildPaths(candidate, validated, now());
    try {
      await putFile(cfg, p.storedPath, buffer, `upload ${candidate}`);
      id = candidate;
      paths = p;
      created = true;
    } catch (e) {
      if (!(e instanceof PathConflictError)) throw e;
    }
  }
  if (!created) throw new HttpError(503, 'ID_CONFLICT', 'Could not allocate a unique ID. Please try again.');

  const createdAt = now().toISOString();
  const meta = {
    id,
    originalName: validated.originalName,
    storedPath: paths.storedPath,
    mediaType: validated.kind,
    mimeType: validated.mimeType,
    sizeBytes: buffer.length,
    createdAt,
    publicUrl: publicUrlFor(cfg, paths.storedPath),
    uploadMethod: method,
    status: 'stored'
  };

  try {
    await putFile(cfg, paths.metadataPath, Buffer.from(JSON.stringify(meta, null, 2)), `metadata ${id}`);
  } catch (metaErr) {
    // Metadata failed after the file was saved: try to roll the file back so no orphan remains.
    let cleaned = false;
    try {
      const f = await getFile(cfg, paths.storedPath);
      if (f) cleaned = await deleteFile(cfg, paths.storedPath, f.sha, `rollback ${id}`);
    } catch {
      cleaned = false;
    }
    if (cleaned) {
      throw new HttpError(502, 'METADATA_FAILED', 'The upload could not be completed and nothing was kept. Please try again.');
    }
    console.error('[nova] orphan file left in storage, id:', id);
    throw new HttpError(
      502,
      'METADATA_FAILED_ORPHAN',
      `The file was stored but its record could not be saved, and cleanup failed. Do not rely on this upload. Report reference ${id} to the site operator.`
    );
  }
  return meta;
}
