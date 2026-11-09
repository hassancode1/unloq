// "Your learning": highlights, a month of marks (tap a day), how you explain
// (with a trend), and the full history — any quest opens its detail.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { allLearned, monthWeeks, summarize, type Learned } from '../../lib/learningStats';
import { dayKey } from '../../lib/quests';
import { useAppStore } from '../../store/useAppStore';
import { Coin, ScoreRing, useEntryLook } from '../marks';
import { F, O } from '../onboarding/ui';
import PathSigil from '../paths/PathSigil';
import QuestDetail from './QuestDetail';
import Sheet, { Section } from './Sheet';

const HISTORY_STEP = 15;

export default function StatsScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Your learning" onClose={onClose}>
      {visible && <Body />}
    </Sheet>
  );
}

function Body() {
  const questLog = useAppStore((s) => s.questLog);
  const extras = useAppStore((s) => s.extras);
  const lookFor = useEntryLook();
  const items = useMemo(() => allLearned(questLog, extras), [questLog, extras]);
  const stats = useMemo(() => summarize(questLog, items), [questLog, items]);

  const [open, setOpen] = useState<Learned | null>(null);
  const [shown, setShown] = useState(HISTORY_STEP);
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const weeks = useMemo(() => monthWeeks(month.y, month.m), [month]);
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isThisMonth = month.y === now.getFullYear() && month.m === now.getMonth();
  const today = dayKey();
  const stepMonth = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    setMonth(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  };

  if (items.length === 0) {
    return (
      <Section>
        <Text style={st.body}>Your stats start with your first quest. Every topic you learn shows up here, with its mark.</Text>
      </Section>
    );
  }

  return (
    <>
      {/* highlights */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile value={stats.streak} label="Day streak" />
        <Tile value={stats.best} label="Best streak" />
        <Tile value={stats.learned} label="Learned" />
      </View>

      {/* a month of marks */}
      <Section>
        <View style={st.rowBetween}>
          <Pressable onPress={() => stepMonth(-1)} hitSlop={10} style={st.navBtn}>
            <Ionicons name="chevron-back" size={16} color={O.sub} />
          </Pressable>
          <Text style={st.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={() => !isThisMonth && stepMonth(1)} hitSlop={10} style={[st.navBtn, isThisMonth && { opacity: 0.25 }]}>
            <Ionicons name="chevron-forward" size={16} color={O.sub} />
          </Pressable>
        </View>
        <View style={st.weekRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={st.dow}>{d}</Text>)}
        </View>
        {weeks.map((w, wi) => (
          <View key={wi} style={st.weekRow}>
            {w.map((day, di) => {
              if (!day) return <View key={di} style={st.cell} />;
              const entry = questLog[day];
              const look = lookFor(entry);
              return (
                <Pressable
                  key={day}
                  disabled={!entry}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen({ day, entry: entry!, extra: false }); }}
                  style={st.cell}
                >
                  <Coin size={36} ring={day === today && !entry}>
                    {look ? <PathSigil style={look} size={26} /> : <Text style={st.dayNum}>{Number(day.slice(8))}</Text>}
                  </Coin>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Section>

      {/* how you explain */}
      {stats.explained > 0 && (
        <Section label="How you explain">
          <View style={[st.rowBetween, { alignItems: 'flex-end' }]}>
            <View>
              <Text style={st.big}>{stats.score}</Text>
              <Text style={st.meta}>average of {stats.explained} {stats.explained === 1 ? 'explanation' : 'explanations'}</Text>
            </View>
            {stats.trend.length > 1 && <Trend values={stats.trend} />}
          </View>
          <View style={{ gap: 9, marginTop: 6 }}>
            <Bar label="Accuracy" value={stats.accuracy} />
            <Bar label="Clarity" value={stats.clarity} />
            <Bar label="Delivery" value={stats.articulation} />
          </View>
        </Section>
      )}

      {/* history */}
      <Section label="History">
        {items.slice(0, shown).map((it, i) => {
          const look = lookFor(it.entry);
          return (
            <Pressable
              key={`${it.day}-${it.entry.completedAt}`}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen(it); }}
              style={[st.listRow, i > 0 && st.divider]}
            >
              <Coin size={40}>{look && <PathSigil style={look} size={28} />}</Coin>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.rowTitle} numberOfLines={1}>{it.entry.title}</Text>
                <Text style={st.meta} numberOfLines={1}>
                  {new Date(it.entry.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {(it.entry.concept ?? it.entry.pathTitle) ? ` · ${it.entry.concept ?? it.entry.pathTitle}` : ''}
                </Text>
              </View>
              {it.entry.readOnly
                ? <Text style={st.meta}>read</Text>
                : <ScoreRing score={it.entry.score} color={look?.accent ?? O.text} track="#1D1C26" text={O.text} size={38} />}
            </Pressable>
          );
        })}
        {shown < items.length && (
          <Pressable onPress={() => setShown((n) => n + HISTORY_STEP)} style={st.more}>
            <Text style={st.moreText}>Show more</Text>
          </Pressable>
        )}
      </Section>

      <QuestDetail item={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileValue}>{value}</Text>
      <Text style={st.meta}>{label}</Text>
    </View>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <View style={st.barRow}>
      <Text style={[st.meta, { width: 72 }]}>{label}</Text>
      <View style={[st.track, { flex: 1 }]}><View style={[st.fill, { width: `${value}%` }]} /></View>
      <Text style={st.barValue}>{value}</Text>
    </View>
  );
}

/** Last scores as a small line; the newest point is marked. */
function Trend({ values }: { values: number[] }) {
  const w = 120, h = 44, pad = 4;
  const lo = Math.min(...values, 40), hi = Math.max(...values, 100);
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - pad * 2);
    return [x, y];
  });
  const last = pts[pts.length - 1];
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={3.5} fill={O.text} />
    </Svg>
  );
}

const st = StyleSheet.create({
  body: { color: O.text, fontFamily: F.semi, fontSize: 15, lineHeight: 22 },
  meta: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tile: { flex: 1, backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  tileValue: { color: O.text, fontFamily: F.black, fontSize: 24 },
  navBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1922' },
  monthLabel: { color: O.text, fontFamily: F.bold, fontSize: 15 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dow: { width: 36, textAlign: 'center', color: O.sub, fontFamily: F.semi, fontSize: 12 },
  cell: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  dayNum: { color: O.faint, fontFamily: F.semi, fontSize: 11 },
  big: { color: O.text, fontFamily: F.black, fontSize: 40, letterSpacing: -1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barValue: { color: O.text, fontFamily: F.bold, fontSize: 12, width: 26, textAlign: 'right' },
  track: { height: 5, borderRadius: 3, backgroundColor: '#1D1C26', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: O.text },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: O.cardBorder },
  rowTitle: { color: O.text, fontFamily: F.bold, fontSize: 15 },
  more: { alignItems: 'center', paddingTop: 10 },
  moreText: { color: O.sub, fontFamily: F.bold, fontSize: 13 },
});
