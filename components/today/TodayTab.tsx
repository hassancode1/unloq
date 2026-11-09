// Today tab — Glim's home. One quest a day; streak breaks make Glim sad.
// Premium = fewer boxes, more atmosphere: Glim on its own glow, one clear
// action, and a quiet week row.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import type { AppColors } from '../../constants/Colors';
import { Spacing } from '../../constants/spacing';
import { usePathStyles } from '../../lib/pathColors';
import { currentStreak, dayKey, dueReview, lastWeek, stageProgress, streakBroken } from '../../lib/quests';
import { MAX_QUESTS_PER_DAY, REVIEW_XP } from '../../convex/lib/xp';
import ReviewScreen from '../quest/ReviewScreen';
import { usePathCatalog, useStarterPaths, useTodayItems } from '../../lib/usePaths';
import { SIGIL_DUOS, duoForSeed } from '../../lib/sigil';
import { useAppStore } from '../../store/useAppStore';
import Glim, { GLIM_STAGES, GlimHandle, GlimMood } from '../mascot/Glim';
import { paletteForInterests } from '../mascot/palettes';
import { F as OF, O, alpha } from '../onboarding/ui';
import PathSigil from '../paths/PathSigil';
import { Coin, ScoreRing, useEntryLook } from '../marks';
import Spotlight from '../guide/Spotlight';
import { GUIDE_PREVIEW } from '../../lib/features';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  onStartQuest: () => void;
  C: AppColors;
  fs: (n: number) => number;
  F: any;
}

export default function TodayTab({ onStartQuest, C, fs, F }: Props) {
  const glimRef = useRef<GlimHandle>(null);
  useStarterPaths();
  const glim = useAppStore((s) => s.glim);
  const guidePending = useAppStore((s) => s.guidePending);
  const questCardRef = useRef<View>(null);
  const questLog = useAppStore((s) => s.questLog);
  const items = useTodayItems();
  const styleFor = usePathStyles();
  const { byId } = usePathCatalog();
  /** The mark for a finished day: its path's, or a stable one from its topic. */
  const dayLook = useEntryLook();

  const today = GUIDE_PREVIEW && guidePending ? undefined : questLog[dayKey()];
  const todayLook = dayLook(today);
  const extrasToday = useAppStore((st) => st.extras?.[dayKey()]?.length ?? 0);
  const learnedToday = today ? 1 + extrasToday : 0;
  // Bonus review of missed ideas — offered once today's quest is done.
  const review = today ? dueReview(questLog) : undefined;
  const [reviewing, setReviewing] = useState<{ day: string; entry: typeof today & {} } | null>(null);
  const streak = currentStreak(questLog);
  const sad = streakBroken(questLog);
  const week = lastWeek(questLog);
  const progress = stageProgress(glim.xp);
  const palette = useMemo(() => paletteForInterests(glim.interests), [glim.interests]);
  const accent = palette[1];
  const stageName = GLIM_STAGES[progress.stage].name;
  const nextName = progress.next ? GLIM_STAGES[Math.min(4, progress.stage + 1)].name : null;

  // Marks of the paths on today's wheel (Discover hides its path, so skip it).
  const marks = useMemo(() => {
    const seen = new Set<string>();
    return (items ?? [])
      .filter((it) => it.kind === 'path' && !seen.has(it.path._id) && !!seen.add(it.path._id))
      .slice(0, 4)
      .map((it) => ({ id: it.path._id, look: styleFor(it.path), title: it.path.title }));
  }, [items]);

  const mood: GlimMood = today ? 'happy' : sad ? 'sleepy' : 'idle';
  const droop = today ? 0 : sad ? 0.45 : 0;
  // one short line — Glim's face already shows the mood
  const status = today?.readOnly
    ? 'You read together today.'
    : today
    ? `${glim.name} learned something today.`
    : sad
      ? `${glim.name} missed you.`
      : `${glim.name} is hungry to learn.`;

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStartQuest();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
        {/* this week, quietly */}
        <Animated.View entering={FadeIn.delay(80).duration(400)} style={s.weekWrap}>
          {/* each day you learned shows the mark of what you learned: a little collection */}
          <View style={s.week}>
            {week.map((d) => {
              const look = d.done ? dayLook(questLog[d.key]) : null;
              return (
                <View key={d.key} style={{ alignItems: 'center', gap: 10, flex: 1 }}>
                  <Text style={{ color: d.today || d.done ? C.text : C.muted, fontFamily: F.semiBold, fontSize: fs(13) }}>{d.label}</Text>
                  <Coin size={44} ring={d.today && !d.done}>
                    {look && <PathSigil style={look} size={32} />}
                  </Coin>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Glim, big and centred in the space under the week */}
        <Pressable onPress={() => glimRef.current?.poke()} style={s.stage}>
          <Glim ref={glimRef} size={250} stage={glim.stage} mood={mood} droop={droop} palette={palette} />
        </Pressable>

        {/* Glim's details — neutral tones, so Glim is the only colour here */}
        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={{ gap: 10, marginBottom: Spacing.lg }}>
          <View style={s.row}>
            <Text style={{ color: O.text, fontFamily: OF.black, fontSize: 26, letterSpacing: -0.5 }}>{glim.name}</Text>
            <View style={[s.stagePill, { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
              <View style={[s.stageDot, { backgroundColor: O.text }]} />
              <Text style={{ color: O.text, fontFamily: OF.semi, fontSize: 12 }}>{stageName}</Text>
            </View>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(3, progress.pct * 100)}%`, backgroundColor: O.text }]} />
          </View>
          <View style={s.row}>
            <Text style={{ color: O.sub, fontFamily: OF.regular, fontSize: 13, flex: 1 }} numberOfLines={1}>{status}</Text>
            <Text style={{ color: O.sub, fontFamily: OF.semi, fontSize: 12, marginLeft: 12 }}>
              {nextName ? `${progress.toNext} XP to ${nextName}` : 'Fully grown'}
            </Text>
          </View>
        </Animated.View>

        {/* the one action */}
        <Animated.View entering={FadeInDown.delay(140).duration(360)} style={{ marginBottom: Spacing.md }}>
          {today ? (
            <View style={{ gap: 10 }}>
            {/* what you learned today: its path's mark, the topic, and the score ring */}
            <View style={[s.card, s.doneCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Coin size={54}>
                {todayLook && <PathSigil style={todayLook} size={38} />}
              </Coin>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(12) }}>
                  {today.readOnly ? 'Read today' : 'Learned today'}
                </Text>
                <Text numberOfLines={2} style={{ color: C.text, fontFamily: F.bold, fontSize: fs(16), lineHeight: fs(21) }}>{today.title}</Text>
                <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>
                  {today.concept ?? today.pathTitle ?? (today.readOnly ? 'Explain next time to earn XP' : 'Today’s quest')}
                </Text>
              </View>
              {!today.readOnly && (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <ScoreRing score={today.score} color={todayLook?.accent ?? accent} track={C.surfaceAlt} text={C.text} />
                  <Text style={{ color: today.xp ? todayLook?.accent ?? accent : C.muted, fontFamily: F.semiBold, fontSize: fs(11) }}>
                    {today.xp ? `+${today.xp} XP` : 'no XP'}
                  </Text>
                </View>
              )}
            </View>

            {/* paying users can keep going: extras give bonus XP, paced (convex/lib/xp.ts) */}
            {learnedToday < MAX_QUESTS_PER_DAY ? (
              <Pressable
                onPress={start}
                accessibilityRole="button"
                accessibilityLabel="Keep learning: start the next topic for bonus XP"
                style={({ pressed }) => [s.keep, {
                  borderColor: C.border, backgroundColor: C.surface,
                  opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }],
                }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15) }}>Keep learning</Text>
                  <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>
                    {learnedToday > 1 ? `${learnedToday} learned today · start the next topic` : 'Start the next topic · bonus XP'}
                  </Text>
                </View>
                <NudgeArrow bg={C.text} fg={C.bg} />
              </Pressable>
            ) : (
              <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(13), textAlign: 'center' }}>
                {learnedToday} learned today — that’s plenty. {glim.name} will have more tomorrow.
              </Text>
            )}
            </View>
          ) : (
            <>
            <Spotlight
              visible={guidePending}
              target={questCardRef}
              step={1}
              radius={30}
              text="Tap your quest to start. It takes about 2 minutes."
              onPress={start}
            />
            <View ref={questCardRef} collapsable={false}>
            <Pressable onPress={start} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
              <View style={[s.cta, { backgroundColor: C.text }]}>
                {/* your paths, stacked like an avatar group — and the way in */}
                <View style={s.row}>
                  <View style={{ flexDirection: 'row' }}>
                    {(marks.length ? marks : [null]).map((m, i) => (
                      <View
                        key={m?.id ?? 'none'}
                        style={[s.mark, { backgroundColor: C.bg, borderColor: C.text, marginLeft: i ? -9 : 0, zIndex: 10 - i }]}
                      >
                        {m ? <PathSigil style={m.look} size={18} /> : <Ionicons name="sparkles" size={15} color={C.text} />}
                      </View>
                    ))}
                  </View>
                  <View style={[s.go, { backgroundColor: C.bg }]}>
                    <Ionicons name="arrow-forward" size={19} color={C.text} />
                  </View>
                </View>
                <View style={{ gap: 3, marginTop: 16 }}>
                  <Text style={{ color: C.bg, fontFamily: F.extraBold, fontSize: fs(22), letterSpacing: -0.5 }}>Your quest is ready</Text>
                  <Text style={{ color: C.bg, opacity: 0.55, fontFamily: F.semiBold, fontSize: fs(13) }}>
                    {marks.length > 1
                      ? `A topic from ${marks.length} of your paths · about 2 min`
                      : marks.length === 1
                        ? `Next up in ${marks[0].title} · about 2 min`
                        : 'One short read, then explain it · about 2 min'}
                  </Text>
                </View>
              </View>
            </Pressable>
            </View>
            </>
          )}
        </Animated.View>

        {review && (
          <Animated.View entering={FadeInDown.delay(180).duration(360)} style={{ marginTop: 10 }}>
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setReviewing(review); }}
              style={({ pressed }) => [s.card, { backgroundColor: C.surface, borderColor: C.border, opacity: pressed ? 0.9 : 1 }]}
            >
              <View style={[s.doneBadge, { backgroundColor: alpha(accent, 0.16) }]}>
                <Ionicons name="refresh" size={18} color={accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.sub, fontFamily: F.semiBold, fontSize: fs(12) }}>
                  Bonus review · +{REVIEW_XP} XP
                </Text>
                <Text numberOfLines={1} style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15) }}>{review.entry.title}</Text>
                <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: fs(12) }}>
                  {review.entry.missed?.length ?? 0} {review.entry.missed?.length === 1 ? 'idea' : 'ideas'} to revisit
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>
          </Animated.View>
        )}

      </View>

      <ReviewScreen review={reviewing} onClose={() => setReviewing(null)} />
    </View>
  );
}


/** The white arrow button, gently nudging right every few seconds: "tap me". */
function NudgeArrow({ bg, fg }: { bg: string; fg: string }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(4, { duration: 220, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[s.goSmall, { backgroundColor: bg }]}>
      <Animated.View style={st}>
        <Ionicons name="arrow-forward" size={19} color={fg} />
      </Animated.View>
    </View>
  );
}


const s = StyleSheet.create({
  doneCard: { paddingVertical: 16, gap: 14 },
  keep: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13 },
  goSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // runs down behind the tab bar so there's no hard edge at the bottom
  glow: { position: 'absolute', left: 0, right: 0, bottom: -140, height: 720 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stage: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingBottom: 56 },
  stagePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, borderWidth: 1 },
  cta: { borderRadius: 24, padding: 18, paddingTop: 16 },
  mark: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  doneBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  go: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  weekWrap: { gap: 12, marginTop: Spacing.sm },
  week: { flexDirection: 'row' },
  day: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
