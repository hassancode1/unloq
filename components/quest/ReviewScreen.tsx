// Bonus review: a few days after a quest that didn't fully land, the ideas you
// missed come back. Re-read if you like, explain it again, and earn bonus XP.
// A miss here costs nothing — it simply comes back again later.
import { Ionicons } from '@expo/vector-icons';
import { useAction, useConvexAuth, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Purchases from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { REVIEW_AFTER_DAYS, REVIEW_GREAT_BONUS, REVIEW_XP, XP_GREAT_SCORE, XP_MIN_SCORE } from '../../convex/lib/xp';
import type { QuestEntry } from '../../lib/quests';
import { useAppStore } from '../../store/useAppStore';
import Glim, { GlimHandle } from '../mascot/Glim';
import { paletteForInterests } from '../mascot/palettes';
import { F, GlowButton, O } from '../onboarding/ui';
import { VoiceExplain, type Explanation } from '../onboarding/VoiceExplain';

type Phase = 'recap' | 'explain' | 'grading' | 'gradeError' | 'result';

export default function ReviewScreen({ review, onClose }: {
  review: { day: string; entry: QuestEntry } | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!review} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {review && <ReviewFlow day={review.day} entry={review.entry} onClose={onClose} />}
    </Modal>
  );
}

function ReviewFlow({ day, entry, onClose }: { day: string; entry: QuestEntry; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const glimRef = useRef<GlimHandle>(null);
  const { isAuthenticated } = useConvexAuth();
  const glim = useAppStore((s) => s.glim);
  const completeReview = useAppStore((s) => s.completeReview);
  const palette = useMemo(() => paletteForInterests(glim.interests), [glim.interests]);
  const accent = palette[1];
  const topic = useQuery(api.paths.getTopic, entry.topicId ? { topicId: entry.topicId as Id<'pathTopics'> } : 'skip');
  const grade = useAction(api.pathsAi.gradeExplanation);
  const [phase, setPhase] = useState<Phase>('recap');
  const [showReading, setShowReading] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; xp: number; score: number; feedback: string } | null>(null);
  const missed = entry.missed ?? [];

  const lastExplanation = useRef<Explanation | null>(null);
  const [explainKey, setExplainKey] = useState(0);
  const [noSpeech, setNoSpeech] = useState(false);
  const onExplained = async (e: Explanation) => {
    lastExplanation.current = e;
    setNoSpeech(false);
    setPhase('grading');
    let g: { score: number; feedback: string; missed?: string[] } | null = null;
    try {
      const rcUserId = isAuthenticated ? undefined : await Purchases.getAppUserID().catch(() => undefined);
      const res = await grade({
        topicId: entry.topicId as Id<'pathTopics'>,
        rcUserId,
        ...(e.kind === 'audio'
          ? { audio: { base64: e.base64, mimeType: e.mimeType, durationMs: e.durationMs } }
          : { transcript: e.text }),
      });
      if (res.noSpeech) { setNoSpeech(true); setExplainKey((k) => k + 1); setPhase('explain'); return; }
      g = res;
    } catch {}
    // AI-only grading: never guess. Keep what they said and let them retry.
    if (!g) { setPhase('gradeError'); return; }
    const passed = g.score >= XP_MIN_SCORE;
    const xp = passed ? REVIEW_XP + (g.score >= XP_GREAT_SCORE ? REVIEW_GREAT_BONUS : 0) : 0;
    completeReview(day, { xp, passed, missed: g.missed ?? missed });
    setResult({ passed, xp, score: g.score, feedback: g.feedback });
    setPhase('result');
    setTimeout(() => {
      if (passed) { glimRef.current?.absorb(); glimRef.current?.happy(1800); }
      else glimRef.current?.no();
    }, 450);
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={st.top}>
        <Pressable onPress={onClose} hitSlop={12} style={st.close}>
          <Ionicons name="close" size={20} color={O.sub} />
        </Pressable>
        <Text style={st.kicker}>Bonus review</Text>
        <View style={{ width: 34 }} />
      </View>

      {phase === 'recap' && (
        <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center' }}>
              <Glim ref={glimRef} size={110} stage={glim.stage} palette={palette} mood="idle" />
            </View>
            <Text style={st.title}>{entry.title}</Text>
            <Text style={st.sub}>Last time, a few ideas slipped past {glim.name}. Nail them now for bonus XP.</Text>
            <View style={st.card}>
              <Text style={st.cardLabel}>To mention this time</Text>
              {missed.map((m) => (
                <View key={m} style={st.missedRow}>
                  <View style={[st.bullet, { backgroundColor: accent }]} />
                  <Text style={st.missedText}>{m}</Text>
                </View>
              ))}
            </View>
            {topic?.reading && (
              <Pressable onPress={() => setShowReading((v) => !v)} style={st.card}>
                <View style={st.rowBetween}>
                  <Text style={st.cardLabel}>Read it again</Text>
                  <Ionicons name={showReading ? 'chevron-up' : 'chevron-down'} size={16} color={O.sub} />
                </View>
                {showReading && (
                  <Animated.Text entering={FadeIn.duration(250)} style={st.reading}>{topic.reading}</Animated.Text>
                )}
              </Pressable>
            )}
          </ScrollView>
          <GlowButton label="Explain it again" onPress={() => { Haptics.selectionAsync().catch(() => {}); setPhase('explain'); }} />
        </Animated.View>
      )}

      {phase === 'explain' && (
        <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
          <View style={{ alignItems: 'center' }}>
            <Glim ref={glimRef} size={110} stage={glim.stage} palette={palette} mood="idle" />
          </View>
          <Text style={[st.title, { marginTop: 6 }]}>Explain it to {glim.name}</Text>
          <View style={[st.card, { marginTop: 16 }]}>
            <Text style={st.cardLabel}>Make sure you mention</Text>
            {missed.map((m) => (
              <View key={m} style={st.missedRow}>
                <View style={[st.bullet, { backgroundColor: accent }]} />
                <Text style={st.missedText}>{m}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {noSpeech && <Text style={[st.sub, { marginBottom: 6 }]}>Didn’t hear you — that one doesn’t count.</Text>}
            <VoiceExplain key={explainKey} accent={accent} rule={null} onStart={() => glimRef.current?.lookAt(0, 0.4)} onDone={onExplained} />
          </View>
        </Animated.View>
      )}

      {phase === 'grading' && (
        <View style={st.center}>
          <Glim size={140} stage={glim.stage} palette={palette} mood="idle" />
          <Text style={st.title}>Listening back…</Text>
        </View>
      )}

      {phase === 'gradeError' && (
        <View style={[st.center, { flex: 1 }]}>
          <Glim size={130} stage={glim.stage} palette={palette} mood="sleepy" droop={0.15} />
          <Text style={st.title}>{glim.name} couldn’t grade this right now</Text>
          <Text style={st.sub}>Your explanation is saved. Check your connection and try again.</Text>
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
            <GlowButton label="Try again" onPress={() => lastExplanation.current && onExplained(lastExplanation.current)} />
            <GlowButton variant="ghost" label="Close" onPress={onClose} />
          </View>
        </View>
      )}

      {phase === 'result' && result && (
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
          <View style={[st.center, { flex: 1, gap: 12 }]}>
            <Glim ref={glimRef} size={150} stage={useAppStore.getState().glim.stage} palette={palette} mood={result.passed ? 'happy' : 'idle'} />
            <Animated.Text entering={FadeInDown.delay(150).duration(380)} style={st.title}>
              {result.passed ? `${glim.name} got it this time` : 'Not quite yet'}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(220).duration(380)} style={[st.sub, result.passed && { color: accent }]}>
              {result.passed
                ? `+${result.xp} bonus XP${result.score >= XP_GREAT_SCORE ? ' · brilliant' : ''}`
                : `No worries — it’ll come back in ${REVIEW_AFTER_DAYS} days for another go.`}
            </Animated.Text>
            {!!result.feedback && (
              <Animated.Text entering={FadeInDown.delay(300).duration(380)} style={[st.sub, { marginTop: 6 }]}>{result.feedback}</Animated.Text>
            )}
          </View>
          <GlowButton label="Done" onPress={onClose} />
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg, paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: O.card },
  kicker: { color: O.sub, fontFamily: F.semi, fontSize: 14 },
  title: { color: O.text, fontFamily: F.black, fontSize: 24, lineHeight: 29, textAlign: 'center', letterSpacing: -0.5 },
  sub: { color: O.sub, fontFamily: F.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  card: { backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardLabel: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  missedText: { flex: 1, color: O.text, fontFamily: F.semi, fontSize: 15, lineHeight: 22 },
  reading: { color: '#C9C7D6', fontFamily: F.regular, fontSize: 15, lineHeight: 23 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
