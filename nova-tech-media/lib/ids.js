import crypto from 'node:crypto';

/** 9 chars of base36 time (sortable) + 96 bits of CSPRNG randomness (unguessable). */
export function newId(now = Date.now()) {
  return now.toString(36).padStart(9, '0') + crypto.randomBytes(12).toString('hex');
}
export const ID_RE = /^[0-9a-z]{9}[0-9a-f]{24}$/;
