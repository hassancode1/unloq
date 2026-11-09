// Tiny animated scenes for the "Here's how Glim grows" rows — they replace icons.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Glim, { GlimStage } from '../mascot/Glim';
import type { GlimPalette } from '../mascot/palettes';
import { alpha } from './ui';

export const TILE = 60;

function Tile({ accent, children }: { accent: string; children: React.ReactNode }) {
  return <View style={[s.tile, { backgroundColor: alpha(accent, 0.12) }]}>{children}</View>;
}

// ── 1. Lines of text that fill in, as if being read ───────────────────────────
function ReadLine({ width, i, accent }: { width: number; i: number; accent: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    // each line reads after the previous one, then the page resets
    p.value = withRepeat(
      withSequence(
        withDelay(i * 650, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })),
        withDelay((2 - i) * 650 + 900, withTiming(0, { duration: 250 })),
      ),
      -1,
    );
  }, []);
  const fill = useAnimatedStyle(() => ({ width: p.value * width }));
  return (
    <View style={[s.line, { width, backgroundColor: alpha(accent, 0.18) }]}>
      <Animated.View style={[s.lineFill, { backgroundColor: accent }, fill]} />
    </View>
  );
}

export function ReadVisual({ accent }: { accent: string }) {
  return (
    <Tile accent={accent}>
      <View style={{ gap: 6 }}>
        {[30, 22, 27].map((w, i) => <ReadLine key={i} i={i} width={w} accent={accent} />)}
      </View>
    </Tile>
  );
}

// ── 2. Voice bars that pulse like someone talking ─────────────────────────────
function Bar({ i, accent }: { i: number; accent: string }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    const pattern = [[0.9, 0.35], [0.5, 1], [1, 0.4], [0.6, 0.95], [0.85, 0.3]][i];
    h.value = withDelay(i * 90, withRepeat(withSequence(
      withTiming(pattern[0], { duration: 260 + i * 40, easing: Easing.inOut(Easing.sin) }),
      withTiming(pattern[1], { duration: 300 + i * 30, easing: Easing.inOut(Easing.sin) }),
    ), -1, true));
  }, []);
  const st = useAnimatedStyle(() => ({ height: 6 + h.value * 24 }));
  return <Animated.View style={[s.bar, { backgroundColor: accent }, st]} />;
}

export function VoiceVisual({ accent }: { accent: string }) {
  return (
    <Tile accent={accent}>
      <View style={s.bars}>
        {[0, 1, 2, 3, 4].map((i) => <Bar key={i} i={i} accent={accent} />)}
      </View>
    </Tile>
  );
}

// ── 3. A tiny real Glim that grows, stage by stage ────────────────────────────
export function GrowVisual({ accent, palette }: { accent: string; palette: GlimPalette }) {
  const [stage, setStage] = useState<GlimStage>(1);
  useEffect(() => {
    const t = setInterval(() => setStage((x) => (x >= 3 ? 1 : ((x + 1) as GlimStage))), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <Tile accent={accent}>
      <Glim size={42} stage={stage} palette={palette} interactive={false} wander={false} />
    </Tile>
  );
}

const s = StyleSheet.create({
  tile: { width: TILE, height: TILE, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  line: { height: 4, borderRadius: 2, overflow: 'hidden' },
  lineFill: { height: 4, borderRadius: 2 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 },
  bar: { width: 4, borderRadius: 2 },
});
