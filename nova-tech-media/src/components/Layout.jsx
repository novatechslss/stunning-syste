import { useEffect, useState } from 'react';
import { LayoutDashboard, UploadCloud, Images, Terminal, BookOpen, Settings, Info, ShieldCheck, Menu, X } from 'lucide-react';

export const NAV = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Media', icon: UploadCloud },
  { id: 'media', label: 'My Media', icon: Images },
  { id: 'api', label: 'API', icon: Terminal },
  { id: 'docs', label: 'API Documentation', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info },
  { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheck }
];

export default function Layout({ route, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/">NOVA<span>TECH</span>MEDIA</a>
        <button type="button" className="btn btn-ghost icon" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((o) => !o)}>
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav id="sidebar" className={`sidebar ${open ? 'open' : ''}`} aria-label="Main">
        <a className="brand brand-side" href="#/">NOVA<span>TECH</span>MEDIA</a>
        <ul>
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <a href={id === 'home' ? '#/' : `#/${id}`} className={route === id ? 'active' : ''} aria-current={route === id ? 'page' : undefined}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
