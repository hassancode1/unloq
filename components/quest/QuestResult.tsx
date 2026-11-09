// The payoff after explaining. Choreographed, not a stats dump:
//   1. the score counts up            (0 → ~0.9 s)
//   2. XP orbs fly from it into Glim  (~1.0 → 1.6 s)
//   3. Glim swallows them (absorb; a great score jumps and splats), the growth
//      bar fills, and if it's enough Glim evolves on screen
//   4. one line of praise, then two tabs: Result · Improve
// Improve holds what to add next time, a simpler way to say it, the scores and
// the transcript — so the first screen stays simple.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { XP_GREAT_SCORE, XP_MIN_SCORE } from '../../convex/lib/xp';
import { stageForXp, stageProgress } from '../../lib/quests';
import { maybeAskForReview } from '../../lib/review';
import { playReveal } from '../../lib/sfx';
import Glim, { GLIM_STAGES, GlimHandle, GlimStage } from '../mascot/Glim';
import { paletteForInterests } from '../mascot/palettes';
import { allLearned } from '../../lib/learningStats';
import { useAppStore } from '../../store/useAppStore';
import type { GlimPalette } from '../mascot/palettes';
import type { Grade } from '../onboarding/grade';
import { F, GlowButton, O, alpha, useCountUp } from '../onboarding/ui';

const T_ORBS = 1000;    // orbs leave the score
const T_ABSORB = 1650;  // Glim swallows them
const T_SETTLE = 2350;  // praise + tabs appear

interface Props {
  /** Dev preview only. */
  initialTab?: 'result' | 'improve';
  grade: Grade;
  xpBefore: number;
  glimName: string;
  palette: GlimPalette;
  accent: string;
  /** Extra actions above Done (e.g. "Go deeper: follow this path"). */
  extra?: ReactNode;
  /** Shown on the 0-XP message ("come back for review in N days"). */
  reviewDays?: number;
  /** A "Keep learning" quest after the daily one (reduced, capped XP). */
  extraQuest?: boolean;
  onDone: () => void;
}

export default function QuestResult({ initialTab = 'result', grade, xpBefore, glimName, palette, accent, extra, reviewDays = 3, extraQuest = false, onDone }: Props) {
  const glim = useRef<GlimHandle>(null);
  const xpAfter = xpBefore + grade.xp;
  const stageBefore = stageForXp(xpBefore);
  const stageAfter = stageForXp(xpAfter);
  const evolves = stageAfter > stageBefore;
  const great = grade.score >= XP_GREAT_SCORE;
  const earned = grade.xp > 0;
  // A good extra quest after today's bonus XP is used up: not a miss, just no more XP.
  const capped = extraQuest && !earned && grade.score >= XP_MIN_SCORE;

  const [shownStage, setShownStage] = useState<GlimStage>(stageBefore);
  const [orbsGo, setOrbsGo] = useState(false);
  const [xpShown, setXpShown] = useState(false);
  const [evolved, setEvolved] = useState(false);
  const [settled, setSettled] = useState(false);
  const [tab, setTab] = useState<'result' | 'improve'>(initialTab);
  const count = useCountUp(grade.score, 900, true);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    if (earned) ts.push(setTimeout(() => setOrbsGo(true), T_ORBS));
    ts.push(setTimeout(() => {
      setXpShown(true);
      if (capped) { glim.current?.happy(1400); return; }
      if (!earned) { glim.current?.no(); return; }
      playReveal();
      // evolving gets the big jump a moment later, so swallow first here
      if (great && !evolves) glim.current?.jump(); else glim.current?.absorb();
      if (evolves) {
        ts.push(setTimeout(() => {
          setShownStage(stageAfter);
          setEvolved(true);
          glim.current?.jump(); // lands — splat — in its new form
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }, great ? 1600 : 800));
      }
    }, earned ? T_ABSORB : 1100));
    ts.push(setTimeout(() => setSettled(true), earned ? T_SETTLE + (evolves ? 1500 : 0) : 1600));
    // after the celebration has fully landed: maybe ask for a rating (aha moments only)
    if (earned) ts.push(setTimeout(() => { maybeAskForReview({ evolved: evolves, score: grade.score, earned }); }, T_SETTLE + (evolves ? 1500 : 0) + 1400));
    return () => ts.forEach(clearTimeout);
  }, []);

  const orbCount = Math.max(4, Math.min(9, Math.round(grade.xp / 3)));
  // Early stages are drawn small; size the stage so a young Glim still fills
  // the moment (fixed from the start, so evolving visibly grows it).
  const glimSize = Math.round(Math.max(210, Math.min(260, 170 / GLIM_STAGES[stageBefore].scale)));
  const boxH = glimSize * 1.2;
  // Glim stands at the bottom of its box; trim the empty space above it (sized
  // for the evolved form) so the hero is compact. Jumps still draw above it.
  const bodyTop = boxH * 0.92 - 2.5 * glimSize * 0.3 * GLIM_STAGES[stageAfter].scale;
  const trimTop = Math.max(0, bodyTop - 28);
  const orbFrom = boxH + 30;                                                      // the score
  const orbTo = boxH * 0.92 - glimSize * 0.3 * GLIM_STAGES[stageBefore].scale;   // Glim's middle

  return (
    <View style={{ flex: 1 }}>
      {/* hero: Glim, the score, the orbs travelling between them */}
      <View style={[s.hero, { marginTop: -trimTop }]}>
        <Glim ref={glim} size={glimSize} stage={shownStage} palette={palette} mood={earned || capped ? 'happy' : 'idle'} interactive={false} />
        <View style={s.scoreRow}>
          <Text style={s.score}>{count}</Text>
          <Text style={s.scoreOf}>/100</Text>
        </View>
        {orbsGo && Array.from({ length: orbCount }, (_, i) => (
          <Orb key={i} i={i} n={orbCount} from={orbFrom} to={orbTo} color={i % 3 === 2 ? palette[0] : accent} />
        ))}
      </View>

      {/* the outcome, one line */}
      <View style={{ minHeight: 26, alignItems: 'center', marginTop: 2 }}>
        {xpShown && (
          earned ? (
            <Animated.Text entering={FadeInDown.duration(320)} style={[s.xp, { color: accent }]}>
              +{grade.xp} {extraQuest ? 'bonus XP' : 'XP'}{great ? ' · brilliant' : ''}
            </Animated.Text>
          ) : capped ? (
            <Animated.Text entering={FadeInDown.duration(320)} style={s.miss}>
              {glimName}’s full for today — still great practice for you
            </Animated.Text>
          ) : (
            <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: 'center', gap: 8 }}>
              <Text style={s.miss}>{glimName} didn’t quite get it yet</Text>
              <View style={s.needPill}>
                <Text style={s.needText}>
                  {XP_MIN_SCORE - grade.score} more {XP_MIN_SCORE - grade.score === 1 ? 'point' : 'points'} to earn XP · {XP_MIN_SCORE} is the bar
                </Text>
              </View>
            </Animated.View>
          )
        )}
      </View>
      {evolved && (
        <Animated.View entering={FadeInDown.duration(380)} style={[s.evolved, { borderColor: alpha(accent, 0.6) }]}>
          <Ionicons name="sparkles" size={14} color={accent} />
          <Text style={s.evolvedText}>{glimName} evolved into {GLIM_STAGES[stageAfter].name}!</Text>
        </Animated.View>
      )}

      {settled && (
        <Animated.View entering={FadeIn.duration(360)} style={{ flex: 1, marginTop: 16 }}>
          <View style={s.tabs}>
            {(['result', 'improve'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => { if (k !== tab) { Haptics.selectionAsync().catch(() => {}); setTab(k); } }}
                style={[s.tab, tab === k && s.tabOn]}
              >
                <Text style={[s.tabText, tab === k && { color: O.text }]}>{k === 'result' ? 'Result' : 'Improve'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingBottom: 28, gap: 12 }} showsVerticalScrollIndicator={false}>
            {tab === 'result' ? (
              <Animated.View entering={FadeIn.duration(250)} style={{ gap: 12 }}>
                {(grade.praise || grade.feedback) && (
                  <View style={s.card}>
                    <Text style={s.cardLabel}>{earned || capped ? 'What you nailed' : 'What you got right'}</Text>
                    <Text style={s.cardBody}>{grade.praise || grade.feedback}</Text>
                  </View>
                )}
                <View style={s.card}>
                  <Text style={s.cardLabel}>How you did</Text>
                  <MiniBar label="Accuracy" value={grade.accuracy} color={accent} />
                  <MiniBar label="Clarity" value={grade.clarity} color={accent} />
                  <MiniBar label="Delivery" value={grade.articulation} color={accent} />
                </View>
                {earned ? (
                  <GrowthBar xpBefore={xpBefore} xpAfter={xpAfter} accent={accent} go={xpShown} />
                ) : !capped && (
                  <View style={s.card}>
                    <Text style={s.cardLabel}>What happens next</Text>
                    <Text style={s.cardBody}>
                      The ideas you missed come back as a bonus review in {reviewDays} days, worth XP. See them under Improve.
                    </Text>
                  </View>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(250)} style={{ gap: 12 }}>
                <View style={s.card}>
                  <Text style={s.cardLabel}>Next time, add</Text>
                  {grade.missed?.length ? grade.missed.map((m) => (
                    <View key={m} style={s.bulletRow}>
                      <View style={[s.bullet, { backgroundColor: accent }]} />
                      <Text style={s.cardBody}>{m}</Text>
                    </View>
                  )) : <Text style={s.cardBody}>Nothing — you covered every key idea.</Text>}
                  {!!grade.tip && <Text style={[s.cardBody, { color: O.sub, marginTop: 4 }]}>{grade.tip}</Text>}
                </View>

                {!!grade.betterVersion && (
                  <View style={[s.card, { borderColor: alpha(accent, 0.35) }]}>
                    <Text style={s.cardLabel}>A simpler way to say it</Text>
                    <Text style={[s.cardBody, s.quote]}>“{grade.betterVersion}”</Text>
                  </View>
                )}

                {!!grade.transcript && <Transcript text={grade.transcript} />}
              </Animated.View>
            )}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={[alpha(O.bg, 0), O.bg]} style={s.fade} />
          </View>

          {extra}
          <GlowButton label="Done" onPress={onDone} />
        </Animated.View>
      )}
    </View>
  );
}

// An XP orb: leaves the score, arcs up and lands in Glim.
function Orb({ i, n, from, to, color }: { i: number; n: number; from: number; to: number; color: string }) {
  const t = useSharedValue(0);
  const sx = useMemo(() => (i - (n - 1) / 2) * 22 + (i % 2 ? 8 : -8), [i, n]);
  useEffect(() => {
    t.value = withDelay(i * 45, withTiming(1, { duration: 560, easing: Easing.in(Easing.quad) }));
  }, []);
  const st = useAnimatedStyle(() => {
    const k = t.value;
    const x = sx * (1 - k);
    const y = from + (to - from) * k - Math.sin(Math.PI * k) * 46;
    return {
      opacity: k < 0.92 ? 1 : (1 - k) / 0.08,
      transform: [{ translateX: x }, { translateY: y }, { scale: 1 - k * 0.45 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[s.orb, { backgroundColor: color, shadowColor: color }, st]} />;
}

// Growth bar: fills from where Glim was to where it is now (to full, then the
// next stage, when Glim evolves).
function GrowthBar({ xpBefore, xpAfter, accent, go }: { xpBefore: number; xpAfter: number; accent: string; go: boolean }) {
  const before = stageProgress(xpBefore);
  const after = stageProgress(xpAfter);
  const evolves = after.stage > before.stage;
  const w = useSharedValue(before.pct);
  const [label, setLabel] = useState(before);
  useEffect(() => {
    if (!go) return;
    if (evolves) {
      w.value = withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
        withTiming(after.pct, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
      const t = setTimeout(() => setLabel(after), 520);
      return () => clearTimeout(t);
    }
    w.value = withTiming(after.pct, { duration: 700, easing: Easing.out(Easing.cubic) });
    setLabel(after);
  }, [go]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(2, w.value * 100)}%` }));
  return (
    <View style={{ gap: 8, paddingHorizontal: 4 }}>
      <View style={s.rowBetween}>
        <Text style={s.barLabel}>{GLIM_STAGES[label.stage].name}</Text>
        <Text style={s.barValue}>{label.next ? `${label.toNext} XP to ${GLIM_STAGES[label.stage + 1].name}` : 'Fully grown'}</Text>
      </View>
      <View style={s.track}>
        <Animated.View style={[s.fill, { backgroundColor: accent }, fill]} />
      </View>
    </View>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.mini}>
      <Text style={s.miniLabel}>{label}</Text>
      <View style={[s.track, { flex: 1 }]}>
        <View style={[s.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.miniValue}>{value}</Text>
    </View>
  );
}

function Transcript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.cardLabel}>What you said</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={O.sub} />
      </View>
      {open && <Animated.Text entering={FadeIn.duration(220)} style={[s.cardBody, { color: '#C9C7D6' }]}>{text}</Animated.Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: -4 },
  score: { color: O.text, fontFamily: F.black, fontSize: 56, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  scoreOf: { color: O.faint, fontFamily: F.black, fontSize: 20, marginLeft: 3 },
  needPill: { borderRadius: 999, borderWidth: 1, borderColor: O.cardBorder, backgroundColor: O.card, paddingHorizontal: 12, paddingVertical: 6 },
  needText: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 },
  orb: {
    position: 'absolute', top: 0, width: 12, height: 12, borderRadius: 6,
    shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  xp: { fontFamily: F.black, fontSize: 18, textAlign: 'center' },
  miss: { color: O.sub, fontFamily: F.semi, fontSize: 15, textAlign: 'center' },
  evolved: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 10,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: O.card,
  },
  evolvedText: { color: O.text, fontFamily: F.bold, fontSize: 14 },
  tabs: { flexDirection: 'row', backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 14, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  tabOn: { backgroundColor: '#1D1C26' },
  tabText: { color: O.sub, fontFamily: F.bold, fontSize: 14 },
  card: { backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  cardLabel: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  cardBody: { color: O.text, fontFamily: F.semi, fontSize: 15, lineHeight: 22, flex: 1 },
  quote: { fontFamily: F.regular, color: '#E4E2EE' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barLabel: { color: O.text, fontFamily: F.bold, fontSize: 14 },
  barValue: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#1A1922', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniLabel: { color: O.sub, fontFamily: F.semi, fontSize: 13, width: 72 },
  miniValue: { color: O.text, fontFamily: F.bold, fontSize: 13, width: 28, textAlign: 'right' },
});

// ── Dev preview (App.tsx → RESULT_PREVIEW) ─────────────────────────────────────
// Replays your most recent real quest (saved feedback included). Done replays it.
export function QuestResultPreview() {
  const [run, setRun] = useState(0);
  const questLog = useAppStore((st) => st.questLog);
  const extras = useAppStore((st) => st.extras);
  const glim = useAppStore((st) => st.glim);
  const last = useMemo(() => allLearned(questLog, extras).find((i) => !i.entry.readOnly)?.entry, [questLog, extras]);
  if (!last) return <View style={{ flex: 1, backgroundColor: O.bg }} />;
  const grade: Grade = {
    score: last.score, accuracy: last.accuracy, clarity: last.clarity, articulation: last.articulation, xp: last.xp,
    feedback: last.feedback ?? '', praise: last.praise, tip: last.tip,
    missed: last.missedIdeas ?? last.missed, betterVersion: last.betterVersion, transcript: last.transcript,
  };
  return (
    <View style={{ flex: 1, backgroundColor: O.bg, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 34 }}>
      <QuestResult
        key={run}
        grade={grade}
        xpBefore={Math.max(0, glim.xp - last.xp)}
        glimName={glim.name}
        palette={paletteForInterests(glim.interests)}
        accent={last.look?.duo[0] ?? '#FF8C7A'}
        onDone={() => setRun((r) => r + 1)}
      />
    </View>
  );
}
