// Renders a path's two-tone geometric mark (see lib/sigil.ts).
// `animate` builds it piece by piece — calm timed fade + drift, no springs.
// `lit` shows progress: the first `lit` pieces are filled, the rest are ghosts
// (faint fill + outline) that light up as the path is completed.
import { Canvas, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { makeSigil } from '../../lib/sigil';
import type { PathStyle } from '../../lib/pathColors';

interface Props {
  style: PathStyle;
  size: number;
  animate?: boolean;
  /** How many pieces are filled; the rest are drawn as ghosts. Default: all. */
  lit?: number;
}

interface Built { path: SkPath; color: string; dx: number; dy: number; ghost: boolean }

function Shape({ p, size }: { p: Built; size: number }) {
  if (!p.ghost) return <Path path={p.path} color={p.color} />;
  return (
    <Group>
      {/* neutral fill: a tinted one reads as muddy brown on the dark UI */}
      <Path path={p.path} color="#FFFFFF" opacity={0.035} />
      <Path path={p.path} color={p.color} opacity={0.75} style="stroke" strokeWidth={Math.max(1, size / 70)} />
    </Group>
  );
}

function Piece({ p, t, size }: { p: Built; t: SharedValue<number>; size: number }) {
  const opacity = useDerivedValue(() => t.value);
  const transform = useDerivedValue(() => [
    { translateX: p.dx * (1 - t.value) },
    { translateY: p.dy * (1 - t.value) },
  ]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Shape p={p} size={size} />
    </Group>
  );
}

function AnimatedPiece({ p, i, size }: { p: Built; i: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(120 + i * 90, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, []);
  return <Piece p={p} t={t} size={size} />;
}

export default function PathSigil({ style, size, animate = false, lit }: Props) {
  const pieces = useMemo<Built[]>(() => {
    const drift = size * 0.08;
    return makeSigil(style.sigil, size).flatMap((pc, i) => {
      const path = Skia.Path.MakeFromSVGString(pc.d);
      if (!path) return [];
      // pieces drift in from just outside their cell, toward the centre
      const dx = (pc.cell % 2 === 0 ? -1 : 1) * drift;
      const dy = (pc.cell < 2 ? -1 : 1) * drift;
      return [{ path, color: style.duo[pc.tone], dx, dy, ghost: lit !== undefined && i >= lit }];
    });
  }, [style.sigil, style.duo[0], style.duo[1], size, lit]);

  // inset by half a stroke so ghost outlines aren't clipped at the edges
  const sw = lit !== undefined ? Math.max(1, size / 70) : 0;
  const inset = [{ translateX: sw / 2 }, { translateY: sw / 2 }, { scale: (size - sw) / size }];

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Canvas style={{ width: size, height: size }}>
        <Group transform={inset}>
          {pieces.map((p, i) =>
            animate ? <AnimatedPiece key={i} p={p} i={i} size={size} /> : <Shape key={i} p={p} size={size} />,
          )}
        </Group>
      </Canvas>
    </View>
  );
}

/** The sigil on its quiet tile, for list rows and cards. */
export function SigilTile({
  style, size = 44, bg, border,
}: { style: PathStyle; size?: number; bg: string; border: string }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.3,
        backgroundColor: bg, borderWidth: 1, borderColor: border,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <PathSigil style={style} size={Math.round(size * 0.56)} />
    </View>
  );
}
