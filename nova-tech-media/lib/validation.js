import { HttpError } from './http-errors.js';

export const FORMATS = {
  jpeg: { kind: 'image', mime: 'image/jpeg', mimes: ['image/jpeg'], ext: 'jpg', aliases: ['jpg', 'jpeg'] },
  png: { kind: 'image', mime: 'image/png', mimes: ['image/png'], ext: 'png', aliases: ['png'] },
  webp: { kind: 'image', mime: 'image/webp', mimes: ['image/webp'], ext: 'webp', aliases: ['webp'] },
  gif: { kind: 'image', mime: 'image/gif', mimes: ['image/gif'], ext: 'gif', aliases: ['gif'] },
  mp4: { kind: 'video', mime: 'video/mp4', mimes: ['video/mp4'], ext: 'mp4', aliases: ['mp4'] },
  webm: { kind: 'video', mime: 'video/webm', mimes: ['video/webm'], ext: 'webm', aliases: ['webm'] },
  mov: { kind: 'video', mime: 'video/quicktime', mimes: ['video/quicktime'], ext: 'mov', aliases: ['mov'] }
};

const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'f4v ', 'm4v ', 'msnv', 'ndsc', 'mmp4'
]);

/** Identify the real format from magic bytes. Returns a FORMATS key or null. */
export function detectFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  const head6 = buf.toString('latin1', 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return buf.toString('latin1', 0, Math.min(64, buf.length)).includes('webm') ? 'webm' : null;
  }
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12).toLowerCase();
    if (brand === 'qt  ') return 'mov';
    if (MP4_BRANDS.has(brand)) return 'mp4';
  }
  return null;
}

export function extensionOf(name) {
  const base = String(name || '').split(/[\\/]/).pop();
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

export function sanitizeName(name) {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  const clean = base
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[. ]+/, '')
    .trim()
    .slice(0, 100);
  return clean || 'upload';
}

export function allowedFormatKeys(cfg) {
  const keys = new Set();
  for (const ext of cfg.allowedFormats) {
    for (const [key, f] of Object.entries(FORMATS)) if (f.aliases.includes(ext)) keys.add(key);
  }
  return keys;
}

/**
 * Server-side authority on what may be stored. Checks size, magic bytes,
 * extension and declared MIME type. Never trusts the browser.
 */
export function validateUpload({ buffer, filename, declaredMime }, cfg) {
  if (!buffer || buffer.length === 0) throw new HttpError(400, 'EMPTY_FILE', 'The file is empty.');
  if (buffer.length > cfg.maxUploadBytes) {
    throw new HttpError(413, 'FILE_TOO_LARGE', `File is larger than the ${(cfg.maxUploadBytes / 1048576).toFixed(1)} MB limit.`);
  }
  const key = detectFormat(buffer);
  if (!key) {
    throw new HttpError(415, 'INVALID_SIGNATURE', 'The file contents do not match a supported image or video format.');
  }
  if (!allowedFormatKeys(cfg).has(key)) {
    throw new HttpError(415, 'FORMAT_NOT_ALLOWED', `${FORMATS[key].ext.toUpperCase()} files are not allowed on this server.`);
  }
  const fmt = FORMATS[key];
  if (!fmt.aliases.includes(extensionOf(filename))) {
    throw new HttpError(415, 'EXTENSION_MISMATCH', 'The file extension does not match the file contents.');
  }
  const mime = String(declaredMime || '').split(';')[0].trim().toLowerCase();
  if (mime && !fmt.mimes.includes(mime) && mime !== 'application/octet-stream') {
    throw new HttpError(415, 'MIME_MISMATCH', 'The declared content type does not match the file contents.');
  }
  return { format: key, kind: fmt.kind, mimeType: fmt.mime, ext: fmt.ext, originalName: sanitizeName(filename) };
}
