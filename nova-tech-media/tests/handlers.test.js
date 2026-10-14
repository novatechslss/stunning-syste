import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webUpload, apiUpload, mediaById, health } from '../lib/handlers.js';
import { resetRateLimits } from '../lib/rate-limit.js';
import { clearCatalogueCache } from '../lib/catalogue.js';
import { useEnv, mockReq, mockRes, multipart, fakeGithub, JPEG, FAKE_JPEG, RAW_KEY } from './helpers.js';

const call = async (h, opts) => { const res = mockRes(); await h(mockReq(opts), res); return res; };
const web = (buf = JPEG, name = 'a.jpg', mime = 'image/jpeg', extra = {}) => {
  const m = multipart(buf, name, mime, extra);
  return { headers: { ...m.headers, origin: 'https://site.test', 'x-nova-client': 'web' }, body: m.body };
};
const api = (key = RAW_KEY, buf = JPEG) => {
  const m = multipart(buf, 'a.jpg', 'image/jpeg');
  return { headers: { ...m.headers, ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: m.body };
};

beforeEach(() => { useEnv(); resetRateLimits(); clearCatalogueCache(); });
afterEach(() => vi.unstubAllGlobals());

describe('website upload', () => {
  it('stores a valid upload and returns the result', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const r = await call(webUpload, web());
    expect(r.statusCode).toBe(201);
    expect(r.json).toMatchObject({ success: true, mediaType: 'image', mimeType: 'image/jpeg' });
    expect(r.json.id).toMatch(/^[0-9a-z]{9}[0-9a-f]{24}$/);
  });
  it('rejects requests not from the website origin', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const o = web(); o.headers.origin = 'https://evil.test';
    expect((await call(webUpload, o)).json.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
  it('rejects a spoofed file signature', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const r = await call(webUpload, web(FAKE_JPEG));
    expect(r.statusCode).toBe(415);
  });
  it('rejects oversized requests before buffering', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const o = web(); o.headers['content-length'] = String(50 * 1024 * 1024);
    const r = await call(webUpload, o);
    expect(r.statusCode).toBe(413);
    expect(gh.fn).not.toHaveBeenCalled();
  });
  it('rate limits repeated uploads', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    await call(webUpload, web()); await call(webUpload, web());
    const r = await call(webUpload, web());
    expect(r.statusCode).toBe(429);
    expect(r.headers['retry-after']).toBeDefined();
  });
  it('honours the emergency disable switch', async () => {
    useEnv({ MEDIA_UPLOADS_DISABLED: 'true' });
    expect((await call(webUpload, web())).json.error.code).toBe('UPLOADS_DISABLED');
  });
  it('rejects the honeypot field', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    expect((await call(webUpload, web(JPEG, 'a.jpg', 'image/jpeg', { website: 'spam' }))).statusCode).toBe(400);
  });
});

describe('API upload', () => {
  it('requires an API key', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const r = await call(apiUpload, api(null));
    expect(r.statusCode).toBe(401);
    expect(r.json.error.code).toBe('MISSING_API_KEY');
  });
  it('rejects an invalid key', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const r = await call(apiUpload, api('nova_wrong_key_0123456789abcdef'));
    expect(r.json.error.code).toBe('INVALID_API_KEY');
  });
  it('uploads with a valid key and records uploadMethod=api', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const r = await call(apiUpload, api());
    expect(r.statusCode).toBe(201);
    const meta = JSON.parse(gh.files.get(`metadata/${r.json.id}.json`).buf.toString());
    expect(meta.uploadMethod).toBe('api');
    expect(JSON.stringify(meta)).not.toContain(RAW_KEY);
  });
  it('applies per-key rate limits', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    for (let i = 0; i < 3; i++) await call(apiUpload, api());
    expect((await call(apiUpload, api())).statusCode).toBe(429);
  });
  it('returns a safe error when GitHub fails', async () => {
    vi.stubGlobal('fetch', fakeGithub({ failPut: /./ }).fn);
    const r = await call(apiUpload, api());
    expect(r.statusCode).toBe(502);
    expect(r.body).not.toContain('ghp_');
  });
});

describe('media lookup and deletion', () => {
  it('requires a key for metadata when public lookup is off', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const r = await call(mediaById, { method: 'GET', query: { id: 'a'.repeat(9) + 'b'.repeat(24) } });
    expect(r.statusCode).toBe(401);
  });
  it('hides repo paths and gives null URL for private repos', async () => {
    useEnv({ MEDIA_REPO_VISIBILITY: 'private' });
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const up = await call(apiUpload, api());
    expect(up.json.url).toBeNull();
    const r = await call(mediaById, { method: 'GET', query: { id: up.json.id }, headers: { authorization: `Bearer ${RAW_KEY}` } });
    expect(r.json.media.publicUrl).toBeNull();
    expect(r.body).not.toContain('storedPath');
  });
  it('blocks unauthorized and disabled deletion', async () => {
    const gh = fakeGithub(); vi.stubGlobal('fetch', gh.fn);
    const up = await call(apiUpload, api());
    expect((await call(mediaById, { method: 'DELETE', query: { id: up.json.id } })).json.error.code).toBe('DELETE_DISABLED');
    useEnv({ MEDIA_ENABLE_DELETE: 'true' });
    expect((await call(mediaById, { method: 'DELETE', query: { id: up.json.id } })).statusCode).toBe(401);
    expect(gh.files.size).toBe(2);
    const ok = await call(mediaById, { method: 'DELETE', query: { id: up.json.id }, headers: { authorization: `Bearer ${RAW_KEY}` } });
    expect(ok.statusCode).toBe(200);
    expect(gh.files.size).toBe(0);
  });
  it('rejects malformed IDs (path traversal attempts)', async () => {
    vi.stubGlobal('fetch', fakeGithub().fn);
    const r = await call(mediaById, { method: 'GET', query: { id: '../../etc/passwd' }, headers: { authorization: `Bearer ${RAW_KEY}` } });
    expect(r.statusCode).toBe(400);
  });
});

describe('health', () => {
  it('returns minimal info only', async () => {
    const r = await call(health, { method: 'GET' });
    expect(Object.keys(r.json).sort()).toEqual(['status', 'time', 'uploadsEnabled']);
    expect(r.body).not.toContain('ghp_');
  });
});
