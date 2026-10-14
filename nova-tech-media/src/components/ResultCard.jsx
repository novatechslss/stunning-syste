import { ExternalLink, Lock } from 'lucide-react';
import CopyButton from './CopyButton.jsx';
import { formatBytes, formatLocal, summaryText } from '../services/api.js';

export function Preview({ media, className = 'preview' }) {
  const url = media.url || media.publicUrl;
  if (!url) {
    return (
      <div className={`${className} preview-locked`}>
        <Lock size={22} aria-hidden="true" />
        <span>No public link</span>
      </div>
    );
  }
  return media.mediaType === 'video' ? (
    <video className={className} src={url} controls preload="metadata" playsInline />
  ) : (
    <img className={className} src={url} alt={media.originalName || 'Uploaded media'} loading="lazy" />
  );
}

export default function ResultCard({ media }) {
  const url = media.url || media.publicUrl || null;
  return (
    <article className="card result" aria-label={`Uploaded ${media.originalName || media.id}`}>
      <Preview media={media} />
      <div className="result-body">
        <h3>{media.originalName || 'Uploaded file'}</h3>
        <dl className="facts">
          <dt>Media ID</dt>
          <dd className="mono">{media.id}</dd>
          <dt>Public URL</dt>
          <dd className="mono wrap">{url || 'None. This server stores media privately, so no public link exists.'}</dd>
          <dt>Uploaded (UTC)</dt>
          <dd className="mono">{media.createdAt}</dd>
          <dt>Your local time</dt>
          <dd>{formatLocal(media.createdAt)}</dd>
          <dt>Type and size</dt>
          <dd>
            {media.mimeType} · {formatBytes(media.sizeBytes)}
          </dd>
        </dl>
        <div className="btn-row">
          <CopyButton label="Copy ID" what="Media ID" value={media.id} />
          <CopyButton label="Copy URL" what="URL" value={url} />
          <CopyButton label="Copy Time" what="Upload time" value={media.createdAt} />
          <CopyButton label="Copy All" what="All details" value={summaryText(media)} variant="primary" />
          {url && (
            <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              <span>Open media</span>
            </a>
          )}
        </div>
        {url && <p className="hint">Anyone with this link can view, download and share the file.</p>}
      </div>
    </article>
  );
}
