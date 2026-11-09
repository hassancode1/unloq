// iOS-timer-style picker wheel: topics roll past on a 3D drum, ticking on every
// row, slow down as if deciding, then settle on today's pick in the centre pill.
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { PathStyle } from '../../lib/pathColors';
import { playReveal, playTick } from '../../lib/sfx';
import PathSigil from '../paths/PathSigil';
import { F, O } from '../onboarding/ui';

export interface WheelOption {
  id: string;
  label: string;
  /** The path's mark + duotone (see lib/sigil.ts). */
  look: PathStyle;
}

interface Props {
  options: WheelOption[];
  /** Index into `options` the wheel should land on. */
  target: number;
  /** Change this to start a new spin. */
  spinKey: number;
  onLanded: () => void;
}

const ROW = 46;                 // row height
const STEP = 19;                // degrees between rows on the drum
const RADIUS = ROW / 2 / Math.tan(((STEP / 2) * Math.PI) / 180); // drum radius in px
const VISIBLE = 4;              // rows drawn above/below centre
const LAPS = 5;                 // how many times the list rolls past
const SPIN_MS = 3600;

export default function TopicWheel({ options, target, spinKey, onLanded }: Props) {
  const n = options.length;
  // The list repeated so the wheel has room to roll several laps.
  const rows = useMemo(
    () => Array.from({ length: n * (LAPS + 3) }, (_, i) => options[i % n]),
    [options],
  );
  // Fractional row index under the centre pill. Starts one lap in so there are
  // rows above the centre too.
  const pos = useSharedValue(n);

  const tick = () => {
    playTick();
    Haptics.selectionAsync().catch(() => {});
  };
  const land = () => {
    playReveal();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onLanded();
  };

  useEffect(() => {
    if (!spinKey) return;
    // Rows repeat every n, so jumping back to lap 1 at the same spot is invisible.
    pos.value = n + (Math.round(pos.value) % n);
    const end = (LAPS + 1) * n + target;
    const done = (ok?: boolean) => { 'worklet'; if (ok) runOnJS(land)(); };
    // Three endings, picked at random, so you can't read the result off the
    // last slow rows (otherwise it always "takes the one coming up from below"):
    const ending = Math.random();
    if (ending < 0.34) {
      // almost stops one row early… then clicks over
      pos.value = withSequence(
        withTiming(end - 1.12, { duration: SPIN_MS - 500, easing: Easing.bezier(0.12, 0.7, 0.25, 1) }),
        withDelay(260, withTiming(end, { duration: 420, easing: Easing.inOut(Easing.cubic) }, done)),
      );
    } else if (ending < 0.67) {
      // drifts a little past the topic, then eases back onto it
      pos.value = withSequence(
        withTiming(end + 0.42, { duration: SPIN_MS - 450, easing: Easing.bezier(0.12, 0.7, 0.25, 1) }),
        withDelay(120, withTiming(end, { duration: 480, easing: Easing.inOut(Easing.quad) }, done)),
      );
    } else {
      // stops cleanly, a touch quicker at the end
      pos.value = withTiming(end, { duration: SPIN_MS - 300, easing: Easing.bezier(0.15, 0.65, 0.3, 1) }, done);
    }
  }, [spinKey]);

  // Tick each time a new row snaps into the centre.
  useAnimatedReaction(
    () => Math.round(pos.value),
    (i, prev) => { if (prev !== null && i !== prev) runOnJS(tick)(); },
  );

  return (
    <View style={s.wrap}>
      {/* centre highlight pill, like the iOS timer */}
      <View style={s.pill} />
      {rows.map((o, i) => (
        <WheelRow key={i} option={o} index={i} pos={pos} />
      ))}
    </View>
  );
}

function WheelRow({ option, index, pos }: { option: WheelOption; index: number; pos: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = index - pos.value;
    if (Math.abs(d) > VISIBLE + 0.5) return { opacity: 0, transform: [{ translateY: 0 }] };
    const a = (d * STEP * Math.PI) / 180;
    const centre = Math.max(0, 1 - Math.abs(d));
    return {
      opacity: Math.max(0, Math.cos(a)) * (0.35 + centre * 0.65),
      transform: [
        { perspective: 600 },
        { translateY: RADIUS * Math.sin(a) },
        { rotateX: `${-d * STEP}deg` },
        { scale: 0.94 + centre * 0.06 },
      ],
    };
  });

  return (
    <Animated.View style={[s.row, style]}>
      <PathSigil style={option.look} size={20} />
      <Text numberOfLines={1} style={s.label}>{option.label}</Text>
    </Animated.View>
  );
}

const HEIGHT = Math.round(RADIUS * 2 * 0.86);

const s = StyleSheet.create({
  wrap: {
    width: '100%',
    height: HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
    borderRadius: ROW / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  label: {
    color: O.text,
    fontFamily: F.bold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
});
