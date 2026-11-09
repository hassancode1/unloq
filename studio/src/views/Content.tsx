import { useEffect, useMemo, useState } from 'react';
import { call } from '../api';
import { duo } from '../colors';

type TopicRow = { _id: string; order: number; title: string; concept: string | null; status: string; illustration: string | null };
type PathRow = { _id: string; title: string; subtitle: string; trending: boolean; color: string | null; topics: TopicRow[] };
type Topic = {
  _id: string; title: string; concept: string | null; summary: string; status: string; reading: string | null;
  points: string[]; keyIdeas: string[]; sources: string[]; pathTitle: string; color: string | null;
  illustration: { status: string; brief: string; url: string | null } | null;
};

/** Paragraphs with **bold** key phrases, as in the app. */
export function Reading({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {text.split(/\n\s*\n/).filter(Boolean).map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#D9D7E3' }}>
          {p.split('**').map((part, k) => (k % 2 ? <b key={k} style={{ color: 'var(--text)' }}>{part}</b> : part))}
        </p>
      ))}
    </div>
  );
}

const statusTone: Record<string, string> = { ready: 'var(--ok)', error: 'var(--bad)', generating: 'var(--warn)', pending: 'var(--faint)' };

export default function Content() {
  const [paths, setPaths] = useState<PathRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const loadPaths = () => call<PathRow[]>('studio:paths').then(setPaths);
  const loadTopic = (id: string) => call<Topic>('studio:topic', { topicId: id }).then(setTopic);
  useEffect(() => { loadPaths(); }, []);
  useEffect(() => { if (sel) loadTopic(sel); }, [sel]);

  const filtered = useMemo(() => {
    if (!paths) return [];
    const s = q.trim().toLowerCase();
    if (!s) return paths;
    return paths.map((p) => ({ ...p, topics: p.topics.filter((t) => `${t.title} ${t.concept ?? ''} ${p.title}`.toLowerCase().includes(s)) })).filter((p) => p.topics.length);
  }, [paths, q]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try { await fn(); } catch (e) { alertLike(String((e as Error).message ?? e)); }
    setBusy(null);
    if (sel) loadTopic(sel);
    loadPaths();
  };
  const [note, setNote] = useState<string | null>(null);
  const alertLike = (m: string) => setNote(m);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
      <aside className="card" style={{ padding: 12, maxHeight: 'calc(100vh - 120px)', overflow: 'auto', position: 'sticky', top: 20 }}>
        <input placeholder="Search topics…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', marginBottom: 10 }} />
        {!paths && <p className="sub">Loading…</p>}
        {filtered.map((p) => {
          const [a, b] = duo(p.color);
          return (
            <div key={p._id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
                <span className="dot" style={{ background: a }} /><span className="dot" style={{ background: b, marginLeft: -4 }} />
                <b style={{ fontSize: 14 }}>{p.title}</b>
                {p.trending && <span className="pill">Trending</span>}
              </div>
              {p.topics.map((t) => (
                <div key={t._id} onClick={() => setSel(t._id)}
                  style={{ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', background: sel === t._id ? '#1D1C26' : undefined, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span className="dot" title={t.status} style={{ background: statusTone[t.status] ?? 'var(--faint)', flex: 'none', marginTop: 5 }} />
                  <span style={{ fontSize: 14, lineHeight: 1.35 }}>
                    {t.title}
                    {t.illustration && <span className="sub" style={{ fontSize: 12 }}> · 🖼 {t.illustration}</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </aside>

      <main>
        {note && <div className="card" style={{ marginBottom: 12, borderColor: '#5A2A2A' }} onClick={() => setNote(null)}>{note} <span className="sub">(click to dismiss)</span></div>}
        {!topic && <p className="sub">Pick a topic on the left to see exactly what the app shows.</p>}
        {topic && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div className="sub" style={{ fontSize: 13 }}>{topic.pathTitle}</div>
              {topic.concept && <div style={{ color: duo(topic.color)[0], fontWeight: 700, marginTop: 10 }}>{topic.concept}</div>}
              <h2 style={{ fontSize: 30, marginTop: 4 }}>{topic.title}</h2>
              <div className="sub" style={{ marginTop: 8, fontSize: 13 }}>Brief: {topic.summary}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button disabled={!!busy} onClick={() => run('reading', async () => { await call('studio:resetReading', { topicId: topic._id }); await call('pathsAi:ensureReading', { topicId: topic._id }); })}>
                {busy === 'reading' ? 'Rewriting…' : 'Rewrite reading'}
              </button>
              <button disabled={!!busy} onClick={() => run('image', () => call('pathsAi:illustrate', { topicId: topic._id }))}>
                {busy === 'image' ? 'Drawing… (~40s)' : topic.illustration ? 'Redraw illustration' : 'Draw illustration'}
              </button>
              {topic.illustration && topic.illustration.status !== 'approved' && (
                <button className="primary" disabled={!!busy} onClick={() => run('ok', () => call('studio:setIllustrationStatus', { topicId: topic._id, status: 'approved' }))}>Approve image</button>
              )}
              {topic.illustration && topic.illustration.status !== 'rejected' && (
                <button disabled={!!busy} onClick={() => run('no', () => call('studio:setIllustrationStatus', { topicId: topic._id, status: 'rejected' }))}>Reject image</button>
              )}
            </div>
            {topic.illustration?.url && (
              <div>
                <img src={`/api/img?u=${encodeURIComponent(topic.illustration.url)}`} style={{ width: '100%', maxWidth: 640, aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 18, border: '1px solid var(--border)', display: 'block' }} />
                <div className="sub" style={{ fontSize: 13, marginTop: 6 }}>🖼 {topic.illustration.status} · {topic.illustration.brief}</div>
              </div>
            )}
            {topic.reading ? (
              <>
                {!!topic.points.length && (
                  <p style={{ margin: 0 }}><b>You’ll explain:</b> <span className="sub">{topic.points.join(' · ')}</span></p>
                )}
                <div className="card" style={{ maxWidth: 720 }}><Reading text={topic.reading} /></div>
                <div className="card" style={{ maxWidth: 720 }}>
                  <div className="sub" style={{ fontSize: 13, marginBottom: 6 }}>Graded key ideas (hidden in the app)</div>
                  <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>{topic.keyIdeas.map((k) => <li key={k}>{k}</li>)}</ol>
                  {!!topic.sources.length && <div className="sub" style={{ fontSize: 13, marginTop: 10 }}>Sources: {topic.sources.join(' · ')}</div>}
                </div>
              </>
            ) : (
              <p className="sub">No reading yet ({topic.status}). “Rewrite reading” writes it now.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
