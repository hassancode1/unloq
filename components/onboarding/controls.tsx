import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { F, O, alpha } from './ui';

// ── Hours slider ───────────────────────────────────────────────────────────────
export function HoursSlider({
  value, onChange, min = 1, max = 12, accent,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; accent: string }) {
  const track = useRef<View>(null);
  const left = useRef(0);
  const last = useRef(value);
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const active = useSharedValue(0);

  const toPx = (v: number) => ((v - min) / (max - min)) * w;

  useEffect(() => { if (w) x.value = toPx(value); }, [w]);

  const handle = (e: GestureResponderEvent) => {
    if (!w) return;
    const px = Math.max(0, Math.min(w, e.nativeEvent.pageX - left.current));
    x.value = px;
    const v = Math.round(min + (px / w) * (max - min));
    if (v !== last.current) {
      last.current = v;
      onChange(v);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const fill = useAnimatedStyle(() => ({ width: x.value }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 16 }, { scale: 1 + active.value * 0.18 }],
  }));

  return (
    <View
      style={{ paddingVertical: 18 }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { active.value = withSpring(1); handle(e); }}
      onResponderMove={handle}
      onResponderRelease={() => {
        active.value = withSpring(0);
        x.value = withSpring(toPx(last.current), { damping: 14, stiffness: 220 });
      }}
    >
      <View
        ref={track}
        style={s.track}
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
          track.current?.measure((_x, _y, _w, _h, pageX) => { left.current = pageX; });
        }}
      >
        <Animated.View style={[s.fill, { backgroundColor: accent }, fill]} />
      </View>
      <Animated.View pointerEvents="none" style={[s.thumb, { shadowColor: accent }, thumb]} />
      <View style={s.labels}>
        <Text style={s.label}>{min}h</Text>
        <Text style={s.label}>{max}h+</Text>
      </View>
    </View>
  );
}

// ── Hold to commit ─────────────────────────────────────────────────────────────
export function HoldButton({
  label, doneLabel, duration = 1500, accent, onHoldStart, onCancel, onComplete,
}: {
  label: string; doneLabel: string; duration?: number; accent: string;
  onHoldStart?: () => void; onCancel?: () => void; onComplete: () => void;
}) {
  const progress = useSharedValue(0);
  const press = useSharedValue(0);
  const [done, setDone] = useState(false);
  const [w, setW] = useState(0);
  const timers = useRef<{ done?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});
  const startedAt = useRef(0);

  const clear = () => {
    if (timers.current.done) clearTimeout(timers.current.done);
    if (timers.current.tick) clearInterval(timers.current.tick);
    timers.current = {};
  };
  useEffect(() => clear, []);

  const start = () => {
    if (done) return;
    onHoldStart?.();
    startedAt.current = Date.now();
    const remaining = duration * (1 - progress.value);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
    press.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
    // haptics ramp up as the bar fills
    timers.current.tick = setInterval(() => {
      const p = progress.value;
      const style = p < 0.4 ? Haptics.ImpactFeedbackStyle.Light
        : p < 0.8 ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(style).catch(() => {});
    }, 140);
    timers.current.done = setTimeout(() => {
      clear();
      setDone(true);
      press.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete();
    }, remaining);
  };

  const cancel = () => {
    if (done) return;
    clear();
    progress.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    press.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    onCancel?.();
  };

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.035 }] }));

  return (
    <Animated.View style={scale}>
      <View
        style={[s.hold, { borderColor: alpha(accent, 0.6) }]}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={start}
        onResponderRelease={cancel}
        onResponderTerminate={cancel}
      >
        <Text style={s.holdText}>{done ? doneLabel : label}</Text>
        {/* solid fill sweeping in; inside it the label flips to dark, so it reads as
            the white button "charging up" */}
        <Animated.View style={[s.holdFill, { backgroundColor: accent }, fill]}>
          <View style={[s.holdInner, { width: w }]}>
            <Text style={[s.holdText, { color: O.bg }]}>{done ? doneLabel : label}</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: '#1A1922', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  thumb: {
    position: 'absolute', top: 18 + 4 - 16, left: 0,
    width: 32, height: 32, borderRadius: 16, backgroundColor: O.text,
    shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  label: { color: O.sub, fontFamily: F.bold, fontSize: 13 },
  hold: {
    height: 60, borderRadius: 999, borderWidth: 1.5, overflow: 'hidden',
    backgroundColor: O.card, alignItems: 'center', justifyContent: 'center',
  },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  holdInner: { position: 'absolute', left: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  holdText: { color: O.text, fontFamily: F.black, fontSize: 17 },
});
