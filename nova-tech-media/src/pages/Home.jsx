import { UploadCloud, Terminal, Link2 } from 'lucide-react';
import { formatBytes } from '../services/api.js';

export default function Home({ config }) {
  return (
    <div className="page">
      <section className="hero">
        <h1>Upload it once.<br />Get an ID and a link back.</h1>
        <p className="lead">
          NOVA TECH MEDIA stores your photos and videos in GitHub and hands you a unique media ID, the upload time and, when the
          storage is public, a direct link. No account needed.
        </p>
        <div className="btn-row">
          <a className="btn btn-primary" href="#/upload"><UploadCloud size={18} aria-hidden="true" /><span>Upload media</span></a>
          <a className="btn btn-ghost" href="#/docs"><Terminal size={18} aria-hidden="true" /><span>Use the API</span></a>
        </div>
      </section>

      <section className="grid3">
        <div className="card">
          <h3>Limits</h3>
          <p>Up to {formatBytes(config.maxUploadBytes)} per file. {config.allowedFormats.join(', ').toUpperCase()}.</p>
        </div>
        <div className="card">
          <h3>Links</h3>
          <p>
            {config.publicLinks
              ? 'Uploads get a public link. Anyone who has it can view, download and share the file.'
              : 'Storage is private, so uploads get an ID but no public link.'}
          </p>
        </div>
        <div className="card">
          <h3>Bots</h3>
          <p>WhatsApp and Telegram bots upload through an authenticated API. <a href="#/api"><Link2 size={14} aria-hidden="true" /> See the API</a></p>
        </div>
      </section>
      {config.uploadsDisabled && <div className="card notice" role="alert">Uploads are currently switched off by the operator.</div>}
    </div>
  );
}
