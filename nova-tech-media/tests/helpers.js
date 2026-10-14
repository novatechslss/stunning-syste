import { Readable } from 'node:stream';
import { vi } from 'vitest';
import { hashKey } from '../lib/auth.js';

export const RAW_KEY = 'nova_test_key_0123456789abcdef0123456789';
export const ENV = {
  MEDIA_GITHUB_OWNER: 'octo', MEDIA_GITHUB_REPO: 'media', MEDIA_GITHUB_BRANCH: 'main', MEDIA_GITHUB_TOKEN: 'ghp_secret_token',
  MEDIA_REPO_VISIBILITY: 'public', MEDIA_MAX_UPLOAD_MB: '1', MEDIA_API_KEYS: `bot1:${hashKey(RAW_KEY)}`,
  MEDIA_WEB_RATE_LIMIT: '2', MEDIA_API_RATE_LIMIT: '3'
};
export function useEnv(extra = {}) {
  for (const k of Object.keys(process.env)) if (k.startsWith('MEDIA_')) delete process.env[k];
  Object.assign(process.env, ENV, extra);
}

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
export const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64, 2)]);
export const FAKE_JPEG = Buffer.from('<?php echo 1; ?>'.padEnd(64, ' '));

export function multipart(buf, filename, mime, extra = {}) {
  const b = '----novaboundary';
  const parts = [];
  for (const [k, v] of Object.entries(extra)) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`), buf, Buffer.from(`\r\n--${b}--\r\n`));
  const body = Buffer.concat(parts);
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${b}`, 'content-length': String(body.length) } };
}

export function mockReq({ method = 'POST', headers = {}, body = null, query = {} } = {}) {
  const stream = Readable.from(body ? [body] : []);
  stream.method = method;
  stream.headers = { host: 'site.test', ...headers };
  stream.query = query;
  stream.socket = { remoteAddress: '1.2.3.4' };
  return stream;
}
export function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b || ''; res.done = true; };
  Object.defineProperty(res, 'json', { get: () => JSON.parse(res.body) });
  return res;
}

/** In-memory fake of the GitHub contents/trees API. */
export function fakeGithub({ failPut = null, failDelete = false, status = 500, conflictOnce = false } = {}) {
  let conflicted = !conflictOnce;
  const files = new Map();
  const calls = [];
  const fn = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || 'GET';
    calls.push({ method, path: u.pathname });
    const m = u.pathname.match(/\/contents\/(.+)$/);
    const path = m && decodeURIComponent(m[1]);
    const resp = (st, json, headers = {}) => new Response(JSON.stringify(json), { status: st, headers });
    if (method === 'PUT') {
      if (failPut && failPut.test(path)) return resp(status, { message: 'boom ghp_secret_token' });
      if (!conflicted && path.startsWith('img/')) { conflicted = true; return resp(422, { message: 'exists' }); }
      if (files.has(path)) return resp(422, { message: 'sha wasn\'t supplied' });
      const buf = Buffer.from(JSON.parse(init.body).content, 'base64');
      files.set(path, { buf, sha: 'sha_' + files.size });
      return resp(201, { content: { sha: files.get(path).sha } });
    }
    if (method === 'GET' && path) {
      const f = files.get(path);
      return f ? resp(200, { sha: f.sha, content: f.buf.toString('base64') }) : resp(404, {});
    }
    if (method === 'DELETE') {
      if (failDelete) return resp(500, {});
      return files.delete(path) ? resp(200, {}) : resp(404, {});
    }
    if (u.pathname.includes('/git/trees/')) {
      const tree = [...files.keys()].filter((k) => k.startsWith('metadata/')).map((k) => ({ path: k.slice(9), type: 'blob' }));
      return resp(200, { tree });
    }
    return resp(404, {});
  });
  return { fn, files, calls };
}
