import * as Haptics from 'expo-haptics';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { GestureResponderEvent, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  SkPath,
  Skia,
  SweepGradient,
  notifyChange,
  useClock,
} from '@shopify/react-native-skia';
import {
  DerivedValue,
  Easing,
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { DEFAULT_PALETTE, GREY_PALETTE, GlimPalette } from './palettes';
import { playReaction } from '../../lib/sfx';

// ── Growth stages ──────────────────────────────────────────────────────────────
export type GlimStage = 0 | 1 | 2 | 3 | 4;
export type GlimMood = 'idle' | 'sleepy' | 'happy';

export const GLIM_STAGES = [
  { name: 'Spark',   scale: 0.50, vibrance: 0,    iris: 0,    glow: 0.05 },
  { name: 'Glow',    scale: 0.62, vibrance: 0.55, iris: 0.08, glow: 0.20 },
  { name: 'Drop',    scale: 0.76, vibrance: 0.88, iris: 0.16, glow: 0.32 },
  { name: 'Bloom',   scale: 0.88, vibrance: 1,    iris: 0.24, glow: 0.45 },
  { name: 'Radiant', scale: 1.00, vibrance: 1,    iris: 0.32, glow: 0.70 },
] as const;

export interface GlimHandle {
  /** Squish + light haptic (same as user tap). */
  poke: () => void;
  /** ^^ eyes for `ms`. */
  happy: (ms?: number) => void;
  nod: () => void;
  /** Side-to-side "nope" wiggle. */
  no: () => void;
  jump: () => void;
  /** Swallow something (interest bubble, a learned fact): big squash + glow flash. */
  absorb: () => void;
  /** Point eyes at a normalized target, -1..1 on each axis. */
  lookAt: (x: number, y: number) => void;
}

interface Props {
  /** Layout width. Glow/particles spill outside this box (not clipped). */
  size?: number;
  stage?: GlimStage;
  mood?: GlimMood;
  palette?: GlimPalette;
  /** 0..1 — "brain rot": melts into a dull puddle, tip wilts, eyes dim. */
  droop?: number;
  /** Responds to touches (eye tracking, tap squish, jelly drag). Default true. */
  interactive?: boolean;
  /** Random idle glances when nobody is touching. Default true. */
  wander?: boolean;
}

// Plain {x,y} / {x,y,width,height} objects instead of Skia host objects.
// Returning Skia objects from useDerivedValue can make Reanimated mistake them
// for animations ("animation.onStart is not a function"). Skia's native side
// accepts plain points/rects, so these are safe drop-ins.
type Pt = { x: number; y: number };
type Rc = { x: number; y: number; width: number; height: number };
function pt(x: number, y: number): Pt {
  'worklet';
  return { x, y };
}
function rc(x: number, y: number, width: number, height: number): Rc {
  'worklet';
  return { x, y, width, height };
}

type Num = SharedValue<number> | DerivedValue<number>;
const TAU = Math.PI * 2;
const K = 0.5523; // circle → cubic bézier constant

function clamp(v: number, lo: number, hi: number) {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── Droplet outline ────────────────────────────────────────────────────────────
// Round bulb (rx, ry around cx, cy) rising to a soft tip `tipH` above centre,
// leaning `lean` px to the right.
export function dropPath(p: SkPath, cx: number, cy: number, rx: number, ry: number, tipH: number, lean: number) {
  'worklet';
  const tx = cx + lean;
  const ty = cy - tipH;
  const c = Math.min(rx, ry) * 0.09; // tip roundness
  p.reset();
  p.moveTo(tx - c, ty + c);
  p.quadTo(tx + c * 0.2, ty - c * 0.9, tx + c, ty + c * 0.6);
  // right shoulder
  p.cubicTo(tx + c + rx * 0.25, ty + tipH * 0.25, cx + rx, cy - ry * 0.8, cx + rx, cy);
  // bulb
  p.cubicTo(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry);
  p.cubicTo(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy);
  // long left side back up to the tip
  p.cubicTo(cx - rx, cy - ry * 0.9, tx - c - rx * 0.5, ty + tipH * 0.5, tx - c, ty + c);
  p.close();
}

// ── Glass body fill (rendered twice: grey + colour, crossfaded) ────────────────
function BodyFill({
  palette, body, top, bottom, center, edgeR, opacity,
}: {
  palette: GlimPalette; body: SharedValue<SkPath>;
  top: DerivedValue<Pt>; bottom: DerivedValue<Pt>;
  center: DerivedValue<Pt>; edgeR: Num; opacity: Num | number;
}) {
  const [light, mid, deep] = palette;
  const vertical = useMemo(() => [rgba(mid, 0.38), rgba(mid, 0.72), rgba(light, 0.96)], [light, mid]);
  const edge = useMemo(() => [rgba(deep, 0), rgba(deep, 0.12), rgba(deep, 0.6)], [deep]);
  return (
    <Group opacity={opacity}>
      <Path path={body}>
        <LinearGradient start={top} end={bottom} colors={vertical} positions={[0, 0.55, 1]} />
      </Path>
      {/* darker toward the edges → reads as a volume of glass */}
      <Path path={body}>
        <RadialGradient c={center} r={edgeR} colors={edge} positions={[0, 0.6, 1]} />
      </Path>
    </Group>
  );
}

// ── Orbiting spark (Radiant) ───────────────────────────────────────────────────
function Spark({
  i, clock, cx, cy, R, visible, color,
}: {
  i: number; clock: SharedValue<number>; cx: Num; cy: Num; R: Num; visible: Num; color: string;
}) {
  const pos = useDerivedValue(() => {
    const t = clock.value / 1000;
    const a = t / 3 + (i * TAU) / 6;
    const rad = R.value * (1.75 + 0.1 * Math.sin(t * 1.4 + i));
    return pt(cx.value + Math.cos(a) * rad, cy.value - R.value * 0.3 + Math.sin(a) * rad * 0.75);
  });
  const r = useDerivedValue(() => R.value * (0.04 + 0.015 * Math.sin(clock.value / 400 + i)));
  const op = useDerivedValue(() => visible.value * (0.5 + 0.5 * Math.sin(clock.value / 600 + i * 2)));
  return (
    <Circle c={pos} r={r} color={color} opacity={op}>
      <BlurMask blur={3} style="solid" />
    </Circle>
  );
}

// ── Rising bubble inside the glass (Bloom+) ────────────────────────────────────
function Bubble({
  i, clock, cx, cy, R, visible, slosh,
}: {
  i: number; clock: SharedValue<number>; cx: Num; cy: Num; R: Num; visible: Num;
  /** -1..1: bubbles swing inside the glass after an impact */
  slosh: Num;
}) {
  const speeds = [0.16, 0.11, 0.2];
  const phase = useDerivedValue(() => ((clock.value / 1000) * speeds[i] + i * 0.37) % 1);
  const pos = useDerivedValue(() => {
    const p = phase.value;
    const x = cx.value + (i - 1) * R.value * 0.35 + Math.sin(p * TAU * 1.5 + i) * R.value * 0.08
      + slosh.value * R.value * (0.28 + i * 0.06);
    const y = cy.value + R.value * 0.75 - p * R.value * 1.5 - Math.abs(slosh.value) * R.value * 0.15;
    return pt(x, y);
  });
  const r = useDerivedValue(() => R.value * (0.05 + i * 0.015) * (0.6 + phase.value * 0.5));
  const op = useDerivedValue(() => visible.value * Math.sin(phase.value * Math.PI) * 0.75);
  return <Circle c={pos} r={r} color="white" opacity={op} style="stroke" strokeWidth={1.5} />;
}

// ── Splash droplet (landing from a jump) ───────────────────────────────────────
// t: 0→1 the droplet flies out in an arc and lands; g: 0→1 it's pulled back
// and merges into Glim as Glim re-forms. Nothing just vanishes.
const SPLASH_N = 7;
function SplashDrop({
  i, t, g, x0, y0, cx, cy, R, color,
}: {
  i: number; t: SharedValue<number>; g: SharedValue<number>;
  x0: number; y0: Num; cx: Num; cy: Num; R: Num; color: string;
}) {
  const a = Math.PI * (0.22 + (0.56 * i) / (SPLASH_N - 1)); // a fountain: mostly up, a little out
  const speed = 0.8 + ((i * 37) % 5) * 0.12;              // a little variety per drop
  const pos = useDerivedValue(() => {
    const k = g.value > 0 ? 1 : t.value;
    const H = Math.sin(a) * R.value * 3.8 * speed;
    const ox = x0 + Math.cos(a) * R.value * (0.7 + 1.5 * speed * k);
    const oy = y0.value - R.value * 0.1 - H * k + H * k * k; // up, then back to the floor
    if (g.value <= 0) return pt(ox, oy);
    const e = g.value * g.value;                             // accelerate into the body
    const tx = cx.value, ty = cy.value + R.value * 0.3;
    return pt(ox + (tx - ox) * e, oy + (ty - oy) * e - R.value * 0.55 * Math.sin(Math.PI * g.value));
  });
  const r = useDerivedValue(() =>
    R.value * (i % 2 ? 0.1 : 0.15) * (g.value > 0 ? 0.75 * (1 - g.value * 0.5) : 1 - t.value * 0.25));
  const op = useDerivedValue(() => {
    if (t.value <= 0.001) return 0;
    if (g.value >= 0.999) return 0;
    return g.value > 0 ? 0.9 * (1 - g.value * 0.4) : 1 - t.value * 0.15;
  });
  return <Circle c={pos} r={r} color={color} opacity={op} />;
}

// ── Glim ───────────────────────────────────────────────────────────────────────
const Glim = forwardRef<GlimHandle, Props>(function Glim(
  {
    size = 220,
    stage = 0,
    mood = 'idle',
    palette = DEFAULT_PALETTE,
    droop = 0,
    interactive = true,
    wander = true,
  },
  ref,
) {
  // Layout box vs. (bigger) drawing surface so glows never get clipped.
  const W = size;
  const H = size * 1.2;
  const pad = size * 0.4;
  const CW = W + pad * 2;
  const CH = H + pad * 2;
  const baseCx = pad + W / 2;
  const groundY = pad + H * 0.92;
  const maxR = size * 0.3; // bulb radius at full growth

  const clock = useClock();
  const cfg = GLIM_STAGES[stage];

  // Stage-driven
  const growth = useSharedValue(cfg.scale);
  const vibrance = useSharedValue(cfg.vibrance);
  const iris = useSharedValue(cfg.iris);
  const glow = useSharedValue(cfg.glow);
  const fizz = useSharedValue(stage >= 3 ? 1 : 0);
  const sparkle = useSharedValue(stage >= 4 ? 1 : 0);
  // Mood / props
  const droopV = useSharedValue(droop);
  const lid = useSharedValue(mood === 'sleepy' ? 0.4 : 1);
  const happyV = useSharedValue(mood === 'happy' ? 1 : 0);
  // Reactions
  const squash = useSharedValue(0); // +: wide & short, -: tall & thin
  const jumpY = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const flash = useSharedValue(0);
  const splat = useSharedValue(0);   // 0..1: flattened into a puddle on landing
  const splashT = useSharedValue(0); // 0..1: landing droplets in flight
  const ring = useSharedValue(0);    // 0..1: ripple of light when absorbing
  const gather = useSharedValue(0);  // 0..1: splash droplets merging back in
  const flick = useSharedValue(0);   // -1..1: the tip lagging / whipping (secondary motion)
  const slosh = useSharedValue(0);   // -1..1: bubbles swinging inside after an impact
  const blink = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);

  const touching = useRef(false);
  const touchStart = useRef({ x: 0, y: 0, moved: false });

  // ── Respond to prop changes ──
  useEffect(() => {
    const c = GLIM_STAGES[stage];
    growth.value = withSpring(c.scale, { damping: 9, stiffness: 120 });
    vibrance.value = withTiming(c.vibrance, { duration: 900 });
    iris.value = withTiming(c.iris, { duration: 900 });
    glow.value = withTiming(c.glow, { duration: 900 });
    fizz.value = withTiming(stage >= 3 ? 1 : 0, { duration: 600 });
    sparkle.value = withTiming(stage >= 4 ? 1 : 0, { duration: 800 });
  }, [stage]);

  useEffect(() => {
    droopV.value = withTiming(droop, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [droop]);

  useEffect(() => {
    lid.value = withTiming(mood === 'sleepy' ? 0.4 : 1, { duration: 300 });
    happyV.value = withTiming(mood === 'happy' ? 1 : 0, { duration: 200 });
  }, [mood]);

  // ── Random blinks ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        const double = Math.random() < 0.2;
        blink.value = double
          ? withSequence(
              withTiming(0.05, { duration: 60 }), withTiming(1, { duration: 90 }),
              withTiming(0.05, { duration: 60 }), withTiming(1, { duration: 110 }),
            )
          : withSequence(withTiming(0.05, { duration: 70 }), withTiming(1, { duration: 120 }));
        loop();
      }, 2200 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  // ── Idle glances ──
  useEffect(() => {
    if (!wander) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (!touching.current) {
          const center = Math.random() < 0.4;
          lookX.value = withSpring(center ? 0 : Math.random() * 2 - 1, { damping: 14 });
          lookY.value = withSpring(center ? 0 : Math.random() * 1.2 - 0.6, { damping: 14 });
        }
        loop();
      }, 1800 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(timer);
  }, [wander]);

  // ── Imperative reactions ──
  const poke = () => {
    squash.value = withSequence(
      withTiming(1, { duration: 70 }),
      withSpring(0, { damping: 4, stiffness: 260 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const happy = (ms = 1200) => {
    happyV.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(ms, withTiming(mood === 'happy' ? 1 : 0, { duration: 200 })),
    );
  };
  const nod = () => {
    lookX.value = withSpring(0);
    lookY.value = withSequence(
      withTiming(0.9, { duration: 120 }), withTiming(-0.2, { duration: 140 }),
      withTiming(0.9, { duration: 120 }), withSpring(0),
    );
    squash.value = withSequence(withTiming(0.35, { duration: 120 }), withSpring(0, { damping: 6 }));
  };
  const no = () => {
    const d = size * 0.05;
    shakeX.value = withSequence(
      withTiming(-d, { duration: 60 }), withTiming(d, { duration: 80 }),
      withTiming(-d * 0.7, { duration: 80 }), withTiming(d * 0.5, { duration: 80 }),
      withSpring(0, { damping: 10 }),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  // Jump: crouch → stretch up → land and splat into a watery puddle (droplets
  // splash out) → pull back together with a jelly wobble.
  const jump = () => {
    const crouch = 140, rise = 340, fall = 240;
    const land = crouch + rise + fall;
    squash.value = withSequence(
      withTiming(0.85, { duration: crouch, easing: Easing.out(Easing.quad) }),  // gather
      withTiming(-0.8, { duration: 150, easing: Easing.out(Easing.cubic) }),    // launch: tall & thin
      withTiming(0.1, { duration: rise - 150, easing: Easing.inOut(Easing.quad) }), // round out at the top
      withTiming(-0.35, { duration: fall, easing: Easing.in(Easing.quad) }),    // stretch as it falls
      withTiming(0, { duration: 40 }),
      withDelay(430, withSequence(                                              // pull back up: jelly wobble
        withTiming(-0.65, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        withTiming(-0.15, { duration: 130, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.05, { duration: 120, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) }),
      )),
    );
    jumpY.value = withSequence(
      withDelay(crouch, withTiming(-size * 0.46, { duration: rise, easing: Easing.out(Easing.cubic) })), // hang at the top
      withTiming(0, { duration: fall, easing: Easing.in(Easing.quad) }),
    );
    splat.value = withSequence(
      withDelay(land, withTiming(0.6, { duration: 50, easing: Easing.out(Easing.quad) })), // impact
      withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) }),                   // spreads out like water
      withTiming(0.82, { duration: 110, easing: Easing.inOut(Easing.quad) }),               // the puddle ripples
      withTiming(0.95, { duration: 100, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }),                   // gathers back up
    );
    // gleeful ^^ face from the splat until it's back together
    setTimeout(() => happy(800), land);
    // droplets: fly out and land (480 ms), then get pulled back in as Glim re-forms
    const out = 480, back = 360;
    splashT.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(land, withTiming(1, { duration: out, easing: Easing.linear })),
      withDelay(back, withTiming(0, { duration: 0 })),
    );
    gather.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(land + out, withTiming(1, { duration: back, easing: Easing.in(Easing.quad) })),
      withDelay(40, withTiming(0, { duration: 0 })),
    );
    // secondary motion: the tip lags on launch, overshoots at the top, flops on
    // the splat and whips back as Glim pulls together
    flick.value = withSequence(
      withTiming(0, { duration: crouch }),
      withTiming(-0.6, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(0.45, { duration: rise - 150, easing: Easing.inOut(Easing.quad) }),
      withTiming(-0.3, { duration: fall, easing: Easing.in(Easing.quad) }),
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0.8, { duration: 280 }),
      withTiming(-0.55, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(0.25, { duration: 150, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) }),
    );
    // bubbles slosh inside the glass from the impact
    slosh.value = withSequence(
      withDelay(land, withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })),
      withTiming(-0.7, { duration: 190, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.4, { duration: 170, easing: Easing.inOut(Easing.quad) }),
      withTiming(-0.15, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }),
    );
    setTimeout(() => playReaction('boing'), crouch);
    setTimeout(() => {
      playReaction('splat');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, land);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), land + 330);
    // the droplets merge back in: a little glow pulse + bloop
    setTimeout(() => {
      flash.value = withSequence(withTiming(0.55, { duration: 90 }), withTiming(0, { duration: 450 }));
      playReaction('bloop');
      Haptics.selectionAsync().catch(() => {});
    }, land + out + back);
  };
  // Absorb: a big gulp (stretch → bulge → wobble), a bright flash and a ripple of light.
  const absorb = () => {
    squash.value = withSequence(
      withTiming(-0.5, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1.25, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(-0.35, { duration: 150, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.15, { duration: 130, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
    );
    flash.value = withSequence(withTiming(1.3, { duration: 130 }), withTiming(0, { duration: 1200 }));
    ring.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(120, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) })),
      withTiming(0, { duration: 0 }),
    );
    // the gulp sloshes the bubbles too
    slosh.value = withSequence(
      withDelay(240, withTiming(-0.6, { duration: 150 })),
      withTiming(0.4, { duration: 170, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
    );
    happy(900);
    playReaction('gulp');
    setTimeout(() => playReaction('sparkle', 0.5), 140);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };
  const lookAt = (x: number, y: number) => {
    lookX.value = withSpring(clamp(x, -1, 1), { damping: 14 });
    lookY.value = withSpring(clamp(y, -1, 1), { damping: 14 });
  };

  useImperativeHandle(ref, () => ({ poke, happy, nod, no, jump, absorb, lookAt }));

  // ── Touch (coordinates are relative to the W×H layout box) ──
  const lookFromTouch = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    lookX.value = withSpring(clamp((locationX - W / 2) / (W * 0.4), -1, 1), { damping: 16 });
    lookY.value = withSpring(clamp((locationY - H * 0.6) / (H * 0.4), -1, 1), { damping: 16 });
  };
  const responder = interactive
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          touching.current = true;
          touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, moved: false };
          lookFromTouch(e);
        },
        onResponderMove: (e: GestureResponderEvent) => {
          const dx = e.nativeEvent.pageX - touchStart.current.x;
          const dy = e.nativeEvent.pageY - touchStart.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 8) touchStart.current.moved = true;
          dragX.value = dx * 0.22; // rubber-band: follows the finger but resists
          dragY.value = dy * 0.18;
          lookFromTouch(e);
        },
        onResponderRelease: () => {
          touching.current = false;
          if (touchStart.current.moved) {
            dragX.value = withSpring(0, { damping: 4, stiffness: 180 });
            dragY.value = withSpring(0, { damping: 4, stiffness: 180 });
            Haptics.selectionAsync().catch(() => {});
          } else {
            poke();
            happy(700);
          }
          lookX.value = withDelay(500, withSpring(0));
          lookY.value = withDelay(500, withSpring(0));
        },
        onResponderTerminate: () => {
          touching.current = false;
          dragX.value = withSpring(0, { damping: 5 });
          dragY.value = withSpring(0, { damping: 5 });
        },
      }
    : {};

  // ── Geometry (UI thread) ──
  const R = useDerivedValue(() => maxR * growth.value);
  const breath = useDerivedValue(() => Math.sin((clock.value / 1000) * (TAU / 3.2)));
  const rx = useDerivedValue(() => {
    const stretch = Math.abs(dragX.value) / (size * 0.4);
    // splat: spreads wide into a puddle on landing
    return R.value * (1 + squash.value * 0.13 - breath.value * 0.012 + droopV.value * 0.1 + stretch * 0.08 + splat.value * 0.55);
  });
  const ry = useDerivedValue(() => {
    const stretch = Math.abs(dragY.value) / (size * 0.4);
    return R.value * (1 - squash.value * 0.15 + breath.value * 0.022 - droopV.value * 0.13 + stretch * 0.08 - splat.value * 0.45);
  });
  const cx = useDerivedValue(() => baseCx + shakeX.value + dragX.value);
  const cy = useDerivedValue(() => groundY - ry.value + jumpY.value + dragY.value * 0.6);
  const tipH = useDerivedValue(
    // the tip collapses into the puddle on a splat
    () => R.value * 1.5 * Math.max(0.12, 1 - squash.value * 0.22 + breath.value * 0.03 - droopV.value * 0.22 - splat.value * 0.85),
  );
  // tip lags behind movement like jelly, sways gently, and wilts with brain rot
  const lean = useDerivedValue(() => {
    // the tip sways side to side like a little flame: a slow swing plus a
    // smaller, faster wobble so it never looks mechanical
    const t = clock.value;
    const sway = Math.sin(t / 1150) * 0.2 + Math.sin(t / 470 + 1.3) * 0.04;
    return R.value * (0.12 + sway * (1 - droopV.value) - droopV.value * 0.38 + flick.value * 0.7)
      - shakeX.value * 0.9 - dragX.value * 0.35;
  });

  const fizzVis = useDerivedValue(() => fizz.value * (1 - droopV.value));
  const sparkVis = useDerivedValue(() => sparkle.value * (1 - droopV.value * 0.8));

  // Paths: one SkPath per shape, rebuilt in place on the UI thread, then
  // notifyChange tells Skia to redraw (same pattern as Skia's usePathValue).
  const pathInit = useMemo(() => [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()], []);
  const body = useSharedValue(pathInit[0]);
  const streak = useSharedValue(pathInit[1]);
  const happyEyes = useSharedValue(pathInit[2]);
  useDerivedValue(() => {
    dropPath(body.value, cx.value, cy.value, rx.value, ry.value, tipH.value, lean.value);
    notifyChange(body);
  });

  const top = useDerivedValue(() => pt(cx.value, cy.value - tipH.value));
  const bottom = useDerivedValue(() => pt(cx.value, cy.value + ry.value));
  const bulbC = useDerivedValue(() => pt(cx.value, cy.value - ry.value * 0.15));
  const edgeR = useDerivedValue(() => R.value * 1.35);
  const sweepXf = useDerivedValue(() => [{ rotate: clock.value / 5000 }]);
  const colorOp = useDerivedValue(() => vibrance.value * (1 - droopV.value * 0.8));
  const greyOp = useDerivedValue(() => 1 - colorOp.value);
  const irisOp = useDerivedValue(() => (iris.value + flash.value * 0.3) * (1 - droopV.value));

  // Aura + floor light
  const auraC = useDerivedValue(() => pt(cx.value, cy.value - R.value * 0.3));
  const auraR = useDerivedValue(() => R.value * (1.35 + flash.value * 0.4));
  const auraOp = useDerivedValue(
    () => (glow.value * (0.75 + 0.25 * Math.sin(clock.value / 900)) + flash.value * 0.6) * (1 - droopV.value * 0.85),
  );
  const ringR = useDerivedValue(() => R.value * (1.05 + ring.value * 1.35));
  const ringOp = useDerivedValue(() => (ring.value > 0.001 && ring.value < 0.999 ? (1 - ring.value) * 0.85 : 0));
  const ringW = useDerivedValue(() => R.value * 0.1 * (1 - ring.value * 0.7));
  const splashY = useDerivedValue(() => groundY);
  const rippleRect = useDerivedValue(() => {
    const w = R.value * (1.6 + splashT.value * 2.8);
    const h = w * 0.22;
    return rc(baseCx - w / 2, groundY - h / 2, w, h);
  });
  const rippleOp = useDerivedValue(() => (splashT.value > 0.001 && splashT.value < 0.999 ? (1 - splashT.value) * 0.7 : 0));
  const rippleW = useDerivedValue(() => R.value * 0.06 * (1 - splashT.value * 0.6));
  const lift = useDerivedValue(() => clamp(-jumpY.value / (size * 0.2), 0, 1));
  const floorRect = useDerivedValue(() => {
    const w = rx.value * 1.9 * (1 - lift.value * 0.35);
    const h = R.value * 0.22 * (1 - lift.value * 0.3);
    return rc(baseCx + dragX.value * 0.5 - w / 2, groundY - h / 2, w, h);
  });
  const floorOp = useDerivedValue(() => (0.15 + colorOp.value * 0.35) * (1 - lift.value * 0.5));

  // Glass details
  const rimW = useDerivedValue(() => R.value * 0.14);
  const innerGlow = useDerivedValue(() =>
    rc(cx.value - rx.value * 0.7, cy.value + ry.value * 0.15, rx.value * 1.4, ry.value * 0.75),
  );
  useDerivedValue(() => {
    const p = streak.value;
    p.reset();
    const tx = cx.value + lean.value;
    const ty = cy.value - tipH.value;
    p.moveTo(tx - rx.value * 0.12, ty + tipH.value * 0.22);
    p.quadTo(cx.value - rx.value * 0.78, cy.value - ry.value * 0.55, cx.value - rx.value * 0.72, cy.value + ry.value * 0.1);
    notifyChange(streak);
  });
  const streakW = useDerivedValue(() => R.value * 0.08);
  const dotC = useDerivedValue(() => pt(cx.value + rx.value * 0.55, cy.value + ry.value * 0.45));
  const dotR = useDerivedValue(() => R.value * 0.045);

  // Eyes — big, white, glowing
  const eyeOpen = useDerivedValue(() => blink.value * lid.value * (1 - droopV.value * 0.5));
  const eyeOp = useDerivedValue(() => (1 - happyV.value) * (1 - droopV.value * 0.35));
  // NB: computed inline (not via a helper worklet) so Reanimated sees every
  // shared value it reads and re-runs this whenever any of them change.
  // eyes squash and stretch with the body
  const eyeW = useDerivedValue(() => R.value * 0.3 * (1 + splat.value * 0.35 + Math.max(0, squash.value) * 0.12));
  const eyeFullH = useDerivedValue(() => R.value * 0.46 * (1 - splat.value * 0.5 - squash.value * 0.18));
  const eyeH = useDerivedValue(() => Math.max(eyeFullH.value * eyeOpen.value, R.value * 0.03));
  const eyeDX = useDerivedValue(() => lookX.value * rx.value * 0.14);
  // top edge: lids close from the top, so the bottom edge stays anchored
  const eyeTop = useDerivedValue(
    () => cy.value - ry.value * 0.1 + lookY.value * ry.value * 0.12 + droopV.value * ry.value * 0.1
      + eyeFullH.value / 2 - eyeH.value,
  );
  const eyeL = useDerivedValue(() =>
    rc(cx.value - rx.value * 0.36 + eyeDX.value - eyeW.value / 2, eyeTop.value, eyeW.value, eyeH.value),
  );
  const eyeR = useDerivedValue(() =>
    rc(cx.value + rx.value * 0.36 + eyeDX.value - eyeW.value / 2, eyeTop.value, eyeW.value, eyeH.value),
  );
  const eyeGlow = useDerivedValue(() => R.value * 0.06);

  useDerivedValue(() => {
    const p = happyEyes.value;
    p.reset();
    const w = R.value * 0.15;
    const lift_ = R.value * 0.09;
    for (const side of [-1, 1]) {
      const ex = cx.value + side * rx.value * 0.36 + lookX.value * rx.value * 0.08;
      const ey = cy.value - ry.value * 0.02;
      p.moveTo(ex - w, ey + lift_ * 0.4);
      p.quadTo(ex, ey - lift_ * 1.6, ex + w, ey + lift_ * 0.4);
    }
    notifyChange(happyEyes);
  });
  const happyStroke = useDerivedValue(() => R.value * 0.09);
  const blushOp = useDerivedValue(() => happyV.value * 0.5 * vibrance.value);
  const blushL = useDerivedValue(() => pt(cx.value - rx.value * 0.6, cy.value + ry.value * 0.3));
  const blushR = useDerivedValue(() => pt(cx.value + rx.value * 0.6, cy.value + ry.value * 0.3));
  const blushSize = useDerivedValue(() => R.value * 0.12);

  const [cLight, cMid] = palette;

  return (
    <View style={{ width: W, height: H }} {...responder}>
      <Canvas pointerEvents="none" style={{ position: 'absolute', left: -pad, top: -pad, width: CW, height: CH }}>
        {/* Aura */}
        <Circle c={auraC} r={auraR} color={cMid} opacity={auraOp}>
          <BlurMask blur={size * 0.12} style="normal" />
        </Circle>

        {/* Ripple of light when absorbing */}
        <Circle c={auraC} r={ringR} color={cLight} opacity={ringOp} style="stroke" strokeWidth={ringW}>
          <BlurMask blur={size * 0.01} style="solid" />
        </Circle>

        {/* Light pooling on the floor */}
        <Oval rect={floorRect} color={cMid} opacity={floorOp}>
          <BlurMask blur={size * 0.04} style="normal" />
        </Oval>

        {/* Radiant sparks */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Spark key={i} i={i} clock={clock} cx={cx} cy={cy} R={R} visible={sparkVis} color={i % 2 ? cLight : cMid} />
        ))}

        {/* Glass body: grey ↔ colour */}
        <BodyFill palette={GREY_PALETTE} body={body} top={top} bottom={bottom} center={bulbC} edgeR={edgeR} opacity={greyOp} />
        <BodyFill palette={palette} body={body} top={top} bottom={bottom} center={bulbC} edgeR={edgeR} opacity={colorOp} />

        {/* Everything below is clipped to the droplet */}
        <Group clip={body}>
          {/* iridescent sheen */}
          <Path path={body} opacity={irisOp} blendMode="overlay">
            <SweepGradient
              c={bulbC}
              origin={bulbC}
              transform={sweepXf}
              colors={['#FF7AD9', '#7AE7FF', '#B6FF7A', '#FFE27A', '#FF7AD9']}
            />
          </Path>
          {/* frosty inner glow at the bottom */}
          <Oval rect={innerGlow} color="white" opacity={0.5}>
            <BlurMask blur={size * 0.06} style="normal" />
          </Oval>
          {/* bubbles */}
          {[0, 1, 2].map((i) => (
            <Bubble key={i} i={i} clock={clock} cx={cx} cy={cy} R={R} visible={fizzVis} slosh={slosh} />
          ))}
          {/* inner rim light (stroke centred on the edge; outer half is clipped) */}
          <Path path={body} style="stroke" strokeWidth={rimW} color="white" opacity={0.45}>
            <BlurMask blur={size * 0.015} style="normal" />
          </Path>
          {/* specular streak down the left side */}
          <Path path={streak} style="stroke" strokeWidth={streakW} strokeCap="round" color="white" opacity={0.6}>
            <BlurMask blur={size * 0.012} style="normal" />
          </Path>
          <Circle c={dotC} r={dotR} color="white" opacity={0.55}>
            <BlurMask blur={2} style="normal" />
          </Circle>
        </Group>

        {/* Landing: a ripple spreading across the floor, then the droplets */}
        <Oval rect={rippleRect} color={cLight} opacity={rippleOp} style="stroke" strokeWidth={rippleW}>
          <BlurMask blur={size * 0.008} style="solid" />
        </Oval>
        {/* Landing splash */}
        {Array.from({ length: SPLASH_N }, (_, i) => (
          <SplashDrop key={i} i={i} t={splashT} g={gather} x0={baseCx} y0={splashY} cx={cx} cy={cy} R={R} color={i % 2 ? cLight : cMid} />
        ))}

        {/* Blush */}
        <Circle c={blushL} r={blushSize} color="#FF8FBF" opacity={blushOp}>
          <BlurMask blur={size * 0.025} style="normal" />
        </Circle>
        <Circle c={blushR} r={blushSize} color="#FF8FBF" opacity={blushOp}>
          <BlurMask blur={size * 0.025} style="normal" />
        </Circle>

        {/* Eyes */}
        <Group opacity={eyeOp}>
          <Oval rect={eyeL} color="white">
            <BlurMask blur={eyeGlow} style="solid" />
          </Oval>
          <Oval rect={eyeR} color="white">
            <BlurMask blur={eyeGlow} style="solid" />
          </Oval>
        </Group>
        <Path
          path={happyEyes}
          style="stroke"
          strokeWidth={happyStroke}
          strokeCap="round"
          color="white"
          opacity={happyV}
        >
          <BlurMask blur={eyeGlow} style="solid" />
        </Path>
      </Canvas>
    </View>
  );
});

export default Glim;

