// One past quest, in full: the score, how you did on each skill, what you
// nailed, what to add, a simpler way to say it, and what you said.
// Quests from before feedback was saved show their scores only.
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Learned } from '../../lib/learningStats';
import PathSigil from '../paths/PathSigil';
import { Coin, ScoreRing, useEntryLook } from '../marks';
import { F, O, alpha } from '../onboarding/ui';
import Sheet, { Section } from './Sheet';

function fmtDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function QuestDetail({ item, onClose }: { item: Learned | null; onClose: () => void }) {
  const lookFor = useEntryLook();
  return (
    <Sheet visible={!!item} title="Your explanation" onClose={onClose}>
      {item && <Body item={item} look={lookFor(item.entry)} />}
    </Sheet>
  );
}

function Body({ item, look }: { item: Learned; look: ReturnType<ReturnType<typeof useEntryLook>> }) {
  const e = item.entry;
  const accent = look?.accent ?? O.text;
  const missed = e.missedIdeas ?? e.missed ?? [];
  const hasFeedback = !!(e.praise || e.betterVersion || e.transcript);

  return (
    <>
      {/* what it was */}
      <View style={st.head}>
        <Coin size={60}>{look && <PathSigil style={look} size={42} />}</Coin>
        <View style={{ flex: 1, gap: 3 }}>
          {!!e.concept && <Text style={[st.concept, { color: accent }]}>{e.concept}</Text>}
          <Text style={st.title}>{e.title}</Text>
          <Text style={st.meta} numberOfLines={1}>
            {[e.pathTitle, item.extra ? 'Keep learning' : null].filter(Boolean).join(' · ') || 'Daily quest'}
          </Text>
          <Text style={st.meta}>{fmtDay(item.day)}</Text>
        </View>
      </View>

      {e.readOnly ? (
        <Section>
          <Text style={st.body}>You read this one without explaining it, so there’s no score.</Text>
        </Section>
      ) : (
        <>
          {/* how it went */}
          <Section style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ScoreRing score={e.score} color={accent} track="#1D1C26" text={O.text} size={72} />
            <View style={{ flex: 1, gap: 9 }}>
              <Bar label="Accuracy" value={e.accuracy} color={accent} />
              <Bar label="Clarity" value={e.clarity} color={accent} />
              <Bar label="Delivery" value={e.articulation} color={accent} />
            </View>
          </Section>
          <Text style={[st.meta, { textAlign: 'center' }]}>
            {e.xp ? `+${e.xp} XP` : 'No XP'}{e.reviewXp ? ` · +${e.reviewXp} from the review` : ''}
          </Text>

          {(e.praise || e.feedback) && (
            <Section label="What you nailed">
              <Text style={st.body}>{e.praise || e.feedback}</Text>
            </Section>
          )}

          {(missed.length > 0 || !!e.tip) && (
            <Section label="Next time, add">
              {missed.map((m) => (
                <View key={m} style={st.bulletRow}>
                  <View style={[st.bullet, { backgroundColor: accent }]} />
                  <Text style={st.body}>{m}</Text>
                </View>
              ))}
              {!!e.tip && <Text style={[st.body, { color: O.sub }]}>{e.tip}</Text>}
            </Section>
          )}

          {!!e.betterVersion && (
            <Section label="A simpler way to say it" style={{ borderColor: alpha(accent, 0.35) }}>
              <Text style={[st.body, st.quote]}>“{e.betterVersion}”</Text>
            </Section>
          )}

          {!!e.transcript && <Transcript text={e.transcript} />}

          {!hasFeedback && (
            <Text style={[st.meta, { textAlign: 'center' }]}>
              Detailed feedback is saved for quests from now on.
            </Text>
          )}
        </>
      )}
    </>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={st.rowBetween}>
        <Text style={st.barLabel}>{label}</Text>
        <Text style={st.barValue}>{value}</Text>
      </View>
      <View style={st.track}><View style={[st.fill, { width: `${value}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function Transcript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)}>
      <Section>
        <View style={st.rowBetween}>
          <Text style={st.label}>What you said</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={O.sub} />
        </View>
        {open && <Animated.Text entering={FadeIn.duration(220)} style={[st.body, { color: '#C9C7D6' }]}>{text}</Animated.Text>}
      </Section>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  title: { color: O.text, fontFamily: F.black, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  meta: { color: O.sub, fontFamily: F.semi, fontSize: 13 },
  concept: { fontFamily: F.bold, fontSize: 13 },
  label: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  body: { color: O.text, fontFamily: F.semi, fontSize: 15, lineHeight: 22, flex: 1 },
  quote: { fontFamily: F.regular, color: '#E4E2EE' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barLabel: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  barValue: { color: O.text, fontFamily: F.bold, fontSize: 12 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#1D1C26', overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});
