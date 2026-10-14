import Uploader from '../components/Uploader.jsx';

export default function UploadPage({ config }) {
  return (
    <div className="page">
      <h1>Upload media</h1>
      <p className="lead">
        {config.publicLinks
          ? 'Files are saved to a public GitHub repository. The link you get can be opened by anyone who has it.'
          : 'Files are saved to a private GitHub repository. You get an ID, but no public link is created.'}
      </p>
      <Uploader config={config} />
    </div>
  );
}
