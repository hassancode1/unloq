import { useEffect, useState } from 'react';
import { call } from '../api';

type O = { paths: number; topics: number; reading: Record<string, number>; illustration: Record<string, number>; customPaths: number };

export default function Overview() {
  const [o, setO] = useState<O | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const load = () => call<O>('studio:overview').then((x) => { setO(x); setErr(null); }).catch((e) => setErr(String(e.message ?? e)));
    load();
    const t = setInterval(load, 10000); // live while batches run
    return () => clearInterval(t);
  }, []);
  if (err) return <div className="card" style={{ borderColor: '#5A2A2A' }}><b>Can't reach Convex.</b> <span className="sub">{err}</span></div>;
  if (!o) return <p className="sub">Loading…</p>;
  const n = (r: Record<string, number>, k: string) => r[k] ?? 0;
  const tile = (label: string, value: number, of?: number, tone?: string) => (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <div className="display" style={{ fontSize: 34, color: tone }}>{value}{of != null && <span className="sub" style={{ fontSize: 18 }}> / {of}</span>}</div>
      <div className="sub" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <section>
        <h3 style={{ marginBottom: 10 }}>Content</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {tile('Curated paths', o.paths)}
          {tile('Topics', o.topics)}
          {tile('Custom paths (users)', o.customPaths)}
        </div>
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>Readings</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {tile('Ready', n(o.reading, 'ready'), o.topics, 'var(--ok)')}
          {tile('Not written yet', n(o.reading, 'pending'))}
          {tile('Writing now', n(o.reading, 'generating'))}
          {tile('Failed', n(o.reading, 'error'), undefined, n(o.reading, 'error') ? 'var(--bad)' : undefined)}
        </div>
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>Illustrations</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {tile('Approved (live)', n(o.illustration, 'approved'), o.topics, 'var(--ok)')}
          {tile('Waiting for review', n(o.illustration, 'review'), undefined, 'var(--warn)')}
          {tile('Rejected', n(o.illustration, 'rejected'))}
          {tile('Not drawn yet', n(o.illustration, 'none'))}
        </div>
      </section>
      <p className="sub">Refreshes every 10 seconds.</p>
    </div>
  );
}
