import { useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import { fetchConfig } from './services/api.js';
import { Skeleton } from './components/States.jsx';
import Home from './pages/Home.jsx';
import UploadPage from './pages/UploadPage.jsx';
import MyMedia from './pages/MyMedia.jsx';
import ApiPage from './pages/ApiPage.jsx';
import { Settings, About, Privacy } from './pages/Info.jsx';

const ROUTES = ['upload', 'media', 'api', 'docs', 'settings', 'about', 'privacy'];

function useRoute() {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES.includes(h) ? h : 'home';
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchConfig().then(setConfig).catch((e) => setError(e.message));
  }, []);

  let body;
  if (error) {
    body = (
      <div className="card notice" role="alert">
        <p>Could not load server settings: {error}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  } else if (!config) {
    body = <Skeleton lines={4} height={22} />;
  } else {
    const pages = {
      home: <Home config={config} />,
      upload: <UploadPage config={config} />,
      media: <MyMedia config={config} />,
      api: <ApiPage config={config} section="api" />,
      docs: <ApiPage config={config} section="docs" />,
      settings: <Settings config={config} />,
      about: <About />,
      privacy: <Privacy />
    };
    body = pages[route];
  }
  return <Layout route={route}>{body}</Layout>;
}
