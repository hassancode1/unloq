import { useEffect, useState } from 'react';
import { call } from '../api';

type Row = { topicId: string; title: string; concept: string | null; pathTitle: string; status: 'review' | 'approved' | 'rejected'; brief: string; url: string | null };
const FILTERS = ['review', 'rejected', 'approved', 'all'] as const;
const LABEL = { review: 'Waiting', rejected: 'Rejected', approved: 'Approved', all: 'All' };

export default function Illustrations() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('review');
  const [open, setOpen] = useState<Row | null>(null);
  const load = () => call<Row[]>('studio:illustrations').then(setRows);
  useEffect(() => { load(); }, []);

  // optimistic: flip locally, then save
  const set = (r: Row, status: Row['status']) => {
    setRows((xs) => xs?.map((x) => (x.topicId === r.topicId ? { ...x, status } : x)) ?? xs);
    call('studio:setIllustrationStatus', { topicId: r.topicId, status }).catch(load);
  };
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  const count = (s: Row['status']) => (rows ?? []).filter((r) => r.status === s).length;

  const approveShown = async () => {
    const waiting = shown.filter((r) => r.status === 'review');
    setRows((xs) => xs?.map((x) => (waiting.some((w) => w.topicId === x.topicId) ? { ...x, status: 'approved' } : x)) ?? xs);
    for (const w of waiting) await call('studio:setIllustrationStatus', { topicId: w.topicId, status: 'approved' }).catch(() => {});
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} className={f === filter ? 'primary' : ''} onClick={() => setFilter(f)}>
            {LABEL[f]}{f !== 'all' && rows ? ` · ${count(f)}` : ''}
          </button>
        ))}
        <span className="sub" style={{ marginLeft: 8, fontSize: 13 }}>Only approved images appear in the app. Rejected ones are redrawn by the batch command.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={load}>Refresh</button>
          {filter === 'review' && shown.length > 0 && <button className="primary" onClick={approveShown}>Approve all {shown.length} shown</button>}
        </div>
      </div>
      {!rows && <p className="sub">Loading…</p>}
      {rows && !shown.length && <p className="sub">Nothing here.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {shown.map((r) => (
          <div key={r.topicId} className="card" style={{ padding: 10, display: 'grid', gap: 8, borderColor: r.status === 'approved' ? '#2C4A3A' : r.status === 'rejected' ? '#4A2A2A' : undefined }}>
            {r.url && <Thumb url={r.url} onOpen={() => setOpen(r)} />}
            <div className="sub" style={{ fontSize: 12 }}>{r.pathTitle}{r.concept ? ` · ${r.concept}` : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{r.title}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ flex: 1 }} onClick={() => set(r, 'rejected')} disabled={r.status === 'rejected'}>Reject</button>
              <button style={{ flex: 1 }} className={r.status === 'approved' ? '' : 'primary'} onClick={() => set(r, 'approved')} disabled={r.status === 'approved'}>
                {r.status === 'approved' ? 'Approved' : 'Approve'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,2,8,.88)', display: 'grid', placeItems: 'center', padding: 30, cursor: 'zoom-out' }}>
          <div style={{ maxWidth: 1000, width: '100%' }}>
            {open.url && <img src={imgSrc(open.url)} style={{ width: '100%', borderRadius: 18, display: 'block' }} />}
            <h3 style={{ marginTop: 14 }}>{open.title}</h3>
            <p className="sub">{open.brief}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Thumbnail served by the local Studio server (/api/img), loaded as it scrolls into view. */
const imgSrc = (url: string) => `/api/img?u=${encodeURIComponent(url)}`;
function Thumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [tries, setTries] = useState(0);
  return (
    <div onClick={onOpen} style={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', borderRadius: 12, overflow: 'hidden', background: '#0B0A11', cursor: 'zoom-in' }}>
      {state !== 'ok' && (
        <div className="sub" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13 }}>
          {state === 'failed' ? 'Couldn’t load · click Refresh' : 'Loading…'}
        </div>
      )}
      <img
        key={tries}
        src={imgSrc(url) + (tries ? `&r=${tries}` : '')}
        loading="lazy"
        onLoad={() => setState('ok')}
        onError={() => (tries < 2 ? setTimeout(() => setTries((t) => t + 1), 1000) : setState('failed'))}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: state === 'ok' ? 1 : 0, transition: 'opacity .3s' }}
      />
    </div>
  );
}
