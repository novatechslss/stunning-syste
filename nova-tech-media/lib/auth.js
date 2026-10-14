import crypto from 'node:crypto';
import { HttpError } from './http-errors.js';

export const hashKey = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/** Returns { keyId } for a valid Bearer key, or null. Compares SHA-256 digests in constant time. */
export function authenticate(req, cfg) {
  const header = String(req.headers.authorization || '');
  const m = /^Bearer\s+(\S{16,200})$/i.exec(header);
  if (!m || cfg.apiKeys.length === 0) return null;
  const presented = Buffer.from(hashKey(m[1]), 'hex');
  let found = null;
  for (const k of cfg.apiKeys) {
    const stored = Buffer.from(k.hash, 'hex');
    if (stored.length === presented.length && crypto.timingSafeEqual(stored, presented)) found = k.id;
  }
  return found ? { keyId: found } : null;
}

export function requireAuth(req, cfg) {
  const hasHeader = Boolean(req.headers.authorization);
  const auth = authenticate(req, cfg);
  if (!auth) {
    throw new HttpError(
      401,
      hasHeader ? 'INVALID_API_KEY' : 'MISSING_API_KEY',
      hasHeader ? 'The API key is not valid.' : 'Send your API key as: Authorization: Bearer YOUR_API_KEY',
      { 'WWW-Authenticate': 'Bearer' }
    );
  }
  return auth;
}
