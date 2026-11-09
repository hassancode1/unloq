import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// ── Tokens ─────────────────────────────────────────────────────────────────────
export const O = {
  bg: '#06050A',
  text: '#F5F5FA',
  sub: '#8E8C9E',
  faint: '#3A3846',
  card: '#121119',
  cardBorder: '#211F2B',
};

export const F = {
  regular: 'Inter-Regular',
  semi: 'Inter-Medium',
  bold: 'Inter-SemiBold',
  black: 'SpaceGrotesk-Bold',   // headlines, big numbers, buttons
  display: 'SpaceGrotesk-SemiBold',
};

export function alpha(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── Caption: words drift in one by one (Opal-style) ───────────────────────────
export function Caption({
  text, delay = 0, style, size = 26, align = 'center',
}: { text: string; delay?: number; style?: ViewStyle; size?: number; align?: 'center' | 'left' }) {
  const words = text.split(' ');
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }, style]}>
      {words.map((w, i) => (
        <Animated.Text
          key={`${w}-${i}`}
          entering={FadeInDown.delay(delay + i * 70).duration(520).easing(Easing.out(Easing.cubic))}
          style={{ color: O.text, fontFamily: F.black, fontSize: size, lineHeight: size * 1.18, letterSpacing: -size * 0.025 }}
        >
          {w}{i < words.length - 1 ? ' ' : ''}
        </Animated.Text>
      ))}
    </View>
  );
}

export function Sub({ children, delay = 300, style }: { children: React.ReactNode; delay?: number; style?: TextStyle }) {
  return (
    <Animated.Text
      entering={FadeIn.delay(delay).duration(600)}
      style={[{ color: O.sub, fontFamily: F.regular, fontSize: 16, lineHeight: 23, textAlign: 'center' }, style]}
    >
      {children}
    </Animated.Text>
  );
}

// ── Tap to continue ────────────────────────────────────────────────────────────
export function TapToContinue({ delay = 1200 }: { delay?: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.95, { duration: 900 }), withTiming(0.5, { duration: 900 }),
    ), -1, false));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.Text style={[s.tap, st]}>TAP TO CONTINUE</Animated.Text>
  );
}

// ── Press feedback wrapper ─────────────────────────────────────────────────────
function usePressScale(to = 0.96) {
  const sc = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return {
    style,
    onPressIn: () => { sc.value = withSpring(to, { damping: 15, stiffness: 400 }); },
    onPressOut: () => { sc.value = withSpring(1, { damping: 9, stiffness: 300 }); },
  };
}

// ── Primary button ─────────────────────────────────────────────────────────────
export function GlowButton({
  label, onPress, disabled, loading, variant = 'solid', style,
}: {
  label: string; onPress: () => void; disabled?: boolean;
  /** Spinner instead of the label; the button stays full-strength but can't be tapped. */
  loading?: boolean;
  variant?: 'solid' | 'ghost'; style?: ViewStyle;
}) {
  const p = usePressScale();
  return (
    <Animated.View style={[p.style, style, disabled && !loading && { opacity: 0.28 }]}>
      <Pressable
        disabled={disabled || loading}
        accessibilityState={{ busy: !!loading, disabled: !!(disabled || loading) }}
        onPressIn={p.onPressIn}
        onPressOut={p.onPressOut}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
        style={variant === 'solid' ? s.btn : s.btnGhost}
      >
        {loading
          ? <ActivityIndicator color={variant === 'solid' ? O.bg : O.sub} />
          : <Text style={variant === 'solid' ? s.btnText : s.btnGhostText}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

// ── Selectable chip ────────────────────────────────────────────────────────────
export function Chip({
  label, icon, selected, onPress, accent, sub, wide,
}: {
  label: string; icon?: ComponentProps<typeof Ionicons>['name']; selected?: boolean;
  onPress: () => void; accent: string; sub?: string; wide?: boolean;
}) {
  const p = usePressScale(0.93);
  const pop = useSharedValue(0);
  useEffect(() => {
    if (selected) pop.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 6 }));
  }, [selected]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.06 }] }));
  return (
    <Animated.View style={[p.style, popStyle, wide && { width: '100%' }]}>
      <Pressable
        onPressIn={p.onPressIn}
        onPressOut={p.onPressOut}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
        style={[
          s.chip,
          wide && s.chipWide,
          selected && { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.9) },
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={selected ? O.text : O.sub} style={{ marginRight: 8 }} />}
        <View style={wide ? { flex: 1 } : undefined}>
          <Text style={[s.chipText, selected && { color: O.text }]}>{label}</Text>
          {sub && <Text style={s.chipSub}>{sub}</Text>}
        </View>
        {wide && (
          <View style={[s.check, selected && { backgroundColor: accent, borderColor: accent }]}>
            {selected && <Ionicons name="checkmark" size={14} color={O.bg} />}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Top bar: back + progress ───────────────────────────────────────────────────
export function TopBar({ progress, onBack, accent }: { progress: number; onBack?: () => void; accent: string }) {
  const w = useSharedValue(progress);
  useEffect(() => { w.value = withSpring(progress, { damping: 18, stiffness: 120 }); }, [progress]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <Animated.View entering={FadeIn.duration(400)} style={s.topBar}>
      <Pressable hitSlop={12} onPress={onBack} style={{ opacity: onBack ? 1 : 0 }} disabled={!onBack}>
        <Ionicons name="chevron-back" size={24} color={O.sub} />
      </Pressable>
      <View style={s.track}>
        <Animated.View style={[s.fill, { backgroundColor: accent, shadowColor: accent }, fill]} />
      </View>
      <View style={{ width: 24 }} />
    </Animated.View>
  );
}

// ── Ambient drifting dust ──────────────────────────────────────────────────────
function Mote({ i, w, h }: { i: number; w: number; h: number }) {
  const seed = (n: number) => ((Math.sin(i * 999 + n * 77) + 1) / 2);
  const x = seed(1) * w;
  const y0 = seed(2) * h;
  const size = 1.5 + seed(3) * 2.5;
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(seed(4) * 3000, withRepeat(withTiming(1, { duration: 9000 + seed(5) * 9000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const peak = 0.4 * seed(6) + 0.1; // computed on JS — worklets can't call seed()
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.5, 1], [0.05, peak, 0.05]),
    transform: [{ translateY: -t.value * 40 }, { translateX: Math.sin(t.value * 3 + i) * 8 }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y0, width: size, height: size, borderRadius: size, backgroundColor: '#C9D6FF' }, st]} />;
}

export function Dust({ count = 22 }: { count?: number }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && Array.from({ length: count }, (_, i) => <Mote key={i} i={i} w={box.w} h={box.h} />)}
    </View>
  );
}

// ── Count-up number ────────────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 1400, start = true) {
  const [v, setV] = useState(0);
  const lastTick = useRef(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(target * eased);
      setV(next);
      // ticking haptic, throttled
      if (Date.now() - lastTick.current > 70 && p < 1) {
        lastTick.current = Date.now();
        Haptics.selectionAsync().catch(() => {});
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, start]);
  return v;
}

const s = StyleSheet.create({
  tap: { color: O.text, fontFamily: 'SpaceGrotesk-Medium', fontSize: 13, letterSpacing: 2.5, textAlign: 'center' },
  btn: { backgroundColor: O.text, borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  btnText: { color: O.bg, fontFamily: F.black, fontSize: 17, letterSpacing: -0.2 },
  btnGhost: { paddingVertical: 14, alignItems: 'center' },
  btnGhostText: { color: O.sub, fontFamily: F.bold, fontSize: 15 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999,
    backgroundColor: O.card, borderWidth: 1.5, borderColor: O.cardBorder,
  },
  chipWide: { borderRadius: 18, paddingVertical: 16 },
  chipText: { color: '#C9C7D6', fontFamily: F.bold, fontSize: 15 },
  chipSub: { color: O.sub, fontFamily: F.semi, fontSize: 13, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: O.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, height: 44 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#1A1922', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
