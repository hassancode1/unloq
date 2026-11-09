// A small "Glim says" tip used by the guided first quest. Calm fade in, a
// pointer toward what to tap, the step count, and a way to skip the tour.
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppStore } from '../../store/useAppStore';
import { F, O } from '../onboarding/ui';

export const GUIDE_STEPS = 5;

export default function CoachTip({ step, text, pointer, style, onSkip }: {
  step: number;
  text: string;
  /** Which side the little pointer is on (toward the thing to tap). */
  pointer?: 'up' | 'down';
  style?: ViewStyle;
  /** Defaults to ending the tour. */
  onSkip?: () => void;
}) {
  const name = useAppStore((s) => s.glim.name);
  const end = useAppStore((s) => s.setGuidePending);
  return (
    <Animated.View entering={FadeIn.delay(250).duration(380)} exiting={FadeOut.duration(160)} style={[st.wrap, style]}>
      {pointer === 'up' && <View style={[st.pointer, st.up]} />}
      <View style={st.card}>
        <View style={st.head}>
          <View style={st.dot} />
          <Text style={st.who}>{name}</Text>
          <Text style={st.step}>{step} of {GUIDE_STEPS}</Text>
          <View style={{ flex: 1 }} />
          {step < GUIDE_STEPS && (
            <Pressable onPress={onSkip ?? (() => end(false))} hitSlop={10}>
              <Text style={st.skip}>Skip tour</Text>
            </Pressable>
          )}
        </View>
        <Text style={st.text}>{text}</Text>
      </View>
      {pointer === 'down' && <View style={[st.pointer, st.down]} />}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center' },
  card: {
    alignSelf: 'stretch', backgroundColor: '#1A1924', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 5,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B9A6FF' },
  who: { color: O.text, fontFamily: F.bold, fontSize: 13 },
  step: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  skip: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
  text: { color: O.text, fontFamily: F.semi, fontSize: 14, lineHeight: 19 },
  pointer: { width: 14, height: 14, backgroundColor: '#1A1924', borderColor: 'rgba(255,255,255,0.16)', transform: [{ rotate: '45deg' }] },
  down: { marginTop: -8, borderRightWidth: 1, borderBottomWidth: 1 },
  up: { marginBottom: -8, borderLeftWidth: 1, borderTopWidth: 1, zIndex: 1 },
});
