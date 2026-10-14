import { HttpError } from './http-errors.js';

const API = 'https://api.github.com';
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(cfg, method, path, body) {
  const { owner, repo, token } = cfg.github;
  const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nova-tech-media',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(cfg.githubTimeoutMs)
    });
  } catch {
    throw new HttpError(504, 'GITHUB_UNREACHABLE', 'The storage service did not respond in time. Please try again.');
  }
  return res;
}

/** Maps unexpected GitHub statuses to safe public errors (never forwards GitHub's body). */
function failFrom(res) {
  const limited =
    res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
  if (limited) {
    throw new HttpError(503, 'GITHUB_RATE_LIMITED', 'The storage service is rate limited right now. Try again shortly.', {
      'Retry-After': '60'
    });
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    console.error('[nova] github config/permission problem, status', res.status);
    throw new HttpError(502, 'STORAGE_MISCONFIGURED', 'The storage backend is not configured correctly. Tell the site operator.');
  }
  console.error('[nova] github error, status', res.status);
  throw new HttpError(502, 'GITHUB_ERROR', 'The storage service returned an error. Please try again.');
}

export class PathConflictError extends Error {}

/** Creates a NEW file. Never overwrites: GitHub answers 422 if the path already exists. */
export async function putFile(cfg, path, buffer, message) {
  const body = { message, content: buffer.toString('base64'), branch: cfg.github.branch };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await gh(cfg, 'PUT', `/contents/${enc(path)}`, body);
    if (res.status === 201 || res.status === 200) {
      const json = await res.json();
      return { sha: json.content && json.content.sha };
    }
    if (res.status === 422) throw new PathConflictError(path);
    if (res.status === 409 && attempt < 3) {
      // Another commit landed on the branch at the same moment; retry.
      await sleep(150 + Math.random() * 350 * (attempt + 1));
      continue;
    }
    failFrom(res);
  }
  throw new HttpError(503, 'GITHUB_BUSY', 'The storage service is busy. Please try again.');
}

/** Returns { sha, buffer } or null if the file does not exist. */
export async function getFile(cfg, path) {
  const res = await gh(cfg, 'GET', `/contents/${enc(path)}?ref=${encodeURIComponent(cfg.github.branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) failFrom(res);
  const json = await res.json();
  if (Array.isArray(json)) return null;
  return { sha: json.sha, buffer: Buffer.from(json.content || '', 'base64') };
}

export async function deleteFile(cfg, path, sha, message) {
  const res = await gh(cfg, 'DELETE', `/contents/${enc(path)}`, { message, sha, branch: cfg.github.branch });
  if (res.status === 404) return false;
  if (!res.ok) failFrom(res);
  return true;
}

/** Lists file names in a directory via the git tree API (no 1000-entry cap). */
export async function listDir(cfg, dir) {
  const res = await gh(cfg, 'GET', `/git/trees/${encodeURIComponent(cfg.github.branch)}:${enc(dir)}`);
  if (res.status === 404) return [];
  if (!res.ok) failFrom(res);
  const json = await res.json();
  return (json.tree || []).filter((e) => e.type === 'blob').map((e) => e.path);
}
