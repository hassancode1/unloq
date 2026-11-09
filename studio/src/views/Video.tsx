// Video mode: a clean 9:16 stage for screen recording. Space spins the wheel
// (path names roll on a drum, like the app), it lands on a real topic, then
// Enter steps through: question → illustration + "You'll explain" → reading.
// H hides the controls, Esc leaves.
import { useEffect, useMemo, useRef, useState } from 'react';
import { call } from '../api';
import { duo } from '../colors';
import { Reading } from './Content';
import glim from '../../../assets/icon.png';

type TopicRow = { _id: string; title: string; concept: string | null; status: string };
type PathRow = { _id: string; title: string; color: string | null; topics: TopicRow[] };
type Topic = { _id: string; title: string; concept: string | null; reading: string | null; points: string[]; color: string | null; pathTitle: string; illustration: { status: string; url: string | null } | null };

const ROW = 64, LAPS = 4, SPIN_MS = 3800;
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

export default function Video({ onExit }: { onExit: () => void }) {
  const [paths, setPaths] = useState<PathRow[] | null>(null);
  const [only, setOnly] = useState<string>('all');
  const [pos, setPos] = useState(0);            // fractional row under the pill
  const [landed, setLanded] = useState<{ path: PathRow; topic: TopicRow } | null>(null);
  const [step, setStep] = useState(0);          // 0 wheel · 1 question · 2 picture · 3 reading
  const [topic, setTopic] = useState<Topic | null>(null);
  const [hide, setHide] = useState(false);
  const spinning = useRef(false);

  useEffect(() => { call<PathRow[]>('studio:paths').then(setPaths); }, []);
  const pool = useMemo(() => (paths ?? []).filter((p) => p.topics.some((t) => t.status === 'ready') && (only === 'all' || p._id === only)), [paths, only]);
  const rows = useMemo(() => Array.from({ length: pool.length * (LAPS + 3) }, (_, i) => pool[i % Math.max(1, pool.length)]), [pool]);

  const spin = () => {
    if (spinning.current || !pool.length) return;
    spinning.current = true;
    setStep(0); setLanded(null); setTopic(null);
    const target = Math.floor(Math.random() * pool.length);
    const n = pool.length, from = n + (Math.round(pos) % n), to = (LAPS + 1) * n + target;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / SPIN_MS);
      setPos(from + (to - from) * ease(k));
      if (k < 1) return requestAnimationFrame(tick);
      const path = pool[target];
      const ready = path.topics.filter((t) => t.status === 'ready');
      const t = ready[Math.floor(Math.random() * ready.length)];
      setLanded({ path, topic: t }); setStep(1); spinning.current = false;
      call<Topic>('studio:topic', { topicId: t._id }).then(setTopic);
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); spin(); }
      else if (e.key === 'Enter' && landed) setStep((s) => Math.min(3, s + 1));
      else if (e.key === 'Backspace') setStep((s) => Math.max(1, s - 1));
      else if (e.key.toLowerCase() === 'h') setHide((h) => !h);
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const accent = landed ? duo(landed.path.color)[0] : '#B9A6FF';
  const pic = topic?.illustration?.url;

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#000' }}>
      {!hide && (
        <div style={{ position: 'fixed', top: 14, left: 14, right: 14, display: 'flex', gap: 10, alignItems: 'center', zIndex: 5 }}>
          <button onClick={onExit}>← Studio</button>
          <select value={only} onChange={(e) => setOnly(e.target.value)}
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 12px' }}>
            <option value="all">All paths</option>
            {(paths ?? []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
          <span className="sub" style={{ fontSize: 13 }}>Space spin · Enter next · ⌫ back · H hide controls · Esc exit</span>
        </div>
      )}

      {/* the 9:16 stage — record this area */}
      <div style={{ height: 'min(96vh, 1000px)', aspectRatio: '9 / 16', background: 'var(--bg)', borderRadius: 28, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', padding: '48px 28px 36px' }}>
        <img src={glim} style={{ width: step >= 2 ? 84 : 150, alignSelf: 'center', borderRadius: 40, transition: 'width .5s ease', animation: 'float 3.2s ease-in-out infinite' }} />
        <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
          @keyframes rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`}</style>

        {step === 0 && (
          <>
            <div className="sub" style={{ textAlign: 'center', marginTop: 20 }}>{pool.length ? 'Picking today’s topic…' : 'Loading…'}</div>
            <div style={{ position: 'relative', height: ROW * 5, marginTop: 30, overflow: 'hidden', maskImage: 'linear-gradient(transparent, #000 30%, #000 70%, transparent)' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: ROW * 2, height: ROW, borderRadius: ROW / 2, background: 'rgba(255,255,255,.08)' }} />
              {rows.map((p, i) => {
                const d = i - pos;
                if (Math.abs(d) > 3) return null;
                const [a, b] = duo(p.color);
                return (
                  <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: ROW * 2 + d * ROW, height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: Math.max(0.15, 1 - Math.abs(d) * 0.35), transform: `scale(${1 - Math.min(1, Math.abs(d)) * 0.08})` }}>
                    <span className="dot" style={{ background: a, width: 12, height: 12, borderRadius: 6 }} /><span className="dot" style={{ background: b, width: 12, height: 12, borderRadius: 6, marginLeft: -8 }} />
                    <span className="display" style={{ fontSize: 26, fontWeight: 700 }}>{p.title}</span>
                  </div>
                );
              })}
            </div>
            <div className="sub" style={{ textAlign: 'center', marginTop: 'auto', fontSize: 14 }}>Press space</div>
          </>
        )}

        {step >= 1 && landed && (
          <div key={step} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, animation: 'rise .5s ease both', overflow: 'hidden', flex: 1 }}>
            <div style={{ textAlign: step === 1 ? 'center' : 'left' }}>
              {landed.topic.concept && <div style={{ color: accent, fontWeight: 700, fontSize: step === 1 ? 20 : 15 }}>{landed.topic.concept}</div>}
              <h2 style={{ fontSize: step === 1 ? 44 : 28, lineHeight: 1.1, marginTop: 8 }}>{landed.topic.title}</h2>
            </div>
            {step >= 2 && pic && <img src={`/api/img?u=${encodeURIComponent(pic)}`} style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 18, border: '1px solid var(--border)' }} />}
            {step >= 2 && !!topic?.points.length && (
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}><b>You’ll explain:</b> <span className="sub">{topic.points.join(' · ')}</span></p>
            )}
            {step >= 3 && topic?.reading && <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(#000 70%, transparent)' }}><Reading text={topic.reading} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
