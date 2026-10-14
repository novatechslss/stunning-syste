import { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileImage, Film, RotateCw, X, AlertTriangle } from 'lucide-react';
import { uploadFile, addHistory, formatBytes, ApiError } from '../services/api.js';
import { useToast } from './Toast.jsx';
import ResultCard from './ResultCard.jsx';

const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};

/** Quick client-side hints only. The server re-validates everything. */
export function precheck(file, config) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!config.allowedFormats.includes(ext)) {
    return `.${ext || '?'} files are not allowed. Allowed: ${config.allowedFormats.join(', ')}.`;
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > config.maxUploadBytes) {
    return `Too large (${formatBytes(file.size)}). The limit is ${formatBytes(config.maxUploadBytes)}.`;
  }
  return null;
}

export default function Uploader({ config }) {
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const { push } = useToast();
  const accept = config.allowedFormats.map((e) => '.' + e).join(',');

  useEffect(() => () => itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []);

  const patch = (key, p) => setItems((s) => s.map((i) => (i.key === key ? { ...i, ...p } : i)));

  function addFiles(fileList) {
    const next = Array.from(fileList).map((file) => {
      const error = precheck(file, config);
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      return {
        key, file, error, status: error ? 'invalid' : 'ready', progress: 0, result: null,
        preview: error ? null : URL.createObjectURL(file),
        isVideo: (file.type || EXT_MIME[(file.name.split('.').pop() || '').toLowerCase()] || '').startsWith('video/')
      };
    });
    setItems((s) => [...next, ...s]);
  }

  async function start(item) {
    patch(item.key, { status: 'uploading', progress: 0, error: null });
    try {
      const result = await uploadFile(item.file, { onProgress: (p) => patch(item.key, { progress: p }) });
      patch(item.key, { status: 'done', progress: 100, result });
      addHistory({
        id: result.id, publicUrl: result.url, createdAt: result.createdAt, mediaType: result.mediaType,
        mimeType: result.mimeType, sizeBytes: result.sizeBytes, originalName: result.originalName
      });
      push('Upload stored in GitHub', 'success');
    } catch (e) {
      const msg =
        e instanceof ApiError && e.code === 'RATE_LIMITED' && e.retryAfter
          ? `${e.message} Try again in about ${Math.ceil(Number(e.retryAfter) / 60)} min.`
          : e.message;
      patch(item.key, { status: 'error', error: msg });
      push(msg, 'error');
    }
  }

  function remove(item) {
    if (item.preview) URL.revokeObjectURL(item.preview);
    setItems((s) => s.filter((i) => i.key !== item.key));
  }

  const ready = items.filter((i) => i.status === 'ready');
  async function uploadAll() {
    for (const it of ready) await start(it); // sequential: gentle on GitHub and rate limits
  }

  if (config.uploadsDisabled) {
    return (
      <div className="card notice" role="alert">
        <AlertTriangle aria-hidden="true" />
        <p>Uploads are switched off by the site operator right now. Check back later.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        <UploadCloud size={40} aria-hidden="true" />
        <h2>Drop photos or videos here</h2>
        <p>
          {config.allowedFormats.join(', ').toUpperCase()} · up to {formatBytes(config.maxUploadBytes)} each
        </p>
        <button type="button" className="btn btn-primary" onClick={() => inputRef.current && inputRef.current.click()}>
          Choose files
        </button>
        <input
          ref={inputRef} type="file" multiple accept={accept} hidden data-testid="file-input"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {ready.length > 1 && (
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={uploadAll}>Upload all ({ready.length})</button>
        </div>
      )}

      <ul className="file-list">
        {items.map((it) =>
          it.status === 'done' ? (
            <li key={it.key}><ResultCard media={it.result} /></li>
          ) : (
            <li key={it.key} className={`card file file-${it.status}`}>
              <div className="file-thumb">
                {it.preview ? (
                  it.isVideo ? <video src={it.preview} muted playsInline preload="metadata" /> : <img src={it.preview} alt="" />
                ) : it.isVideo ? <Film aria-hidden="true" /> : <FileImage aria-hidden="true" />}
              </div>
              <div className="file-info">
                <strong className="wrap">{it.file.name}</strong>
                <span className="muted">{it.file.type || 'unknown type'} · {formatBytes(it.file.size)}</span>
                <span className={`badge badge-${it.status}`}>
                  {it.status === 'ready' && 'Ready to upload'}
                  {it.status === 'uploading' && `Uploading ${it.progress}%`}
                  {it.status === 'invalid' && 'Not accepted'}
                  {it.status === 'error' && 'Failed'}
                </span>
                {it.status === 'uploading' && (
                  <div className="bar" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${it.progress}%` }} />
                  </div>
                )}
                {it.error && <p className="error-text" role="alert">{it.error}</p>}
              </div>
              <div className="file-actions">
                {it.status === 'ready' && <button type="button" className="btn btn-primary" onClick={() => start(it)}>Upload</button>}
                {it.status === 'error' && (
                  <button type="button" className="btn btn-primary" onClick={() => start(it)}>
                    <RotateCw size={16} aria-hidden="true" /><span>Retry</span>
                  </button>
                )}
                {it.status !== 'uploading' && (
                  <button type="button" className="btn btn-ghost icon" aria-label={`Remove ${it.file.name}`} onClick={() => remove(it)}>
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
