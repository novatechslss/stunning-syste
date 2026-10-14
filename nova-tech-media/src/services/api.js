export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0, retryAfter = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function parse(res) {
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const e = (json && json.error) || {};
    throw new ApiError(e.message || `Request failed (${res.status}).`, {
      code: e.code || 'ERROR',
      status: res.status,
      retryAfter: res.headers.get('Retry-After')
    });
  }
  return json;
}

async function get(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('Network problem. Check your connection and try again.', { code: 'NETWORK' });
  }
  return parse(res);
}

export const fetchConfig = () => get('/api/v1/config');
export const fetchMedia = (id) => get(`/api/v1/media/${encodeURIComponent(id)}`);
export const fetchList = ({ page = 1, type = 'all', q = '' }) => {
  const p = new URLSearchParams({ page: String(page), type });
  if (q) p.set('q', q);
  return get(`/api/v1/media?${p}`);
};

/** Real upload progress via XHR. Resolves with the server's JSON; rejects with ApiError. */
export function uploadFile(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    form.append('website', ''); // honeypot: must stay empty
    xhr.open('POST', '/api/web/upload');
    xhr.setRequestHeader('X-Nova-Client', 'web');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300 && body && body.success) return resolve(body);
      const e = (body && body.error) || {};
      reject(
        new ApiError(e.message || `Upload failed (${xhr.status}).`, {
          code: e.code || 'ERROR',
          status: xhr.status,
          retryAfter: xhr.getResponseHeader('Retry-After')
        })
      );
    };
    xhr.onerror = () => reject(new ApiError('Network problem. Check your connection and retry.', { code: 'NETWORK' }));
    xhr.ontimeout = () => reject(new ApiError('The upload timed out. Retry on a faster connection.', { code: 'TIMEOUT' }));
    xhr.timeout = 60000;
    if (signal) signal.addEventListener('abort', () => xhr.abort());
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', { code: 'ABORTED' }));
    xhr.send(form);
  });
}

// ---- Browser-local history (this device only; the server keeps no per-user data) ----
const KEY = 'nova-media-history-v1';
export function readHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function addHistory(item) {
  try {
    const next = [item, ...readHistory().filter((h) => h.id !== item.id)].slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---- Formatting ----
export function formatBytes(n) {
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}
export const formatLocal = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
};
export function summaryText(m) {
  return [
    `ID: ${m.id}`,
    `URL: ${m.url || m.publicUrl || 'none (private storage, no public link)'}`,
    `Uploaded (UTC): ${m.createdAt}`,
    `Type: ${m.mimeType}`,
    `Size: ${formatBytes(m.sizeBytes)}`
  ].join('\n');
}
