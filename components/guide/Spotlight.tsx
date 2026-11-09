// A real tour step: dims the whole screen, cuts a bright window around one
// element (with a slow glowing ring), and points a Glim tip at it. Tapping the
// highlighted element runs `onPress`; everything else is blocked. Steps with no
// tappable action get a "Got it" button instead.
import React, { useEffect, useState, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useAppStore } from '../../store/useAppStore';
import { F, O } from '../onboarding/ui';
import { GUIDE_STEPS } from './CoachTip';

type Box = { x: number; y: number; w: number; h: number };
const PAD = 8;

export default function Spotlight({ visible, target, step, text, radius = 22, onPress, cta }: {
  visible: boolean;
  /** The element to highlight (measured in window coordinates). */
  target: RefObject<View | null>;
  step: number;
  text: string;
  radius?: number;
  /** Tapping the highlighted element. Omit to show a "Got it" button instead. */
  onPress?: () => void;
  /** Label of the button when there's no tap-through action. */
  cta?: string;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const endTour = useAppStore((s) => s.setGuidePending);
  const name = useAppStore((s) => s.glim.name);
  const [box, setBox] = useState<Box | null>(null);
  const [open, setOpen] = useState(false);

  // measure once the screen has settled (entrance animations take ~400 ms)
  useEffect(() => {
    if (!visible) { setOpen(false); setBox(null); return; }
    const t = setTimeout(() => {
      target.current?.measureInWindow((x, y, w, h) => {
        if (!w || !h) return;
        setBox({ x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 });
        setOpen(true);
      });
    }, 650);
    return () => clearTimeout(t);
  }, [visible]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.025 }],
  }));

  if (!open || !box) return null;
  const below = box.y + box.h / 2 < H * 0.5; // tip goes below targets in the top half
  const done = () => setOpen(false);
  // a compact tip, centred over the target (kept on screen)
  const tipW = Math.min(290, W - 32);
  const cx = box.x + box.w / 2;
  const tipX = Math.min(W - 16 - tipW, Math.max(16, cx - tipW / 2));
  const px = Math.min(tipW - 28, Math.max(14, cx - tipX - 7));

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => {}}>
      <Animated.View entering={FadeIn.duration(280)} style={StyleSheet.absoluteFill}>
        {/* the dim, with a rounded window cut out */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Mask id="hole">
              <Rect x={0} y={0} width={W} height={H} fill="#fff" />
              <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={radius} fill="#000" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="rgba(3,2,8,0.78)" mask="url(#hole)" />
        </Svg>

        {/* block taps everywhere except the window */}
        <View style={[st.block, { top: 0, left: 0, right: 0, height: box.y }]} />
        <View style={[st.block, { top: box.y + box.h, left: 0, right: 0, bottom: 0 }]} />
        <View style={[st.block, { top: box.y, left: 0, width: box.x, height: box.h }]} />
        <View style={[st.block, { top: box.y, left: box.x + box.w, right: 0, height: box.h }]} />

        {/* glowing ring + the tappable window */}
        <Animated.View pointerEvents="none" style={[st.ring, { left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius }, ring]} />
        <Pressable
          disabled={!onPress}
          onPress={() => { done(); onPress?.(); }}
          style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius }}
          accessibilityRole="button"
        />

        {/* the tip */}
        <View style={[st.tipWrap, { left: tipX, width: tipW }, below ? { top: box.y + box.h + 12 } : { bottom: H - box.y + 12 }]}>
          {below && <View style={[st.pointer, st.up, { left: px }]} />}
          <View style={st.tip}>
            <View style={st.head}>
              <View style={st.dot} />
              <Text style={st.who}>{name}</Text>
              <Text style={st.step}>{step} of {GUIDE_STEPS}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => { done(); endTour(false); }} hitSlop={10}>
                <Text style={st.skip}>Skip tour</Text>
              </Pressable>
            </View>
            <Text style={st.text}>{text}</Text>
            {!onPress && (
              <Pressable onPress={done} style={({ pressed }) => [st.cta, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={st.ctaText}>{cta ?? 'Got it'}</Text>
              </Pressable>
            )}
          </View>
          {!below && <View style={[st.pointer, st.down, { left: px }]} />}
        </View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  block: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#B9A6FF', shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  tipWrap: { position: 'absolute' },
  tip: {
    backgroundColor: '#1A1924', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, gap: 5,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B9A6FF' },
  who: { color: O.text, fontFamily: F.bold, fontSize: 12 },
  step: { color: O.sub, fontFamily: F.semi, fontSize: 11 },
  skip: { color: O.sub, fontFamily: F.semi, fontSize: 11 },
  text: { color: O.text, fontFamily: F.semi, fontSize: 14, lineHeight: 19 },
  cta: { alignSelf: 'flex-end', backgroundColor: O.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 2 },
  ctaText: { color: O.bg, fontFamily: F.bold, fontSize: 13 },
  pointer: { position: 'absolute', width: 14, height: 14, backgroundColor: '#1A1924', borderColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '45deg' }] },
  up: { top: -7, borderLeftWidth: 1, borderTopWidth: 1, zIndex: 1 },
  down: { bottom: -7, borderRightWidth: 1, borderBottomWidth: 1 },
});
