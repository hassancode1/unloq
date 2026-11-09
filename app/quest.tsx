// Daily quest: the wheel picks a topic from your paths (+ one Discover) → read it →
// explain it out loud (one take) → graded → Glim grows and the path moves on a day.
// Falls back to the on-device topic bank when the server can't be reached.
import { Ionicons } from '@expo/vector-icons';
import CoachTip from '../components/guide/CoachTip';
import Spotlight from '../components/guide/Spotlight';
import LessonIllustration from '../components/paths/LessonIllustration';
import { useAction, useConvexAuth, useQuery } from 'convex/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Glim, { GLIM_STAGES, GlimHandle } from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';
import type { Grade } from '../components/onboarding/grade';
import { F, GlowButton, O, alpha } from '../components/onboarding/ui';
import { VoiceExplain, type Explanation } from '../components/onboarding/VoiceExplain';
import TopicWheel, { type WheelOption } from '../components/quest/TopicWheel';
import QuestResult from '../components/quest/QuestResult';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { dayKey, dialOptions, interestMeta, questPool, stageForXp, stageProgress } from '../lib/quests';
import { loadSfx } from '../lib/sfx';
import { PaywallModal } from '../components/paywall/PaywallHost';
import { HARD_PAYWALL } from '../lib/features';
import { REVIEW_AFTER_DAYS, extraXp } from '../convex/lib/xp';
import Purchases from 'react-native-purchases';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePathStyles, type PathStyle } from '../lib/pathColors';
import { SIGIL_DUOS, duoForSeed } from '../lib/sigil';
import { useTimedOut, useTodayItems, type PathSummary } from '../lib/usePaths';
import PathSigil from '../components/paths/PathSigil';
import { useAppStore } from '../store/useAppStore';

// 'locked' = read, but explaining needs Pro; 'readDone' = they chose to just read today.
type Phase = 'spin' | 'read' | 'locked' | 'readDone' | 'explain' | 'grading' | 'gradeError' | 'result';

/** A wheel option — either a server path topic or a local fallback fact. */
interface Pick {
  key: string;
  kind: 'path' | 'discover' | 'local';
  label: string;       // shown on the wheel
  look: PathStyle;     // mark + duotone; look.accent tints this quest
  title: string;       // the topic: a question or hook
  concept?: string | null; // the plain topic it teaches ("Compound interest")
  interest: string;
  path?: PathSummary;
  topicId?: string;
  order?: number;
  // local only
  body?: string;
  keywords?: string[][];
}

// Discover hides which path it is, so it gets its own mark: four discs, one lit — a pick from many.
const DISCOVER_LOOK: PathStyle = { sigil: 'disc.parallel.single-accent.t1', duo: SIGIL_DUOS['orchid-gold'], accent: SIGIL_DUOS['orchid-gold'][0] };
/** Offline fallback quests: a stable generated mark per interest. */
const localLook = (interest: string): PathStyle => {
  const duo = SIGIL_DUOS[duoForSeed(`interest:${interest}`)];
  return { sigil: `interest:${interest}`, duo, accent: duo[0] };
};
/** Fair (Fisher–Yates) shuffle — every order equally likely. */
const shuffle = <T,>(a: T[]) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export default function QuestScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {visible && <QuestFlow onClose={onClose} />}
    </Modal>
  );
}

function QuestFlow({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const glimRef = useRef<GlimHandle>(null);
  const { isAuthenticated } = useConvexAuth();
  const glim = useAppStore((s) => s.glim);
  const questLog = useAppStore((s) => s.questLog);
  const activePaths = useAppStore((s) => s.activePaths);
  const completeQuest = useAppStore((s) => s.completeQuest);
  const addPath = useAppStore((s) => s.addPath);
  const { isPremium, loading: proLoading } = useEntitlement();
  const [showPaywall, setShowPaywall] = useState(false);
  const [extraQuest, setExtraQuest] = useState(false);

  const items = useTodayItems();
  const styleFor = usePathStyles();
  const timedOut = useTimedOut(6000);
  const ensureReading = useAction(api.pathsAi.ensureReading);
  const gradeOnServer = useAction(api.pathsAi.gradeExplanation);

  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [target, setTarget] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
  const [landed, setLanded] = useState(false);
  // The daily quest's spin is fixed for the day (one re-spin, kept even if you
  // close the quest); "Keep learning" quests get one re-spin each.
  const isDaily = useState(() => !useAppStore.getState().questLog[dayKey()])[0];
  const savedSpin = useAppStore((s) => s.todaySpin);
  const setTodaySpin = useAppStore((s) => s.setTodaySpin);
  // Guided first quest: tips on each step, decided once when the quest opens.
  const [guided] = useState(() => useAppStore.getState().guidePending);
  const letsGoRef = useRef<View>(null);
  const missionRef = useRef<View>(null);
  const micRef = useRef<View>(null);
  const [rerolled, setRerolled] = useState(() => isDaily && savedSpin?.day === dayKey() && savedSpin.respun);
  const [phase, setPhase] = useState<Phase>('spin');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [readError, setReadError] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [xpBefore] = useState(glim.xp);
  const palette = useMemo(() => paletteForInterests(glim.interests), [glim.interests]);

  // ── Build the wheel once: server picks if we have them, else the local bank ──
  useEffect(() => {
    if (picks) return;
    if (items === undefined && !timedOut) return;
    let built: Pick[];
    if (items && items.length) {
      // keep today's drawn topic on the wheel so it lands there again
      const keep = isDaily && savedSpin?.day === dayKey() ? savedSpin.key : null;
      const mixed = shuffle(items);
      const at = keep ? mixed.findIndex((it) => it.key === keep) : -1;
      if (at > 7) mixed.unshift(...mixed.splice(at, 1));
      built = mixed.slice(0, 8).map((it) => {
        const discover = it.kind === 'discover';
        return {
          key: it.key, kind: it.kind, interest: it.path.interest,
          label: discover ? 'Discover' : it.path.title,
          look: discover ? DISCOVER_LOOK : styleFor(it.path),
          title: it.title, concept: it.concept, path: it.path, topicId: it.topicId, order: it.order,
        };
      });
    } else {
      const done = Object.values(questLog).map((e) => e.questId);
      built = dialOptions(questPool(glim.interests, done)).map((q) => ({
        key: q.id, kind: 'local', interest: q.interest,
        label: interestMeta(q.interest)?.label ?? q.title,
        look: localLook(q.interest),
        title: q.title, body: q.body, keywords: q.keywords,
      }));
    }
    // today's daily topic was already drawn: land on it again
    const today = dayKey();
    const prev = isDaily && savedSpin?.day === today ? built.findIndex((b) => b.key === savedSpin.key) : -1;
    const t = prev >= 0 ? prev : Math.floor(Math.random() * built.length);
    if (isDaily) setTodaySpin({ day: today, key: built[t].key, respun: prev >= 0 ? savedSpin!.respun : false });
    setPicks(built);
    setTarget(t);
    loadSfx();
    setTimeout(() => setSpinKey(1), 350);
  }, [items, timedOut]);

  const pick = picks?.[target];
  const accent = pick ? pick.look.accent : '#7FB2FF';

  // Start writing the reading while the wheel is still spinning.
  const prepare = (p?: Pick) => {
    if (!p?.topicId) return;
    setReadError(false);
    ensureReading({ topicId: p.topicId as Id<'pathTopics'> }).catch(() => setReadError(true));
  };
  useEffect(() => { prepare(pick); }, [pick?.key]);

  const topic = useQuery(api.paths.getTopic, pick?.topicId ? { topicId: pick.topicId as Id<'pathTopics'> } : 'skip');
  const reading = pick?.kind === 'local' ? pick.body ?? '' : topic?.status === 'ready' ? topic.reading ?? '' : '';
  // Only our own attempt failing counts: a topic marked "error" from an earlier
  // failure is retried automatically when the quest opens (prepare below).
  const readingFailed = readError;
  const concept: string | null = topic?.concept ?? pick?.concept ?? null;

  const spinAgain = () => {
    if (!picks || picks.length < 2) return;
    let next = target;
    while (next === target) next = Math.floor(Math.random() * picks.length);
    setTarget(next);
    setLanded(false);
    setRerolled(true);
    if (isDaily) setTodaySpin({ day: dayKey(), key: picks[next].key, respun: true });
    setSpinKey((k) => k + 1);
  };

  // Grading is AI-only: no keyword guessing. If the AI can't be reached we keep
  // what they said and let them retry, rather than hand out a fake grade.
  const lastExplanation = useRef<Explanation | null>(null);
  // Remounts the recorder after a take with no voice (it doesn't count).
  const [explainKey, setExplainKey] = useState(0);
  const [noSpeech, setNoSpeech] = useState(false);
  const onExplained = async (e: Explanation) => {
    if (!pick) return;
    lastExplanation.current = e;
    setNoSpeech(false);
    setPhase('grading');
    let g: Grade | null = null;
    if (pick.topicId) {
      // The RevenueCat id proves Pro (the subscription may not be on the account).
      const rcUserId = await Purchases.getAppUserID().catch(() => undefined);
      try {
        const res = await gradeOnServer({
          topicId: pick.topicId as Id<'pathTopics'>,
          rcUserId,
          ...(e.kind === 'audio'
            ? { audio: { base64: e.base64, mimeType: e.mimeType, durationMs: e.durationMs } }
            : { transcript: e.text }),
        });
        if (res.noSpeech) {
          setNoSpeech(true);
          setExplainKey((k) => k + 1);
          setPhase('explain');
          return;
        }
        g = res;
      } catch (err) {
        if (__DEV__) console.warn('[quest] grading failed:', err instanceof Error ? err.message : err);
      }
    }
    if (!g) { setPhase('gradeError'); return; }
    // "Keep learning": after the daily quest, each extra is worth less and
    // extras add at most EXTRA_XP_DAILY_CAP a day, so Glim's growth stays paced.
    const st = useAppStore.getState();
    const isExtra = !!st.questLog[dayKey()];
    if (isExtra) {
      const todays = st.extras?.[dayKey()] ?? [];
      g = { ...g, xp: extraXp(g.xp, todays.length, todays.reduce((a, e) => a + e.xp, 0)) };
    }
    setExtraQuest(isExtra);
    setGrade(g);
    // What they missed comes back as a review in a few days (daily path quests only).
    const missed = g.missedIdx
      ? g.missedIdx.map((i) => topic?.keyIdeas?.[i] ?? g!.missed?.[i]).filter(Boolean) as string[]
      : g.missed ?? [];
    const review = !isExtra && !!pick.topicId && missed.length > 0 && g.score < 80;
    if (guided) useAppStore.getState().setGuidePending(false);
    completeQuest({
      questId: pick.topicId ?? pick.key, interest: pick.interest, title: pick.title, concept: concept ?? undefined,
      score: g.score, accuracy: g.accuracy, clarity: g.clarity, articulation: g.articulation,
      xp: g.xp, feedback: g.feedback, completedAt: Date.now(),
      pathId: pick.path?._id, topicId: pick.topicId, pathTitle: pick.path?.title,
      // keep the feedback for looking back later (Stats → quest detail)
      praise: g.praise, tip: g.tip,
      betterVersion: g.betterVersion?.slice(0, 500),
      transcript: g.transcript?.slice(0, 700),
      missedIdeas: missed.slice(0, 4),
      look: { sigil: pick.look.sigil, duo: [pick.look.duo[0], pick.look.duo[1]] },
      ...(review ? { missed: missed.slice(0, 4), reviewAfter: Date.now() + REVIEW_AFTER_DAYS * 86400000 } : {}),
    });
    setPhase('result'); // QuestResult choreographs Glim's reaction
  };

  const kicker = !pick || !landed
    ? 'Picking today’s topic…'
    : pick.kind === 'discover' ? `Discover · ${pick.path?.title}`
    : pick.path ? `${pick.path.title} · Day ${(pick.order ?? 0) + 1}`
    : interestMeta(pick.interest)?.label ?? '';

  const wheel: WheelOption[] = (picks ?? []).map((p) => ({ id: p.key, label: p.label, look: p.look }));

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {/* top bar */}
      <View style={s.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={s.close}>
          <Ionicons name="close" size={22} color={O.sub} />
        </Pressable>
        <Text style={s.topLabel}>Today’s quest</Text>
        <View style={{ width: 36 }} />
      </View>

      {phase === 'spin' && (
        <View style={s.center}>
          <Text style={s.kicker} numberOfLines={1}>{kicker}</Text>
          {guided && !landed && (
            <CoachTip step={2} style={{ marginTop: 14 }} text="I'm picking today's topic from your paths." />
          )}
          <View style={{ marginVertical: 28, alignSelf: 'stretch', minHeight: 200, justifyContent: 'center' }}>
            {picks
              ? <TopicWheel options={wheel} target={target} spinKey={spinKey} onLanded={() => setLanded(true)} />
              : <ActivityIndicator color={O.sub} />}
          </View>
          <View style={{ minHeight: 150, width: '100%', alignItems: 'center' }}>
            {landed && pick && (
              <Animated.View entering={FadeInDown.duration(380)} style={{ alignItems: 'center', width: '100%', gap: 18 }}>
                {/* the question + Let's go: highlighted together on the guided tour */}
                <View ref={letsGoRef} collapsable={false} style={{ alignSelf: 'stretch', alignItems: 'center', gap: 18 }}>
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    {!!concept && <Text style={[s.concept, { color: accent }]}>{concept}</Text>}
                    <Text style={[s.title, s.landedTitle]}>{pick.title}</Text>
                  </View>
                  <GlowButton label="Let’s go" onPress={() => setPhase('read')} style={{ alignSelf: 'stretch' }} />
                </View>
                <Spotlight
                  visible={guided}
                  target={letsGoRef}
                  step={2}
                  radius={34}
                  text="Here's today's question. Tap Let's go to read about it."
                  onPress={() => setPhase('read')}
                />
                {!rerolled && (picks?.length ?? 0) > 1 && (
                  <Pressable onPress={spinAgain} hitSlop={8}>
                    <Text style={s.link}>Not feeling it? Spin again</Text>
                  </Pressable>
                )}
              </Animated.View>
            )}
          </View>
        </View>
      )}

      {phase === 'read' && pick && (
        <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 18 }}>
            <View style={{ alignItems: 'center', marginTop: -44 }}>
              <Glim size={84} stage={glim.stage} palette={palette} mood={reading ? 'idle' : 'sleepy'} />
            </View>
            <View style={[s.pill, { borderColor: alpha(accent, 0.4), backgroundColor: alpha(accent, 0.1) }]}>
              <PathSigil style={pick.look} size={14} />
              <Text style={[s.pillText, { color: accent }]} numberOfLines={1}>
                {pick.path
                  ? `${pick.kind === 'discover' ? 'Discover · ' : ''}${pick.path.title} · Day ${(pick.order ?? 0) + 1} of ${pick.path.topicCount}`
                  : interestMeta(pick.interest)?.label}
              </Text>
            </View>

            {/* the question, and what it's really about */}
            <View style={{ gap: 6, marginTop: -4 }}>
              {!!concept && <Text style={[s.concept, { color: accent }]}>{concept}</Text>}
              <Text style={[s.title, { textAlign: 'left' }]}>{pick.title}</Text>
            </View>

            <LessonIllustration url={topic?.illustrationUrl} />

            {reading ? (
              <>
                {/* what you'll say afterwards: read with a purpose */}
                {!!topic?.points?.length && (
                  <View ref={missionRef} collapsable={false}>
                    <Text style={s.mission}>
                      <Text style={s.missionLabel}>You’ll explain: </Text>
                      {topic.points.map((p: string) => p.charAt(0).toLowerCase() + p.slice(1)).join(' · ')}
                    </Text>
                  </View>
                )}
                <Spotlight
                  visible={guided && !!topic?.points?.length}
                  target={missionRef}
                  step={3}
                  radius={14}
                  text="Afterwards you'll explain these 3 things. Read for about a minute."
                  cta="Start reading"
                />

                <RichReading text={reading} />

                {!!topic?.sources?.length && (
                  <View style={{ gap: 4 }}>
                    <Text style={s.barValue}>Sources</Text>
                    {topic.sources.map((src: string) => <Text key={src} style={s.source}>{src}</Text>)}
                  </View>
                )}
              </>
            ) : readingFailed ? (
              <View style={{ gap: 14, alignItems: 'flex-start' }}>
                <Text style={s.tipText}>{glim.name} couldn’t fetch today’s reading. Check your connection and try again.</Text>
                <GlowButton label="Try again" variant="ghost" onPress={() => prepare(pick)} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={O.sub} />
                <Text style={s.tipText}>{glim.name} is writing today’s reading…</Text>
              </View>
            )}
          </ScrollView>
          <View style={{ paddingHorizontal: 24 }}>
            {/* Explaining is Pro. While RevenueCat is still loading, let them through. */}
            <GlowButton label={`Explain it to ${glim.name}`} disabled={!reading} onPress={() => setPhase(isPremium || proLoading ? 'explain' : 'locked')} />
          </View>
        </Animated.View>
      )}

      {phase === 'explain' && pick && (
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(200)}
          style={{ flex: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 12 }}
        >
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Glim ref={glimRef} size={130} stage={glim.stage} palette={palette} mood="idle" />
          </View>
          <Text style={[s.title, { marginTop: 6 }]}>Explain it to {glim.name}</Text>

          {/* what you're explaining, with the path's mark */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)} style={s.topicCard}>
            <PathSigil style={pick.look} size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.topicKicker, { color: accent }]} numberOfLines={1}>
                {pick.path ? `Day ${(pick.order ?? 0) + 1} · ${pick.path.title}` : interestMeta(pick.interest)?.label ?? 'Today'}
              </Text>
              <Text style={s.topicTitle}>{pick.title}</Text>
              {!!concept && <Text style={s.topicConcept} numberOfLines={1}>{concept}</Text>}
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(260).duration(360)} style={s.coach}>
            Big idea → one example → why it matters.
          </Animated.Text>

          {/* mic sits low, in thumb reach */}
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {noSpeech && (
              <Text style={[s.sub, { marginBottom: 6 }]}>{glim.name} didn’t hear you — that one doesn’t count. Try again.</Text>
            )}
            <Spotlight
              visible={guided}
              target={micRef}
              step={4}
              radius={110}
              text="Now teach me! Tap the mic and explain it in your own words. You get 3 takes."
              cta="Let's do it"
            />
            <View ref={micRef} collapsable={false}>
            <VoiceExplain
              key={explainKey}
              accent={accent}
              rule="Up to 3 takes · 1 minute each"
              onStart={() => glimRef.current?.lookAt(0, 0.4)}
              onDone={onExplained}
            />
            </View>
          </View>
        </Animated.View>
      )}

      {phase === 'locked' && pick && (
        <Animated.View entering={FadeIn.duration(350)} style={[s.center, { paddingHorizontal: 24, gap: 14 }]}>
          <Glim ref={glimRef} size={140} stage={glim.stage} palette={palette} mood="idle" />
          <Text style={s.title}>Explaining is what grows {glim.name}</Text>
          <Text style={s.sub}>
            Tell {glim.name} what you just read, out loud, and get graded on it. That’s where it sticks — for both of you.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 10 }}>
            <GlowButton label="Unlock explaining" onPress={() => setShowPaywall(true)} />
            <Text style={[s.sub, { fontSize: 13 }]}>3 days free for new members · cancel anytime</Text>
            {!HARD_PAYWALL && <GlowButton
              variant="ghost"
              label="Not today — just read"
              onPress={() => {
                // Reading keeps the streak and moves the path on; only explaining earns XP.
                if (guided) useAppStore.getState().setGuidePending(false);
                completeQuest({
                  questId: pick.topicId ?? pick.key, interest: pick.interest, title: pick.title, concept: concept ?? undefined,
                  score: 0, accuracy: 0, clarity: 0, articulation: 0, xp: 0, feedback: '',
                  completedAt: Date.now(), pathId: pick.path?._id, topicId: pick.topicId,
                  pathTitle: pick.path?.title, readOnly: true,
                });
                setPhase('readDone');
              }}
            />}
          </View>
        </Animated.View>
      )}

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUnlocked={() => { setShowPaywall(false); setPhase('explain'); }}
      />

      {phase === 'readDone' && (
        <Animated.View entering={FadeIn.duration(350)} style={[s.center, { paddingHorizontal: 24, gap: 14 }]}>
          <Glim size={140} stage={glim.stage} palette={palette} mood="idle" />
          <Text style={s.title}>Read today ✓</Text>
          <Text style={s.sub}>Your streak is safe. {glim.name} grows when you explain — whenever you’re ready.</Text>
          <GlowButton label="Done" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </Animated.View>
      )}

      {phase === 'gradeError' && pick && (
        <Animated.View entering={FadeIn.duration(300)} style={[s.center, { gap: 14 }]}>
          <Glim size={130} stage={glim.stage} palette={palette} mood="sleepy" droop={0.15} />
          <Text style={s.title}>{glim.name} couldn’t grade this right now</Text>
          <Text style={s.sub}>
            {pick.topicId
              ? 'Your explanation is saved. Check your connection and try again.'
              : 'Grading needs an internet connection. Try again once you’re back online.'}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
            <GlowButton label="Try again" onPress={() => lastExplanation.current && onExplained(lastExplanation.current)} />
            <GlowButton variant="ghost" label="Close" onPress={onClose} />
          </View>
        </Animated.View>
      )}

      {phase === 'grading' && (
        <Animated.View entering={FadeIn.duration(300)} style={[s.center, { gap: 18 }]}>
          <Glim size={150} stage={glim.stage} palette={palette} mood="idle" />
          <Text style={s.title}>Grading…</Text>
          <Text style={s.sub}>{glim.name} is listening back to your explanation.</Text>
        </Animated.View>
      )}

      {phase === 'result' && grade && pick && (
        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 8 }}>
          <QuestResult
            grade={grade}
            xpBefore={xpBefore}
            glimName={glim.name}
            palette={palette}
            accent={accent}
            reviewDays={REVIEW_AFTER_DAYS}
            extraQuest={extraQuest}
            onDone={onClose}
            extra={
              <>
                {guided && (
                  <CoachTip step={5} style={{ marginBottom: 10 }}
                    text="That's it! Scores of 50+ earn XP and help me grow. See you tomorrow." />
                )}
                {pick.kind === 'discover' && pick.path && !activePaths[pick.path._id] && !followed && (
                  <GlowButton
                    label={`Go deeper: follow ${pick.path.title}`}
                    variant="ghost"
                    style={{ marginBottom: 6 }}
                    onPress={() => { addPath(pick.path!._id, 1); setFollowed(true); }}
                  />
                )}
                {followed && <Text style={[s.sub, { marginBottom: 10 }]}>Added to your paths. Day 2 comes up on the wheel.</Text>}
              </>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Paragraphs with **key phrases** in bold, so a skimmer sees what matters. */
function RichReading({ text }: { text: string }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <View style={{ gap: 16 }}>
      {paras.map((p, i) => (
        <Text key={i} style={s.body}>
          {p.split('**').map((part, k) => (k % 2 ? <Text key={k} style={s.bold}>{part}</Text> : part.replace(/[*_#`]/g, '')))}
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: O.card },
  topLabel: { color: O.sub, fontFamily: F.semi, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  kicker: { color: O.sub, fontFamily: F.semi, fontSize: 15 },
  title: { color: O.text, fontFamily: F.black, fontSize: 26, lineHeight: 31, textAlign: 'center', letterSpacing: -0.6 },
  sub: { color: O.sub, fontFamily: F.regular, fontSize: 15, textAlign: 'center' },
  topicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18,
    backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  topicKicker: { fontFamily: F.semi, fontSize: 12 },
  topicTitle: { color: O.text, fontFamily: F.black, fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
  topicConcept: { color: O.sub, fontFamily: F.semi, fontSize: 13, marginTop: 2 },
  landedTitle: { fontSize: 30, lineHeight: 36, paddingHorizontal: 8 },
  coach: { color: O.sub, fontFamily: F.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  body: { color: '#D9D7E3', fontFamily: F.regular, fontSize: 18, lineHeight: 28 },
  bold: { color: O.text, fontFamily: F.bold },
  concept: { fontFamily: F.bold, fontSize: 14 },
  mission: { color: O.sub, fontFamily: F.regular, fontSize: 15, lineHeight: 22, marginTop: -6 },
  missionLabel: { color: O.text, fontFamily: F.semi },
  link: { color: O.sub, fontFamily: F.semi, fontSize: 14, textDecorationLine: 'underline' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: F.bold, fontSize: 12 },
  tip: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, backgroundColor: O.card },
  source: { color: O.sub, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  tipText: { flex: 1, color: O.sub, fontFamily: F.regular, fontSize: 14, lineHeight: 20 },
  score: { color: O.text, fontFamily: F.black, fontSize: 64, textAlign: 'center', letterSpacing: -2, marginTop: 4 },
  barLabel: { color: O.text, fontFamily: F.semi, fontSize: 14 },
  barValue: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  track: { height: 8, borderRadius: 4, backgroundColor: O.card, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});

