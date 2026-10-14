import { formatBytes, clearHistory } from '../services/api.js';
import { useToast } from '../components/Toast.jsx';

export function Settings({ config }) {
  const { push } = useToast();
  const rows = [
    ['Maximum file size', formatBytes(config.maxUploadBytes)],
    ['Allowed formats', config.allowedFormats.join(', ')],
    ['Repository visibility', config.repoVisibility],
    ['Public links', config.publicLinks ? 'Yes, anyone with a link can open the file' : 'No, files are private'],
    ['Public browsing', config.publicListEnabled ? 'On' : 'Off'],
    ['Lookup by ID without a key', config.publicLookupEnabled ? 'On' : 'Off'],
    ['Deletion', config.deleteEnabled ? 'On (API key required)' : 'Off'],
    ['Website upload limit', `${config.webRateLimit} per ${config.rateWindowMinutes} min per connection (best effort)`],
    ['Uploads', config.uploadsDisabled ? 'Switched off' : 'Open']
  ];
  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="lead">These values are set by the site operator in the server environment. They cannot be changed from this page.</p>
      <div className="card"><dl className="facts">{rows.map(([k, v]) => <div key={k} className="row"><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
      <div className="card">
        <h3>This browser</h3>
        <p>Your recent uploads are remembered only in this browser.</p>
        <button className="btn btn-ghost" onClick={() => { clearHistory(); push('Local list cleared', 'success'); }}>Clear my recent uploads</button>
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className="page">
      <h1>About NOVA TECH MEDIA</h1>
      <div className="card prose">
        <p>NOVA TECH MEDIA is a small media host with no database and no accounts. Files and one metadata record per file live in a GitHub repository chosen by the operator.</p>
        <h3>What that means</h3>
        <p>Without accounts, uploads cannot belong to a person, so there are no per-user quotas or private galleries. Abuse is limited with size and type checks, rate limits and an operator kill switch.</p>
        <p>GitHub is not a high-volume CDN. It has file-size, bandwidth and API limits, and it is a poor home for long videos. Use this for small files.</p>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="page">
      <h1>Privacy policy</h1>
      <div className="card prose">
        <h3>What is stored</h3>
        <p>Your file, its sanitized original name, type, size, upload time and an ID are saved in the operator's GitHub repository. No account data is collected.</p>
        <h3>Who can see it</h3>
        <p>If the repository is public, the file's link can be opened, downloaded and shared by anyone who has it, and GitHub itself can show repository contents. If it is private, only people with repository access can see files.</p>
        <h3>Logs and your connection</h3>
        <p>Your IP address is used briefly in server memory to rate-limit uploads. Logs hold no file contents or secrets.</p>
        <h3>Removing a file</h3>
        <p>Visitors cannot delete uploads. Contact the site operator with the media ID to request removal.</p>
        <h3>Your browser</h3>
        <p>A list of your recent uploads is kept in this browser's local storage. Clear it from Settings.</p>
      </div>
    </div>
  );
}
