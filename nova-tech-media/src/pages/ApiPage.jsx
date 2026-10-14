import CopyButton from '../components/CopyButton.jsx';
import { formatBytes } from '../services/api.js';
import { snippets, ERRORS } from './snippets.js';

function Code({ title, code, copyLabel }) {
  return (
    <section className="card code-card">
      <div className="code-head">
        <h3>{title}</h3>
        <CopyButton label={copyLabel || 'Copy Example'} what={title} value={code} />
      </div>
      <pre tabIndex={0}><code>{code}</code></pre>
    </section>
  );
}

export default function ApiPage({ config, section }) {
  const base = config.apiBaseUrl.startsWith('http') ? config.apiBaseUrl : window.location.origin + config.apiBaseUrl;
  const s = snippets(base);
  const endpoints = [
    ['POST', '/upload', 'Upload one file (multipart/form-data, field "file"). API key required.'],
    ['GET', '/media/:id', config.publicLookupEnabled ? 'Metadata for one media ID.' : 'Metadata for one media ID. API key required on this server.'],
    ['GET', '/media', config.publicListEnabled ? 'Bounded, paginated recent list.' : 'Recent list. API key required on this server.'],
    ['DELETE', '/media/:id', config.deleteEnabled ? 'Delete media. API key required.' : 'Disabled on this server.'],
    ['GET', '/health', 'Minimal health check.']
  ];

  if (section === 'api') {
    return (
      <div className="page">
        <h1>API</h1>
        <p className="lead">A small authenticated API so WhatsApp and Telegram bots can upload without a browser.</p>
        <div className="card">
          <h3>Base URL</h3>
          <p className="mono wrap">{base}</p>
          <div className="btn-row"><CopyButton label="Copy Endpoint" what="Upload endpoint" value={`${base}/upload`} /></div>
        </div>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Method</th><th>Path</th><th>What it does</th></tr></thead>
            <tbody>{endpoints.map(([m, p, d]) => <tr key={m + p}><td className="mono">{m}</td><td className="mono">{p}</td><td>{d}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <h3>Authentication</h3>
          <p>Send <span className="mono">Authorization: Bearer YOUR_API_KEY</span>. Keys are issued by the site operator, who adds a hash of each key to the server settings. There is no page that creates keys, and keys must stay on your bot's server.</p>
        </div>
        <div className="card">
          <h3>Limits and usage</h3>
          <p>Max file size {formatBytes(config.maxUploadBytes)}. Formats: {config.allowedFormats.join(', ')}. About {config.apiRateLimit} uploads per key every {config.rateWindowMinutes} minutes, counted best-effort per server instance. GitHub is not a media CDN, so keep videos short and respect the limits.</p>
          <p>Read <span className="mono">Retry-After</span> on a 429 and wait before retrying.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>API documentation</h1>
      <p className="lead">Every example reads the key from an environment variable. Never paste real keys into code you share.</p>
      <Code title="cURL upload" code={s.curl} />
      <Code title="JavaScript fetch and FormData" code={s.fetch} />
      <Code title="Node.js upload" code={s.node} />
      <Code title="Example JSON response" code={s.response} copyLabel="Copy Response" />
      <Code title="WhatsApp (Baileys) bot" code={s.baileys} />
      <Code title="Telegram bot" code={s.telegram} />
      <div className="card table-wrap">
        <h3>Error codes</h3>
        <table>
          <thead><tr><th>HTTP</th><th>Code</th><th>Meaning</th></tr></thead>
          <tbody>{ERRORS.map(([h, c, m]) => <tr key={c}><td>{h}</td><td className="mono wrap">{c}</td><td>{m}</td></tr>)}</tbody>
        </table>
        <p className="hint">Errors look like <span className="mono">{'{"success":false,"error":{"code":"...","message":"..."}}'}</span>.</p>
      </div>
    </div>
  );
}
