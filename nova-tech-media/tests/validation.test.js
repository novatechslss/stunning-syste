import { describe, it, expect } from 'vitest';
import { validateUpload, sanitizeName } from '../lib/validation.js';
import { getConfig } from '../lib/config.js';
import { JPEG, MP4, FAKE_JPEG, ENV } from './helpers.js';

const cfg = getConfig(ENV);
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };

describe('validation', () => {
  it('accepts a valid image', () => {
    const v = validateUpload({ buffer: JPEG, filename: 'a.jpeg', declaredMime: 'image/jpeg' }, cfg);
    expect(v).toMatchObject({ kind: 'image', ext: 'jpg', mimeType: 'image/jpeg' });
  });
  it('accepts a valid video', () => {
    const v = validateUpload({ buffer: MP4, filename: 'clip.mp4', declaredMime: 'video/mp4' }, cfg);
    expect(v).toMatchObject({ kind: 'video', ext: 'mp4' });
  });
  it('rejects a bad file signature', () => {
    expect(code(() => validateUpload({ buffer: FAKE_JPEG, filename: 'x.jpg', declaredMime: 'image/jpeg' }, cfg))).toBe('INVALID_SIGNATURE');
  });
  it('rejects oversized files', () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(cfg.maxUploadBytes)]);
    expect(code(() => validateUpload({ buffer: big, filename: 'x.jpg', declaredMime: 'image/jpeg' }, cfg))).toBe('FILE_TOO_LARGE');
  });
  it('rejects extension and MIME mismatches', () => {
    expect(code(() => validateUpload({ buffer: JPEG, filename: 'x.png', declaredMime: 'image/jpeg' }, cfg))).toBe('EXTENSION_MISMATCH');
    expect(code(() => validateUpload({ buffer: JPEG, filename: 'x.jpg', declaredMime: 'video/mp4' }, cfg))).toBe('MIME_MISMATCH');
  });
  it('rejects formats the operator disabled', () => {
    const c = getConfig({ ...ENV, MEDIA_ALLOWED_TYPES: 'png' });
    expect(code(() => validateUpload({ buffer: JPEG, filename: 'x.jpg', declaredMime: 'image/jpeg' }, c))).toBe('FORMAT_NOT_ALLOWED');
  });
  it('sanitizes names and blocks traversal', () => {
    expect(sanitizeName('../../etc/pass wd.jpg')).toBe('pass wd.jpg');
    expect(sanitizeName('')).toBe('upload');
  });
});
