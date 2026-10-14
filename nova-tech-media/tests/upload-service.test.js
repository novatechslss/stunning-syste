import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storeUpload, publicUrlFor } from '../lib/upload-service.js';
import { getConfig } from '../lib/config.js';
import { ENV, JPEG, MP4, fakeGithub } from './helpers.js';

const cfg = getConfig(ENV);
afterEach(() => vi.unstubAllGlobals());

describe('storeUpload', () => {
  it('stores image + metadata after GitHub confirms', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const m = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg);
    expect(m.storedPath).toMatch(/^img\/\d{4}\/\d{2}\/[0-9a-z]{33}\.jpg$/);
    expect(gh.files.has(`metadata/${m.id}.json`)).toBe(true);
    expect(m.publicUrl).toContain('raw.githubusercontent.com/octo/media/main/img/');
    expect(m.uploadMethod).toBe('website');
  });
  it('stores video under videos/', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const m = await storeUpload({ buffer: MP4, filename: 'a.mp4', declaredMime: 'video/mp4', method: 'api' }, cfg);
    expect(m.storedPath.startsWith('videos/')).toBe(true);
    expect(m.uploadMethod).toBe('api');
  });
  it('never creates a public URL for a private repo', async () => {
    const priv = getConfig({ ...ENV, MEDIA_REPO_VISIBILITY: 'private' });
    expect(publicUrlFor(priv, 'img/x.jpg')).toBeNull();
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const m = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, priv);
    expect(m.publicUrl).toBeNull();
  });
  it('retries with a new ID on a path conflict and never overwrites', async () => {
    const gh = fakeGithub({ conflictOnce: true }); vi.stubGlobal('fetch', gh.fn);
    const m = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg);
    expect(gh.calls.filter((c) => c.method === 'PUT' && c.path.includes('/img/')).length).toBe(2);
    expect(gh.files.has(m.storedPath)).toBe(true);
  });
  it('reports GitHub upload failure safely without leaking the token', async () => {
    const gh = fakeGithub({ failPut: /^img\//, status: 500 }); vi.stubGlobal('fetch', gh.fn);
    const err = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg).catch((e) => e);
    expect(err.code).toBe('GITHUB_ERROR');
    expect(JSON.stringify({ m: err.message })).not.toContain('ghp_');
    expect(gh.files.size).toBe(0);
  });
  it('rolls back the file when the metadata write fails', async () => {
    const gh = fakeGithub({ failPut: /^metadata\// }); vi.stubGlobal('fetch', gh.fn);
    const err = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg).catch((e) => e);
    expect(err.code).toBe('METADATA_FAILED');
    expect(gh.files.size).toBe(0);
  });
  it('reports an orphan honestly if rollback also fails', async () => {
    const gh = fakeGithub({ failPut: /^metadata\//, failDelete: true }); vi.stubGlobal('fetch', gh.fn);
    const err = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg).catch((e) => e);
    expect(err.code).toBe('METADATA_FAILED_ORPHAN');
  });
  it('maps network timeouts to a safe error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ETIMEDOUT'); }));
    const err = await storeUpload({ buffer: JPEG, filename: 'a.jpg', declaredMime: 'image/jpeg', method: 'website' }, cfg).catch((e) => e);
    expect(err.code).toBe('GITHUB_UNREACHABLE');
  });
});
