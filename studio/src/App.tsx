import { useState } from 'react';
import Content from './views/Content';
import Illustrations from './views/Illustrations';
import Overview from './views/Overview';
import Video from './views/Video';

const TABS = ['Overview', 'Content', 'Illustrations', 'Video'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('studio-tab') as Tab) || 'Overview');
  const go = (t: Tab) => { setTab(t); try { localStorage.setItem('studio-tab', t); } catch {} };
  if (tab === 'Video') return <Video onExit={() => go('Overview')} />;
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <h1 style={{ fontSize: 24 }}>Unloq <span className="sub" style={{ fontWeight: 500 }}>Studio</span></h1>
        <nav style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? 'primary' : ''} onClick={() => go(t)}>{t}</button>
          ))}
        </nav>
      </header>
      {tab === 'Overview' && <Overview />}
      {tab === 'Content' && <Content />}
      {tab === 'Illustrations' && <Illustrations />}
    </div>
  );
}
