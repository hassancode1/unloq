import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW } = Dimensions.get("window");

// ── Indigo palette (matches goal-setup / app theme) ────────────────────────────
const C = {
  bg: "#FFFFFF",
  cta: "#6366F1",
  ctaShadow: "#4338CA",
  title: "#1A1A2E",
  sub: "#6B7280",
  card: "#FFFFFF",
  cardBorder: "#E0E7FF",
  red: "#EF4444",
  redLight: "#FECACA",
  green: "#10B981",
  greenLight: "#D1FAE5",
  progress: "#6366F1",
  progressBg: "#E0E7FF",
  white: "#FFFFFF",
  selected: "#EEF2FF",
  selectedBorder: "#6366F1",
};

const F = {
  bold:      'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
  semi:      'Inter-SemiBold',
  regular:   'Inter-Regular',
};

// ── Screen IDs ─────────────────────────────────────────────────────────────────
type ScreenId =
  | "splash"
  | "q_role"
  | "q_distraction"
  | "q_hours"
  | "loading"
  | "result"
  | "bad_news"
  | "stat"
  | "life_grid"
  | "good_news"
  | "why_unloq"
  | "commitment";

const FLOW: ScreenId[] = [
  "splash",
  "q_role",
  "q_distraction",
  "q_hours",
  "loading",
  "result",
  "bad_news",
  "stat",
  "life_grid",
  "good_news",
  "why_unloq",
  "commitment",
];

// Quiz screens that show progress bar (indices 1–3 and 10–11)
const PROGRESS_SCREENS = new Set<ScreenId>([
  "q_role",
  "q_distraction",
  "q_hours",
  "why_unloq",
  "commitment",
]);
const QUIZ_TOTAL = 3;

// ── CTAButton ──────────────────────────────────────────────────────────────────
function CTAButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const ty = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <View style={ctaStyles.wrap}>
      <View style={[ctaStyles.shadow, disabled && { opacity: 0.4 }]} />
      <Animated.View style={style}>
        <TouchableOpacity
          activeOpacity={1}
          disabled={disabled}
          onPressIn={() => {
            ty.value = withSpring(4, { damping: 12 });
          }}
          onPressOut={() => {
            ty.value = withSpring(0, { damping: 12 });
          }}
          onPress={onPress}
          style={[ctaStyles.btn, disabled && { opacity: 0.5 }]}
        >
          <Text style={ctaStyles.label}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const ctaStyles = StyleSheet.create({
  wrap: { marginHorizontal: 24, marginBottom: 8 },
  shadow: {
    position: "absolute",
    bottom: -4,
    left: 0,
    right: 0,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.ctaShadow,
  },
  btn: {
    backgroundColor: C.cta,
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { color: C.white, fontSize: 17, fontFamily: F.bold },
});

// ── OptionCard ─────────────────────────────────────────────────────────────────
function OptionCard({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[optStyles.card, selected && optStyles.selected]}
    >
      <Text style={optStyles.emoji}>{emoji}</Text>
      <Text style={[optStyles.label, selected && optStyles.labelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const optStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  selected: { backgroundColor: C.selected, borderColor: C.selectedBorder },
  emoji: { fontSize: 20 },
  label: { fontSize: 15, fontFamily: F.semi, color: C.title, flex: 1 },
  labelSelected: { color: C.cta },
});

// ── ProgressBar ────────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = step / total;
  return (
    <View style={pbStyles.track}>
      <Animated.View style={[pbStyles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: { height: 6, backgroundColor: C.progressBg, borderRadius: 3, flex: 1 },
  fill: { height: 6, backgroundColor: C.progress, borderRadius: 3 },
});

// ── Individual Screens ─────────────────────────────────────────────────────────

function SplashScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={ss.root}>
      {/* Phone mockup */}
      <View style={ss.phoneWrap}>
        <View style={ss.phone}>
          <View style={ss.phoneLockBar} />
          <View style={ss.phoneContent}>
            <Text style={ss.lockIcon}>🔒</Text>
            <Text style={ss.phoneQ}>What is the Feynman{"\n"}Technique?</Text>
            <View style={ss.phoneOpt}>
              <Text style={ss.phoneOptTxt}>Memorisation</Text>
            </View>
            <View style={ss.phoneOpt}>
              <Text style={ss.phoneOptTxt}>Teaching to learn</Text>
            </View>
            <View style={ss.phoneOpt}>
              <Text style={ss.phoneOptTxt}>Speed reading</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={ss.title}>Turn screen time{"\n"}into learn time.</Text>
      <Text style={ss.sub}>
        Upload your docs. Unloq generates daily lessons.{"\n"}Apps stay locked
        until you answer.
      </Text>

      <View style={{ width: "100%", marginTop: 8 }}>
        <CTAButton label="Get started" onPress={onNext} />
      </View>
      <Text style={ss.legal}>
        By continuing you agree to our Terms & Privacy Policy
      </Text>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  phoneWrap: { marginBottom: 28, marginTop: 8 },
  phone: {
    width: 200,
    borderRadius: 28,
    backgroundColor: "#F0EDE8",
    borderWidth: 8,
    borderColor: "#2D2D2D",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  phoneLockBar: {
    height: 6,
    backgroundColor: "#2D2D2D",
    marginHorizontal: 60,
    borderRadius: 3,
    marginVertical: 8,
  },
  phoneContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  lockIcon: { fontSize: 28 },
  phoneQ: {
    fontSize: 12,
    fontFamily: F.bold,
    color: C.title,
    textAlign: "center",
    lineHeight: 17,
  },
  phoneOpt: {
    width: "100%",
    backgroundColor: C.white,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  phoneOptTxt: {
    fontSize: 10,
    fontFamily: F.semi,
    color: C.title,
    textAlign: "center",
  },
  title: {
    fontSize: 34,
    fontFamily: F.extraBold,
    color: C.title,
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    fontFamily: F.semi,
    color: C.sub,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  legal: {
    fontSize: 11,
    fontFamily: F.regular,
    color: C.sub,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 24,
  },
});

// ── Q: Role ────────────────────────────────────────────────────────────────────
const ROLES = [
  { emoji: "🎓", label: "Student" },
  { emoji: "💼", label: "Professional" },
  { emoji: "🚀", label: "Founder / Entrepreneur" },
  { emoji: "🔬", label: "Researcher" },
  { emoji: "📚", label: "Self-learner" },
  { emoji: "👥", label: "Just trying to grow" },
];

function QRoleScreen({ onNext }: { onNext: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>Which best{"\n"}describes you?</Text>
      {ROLES.map((r) => (
        <OptionCard
          key={r.label}
          emoji={r.emoji}
          label={r.label}
          selected={sel === r.label}
          onPress={() => {
            Haptics.selectionAsync();
            setSel(r.label);
          }}
        />
      ))}
      <View style={{ marginTop: 4 }}>
        <CTAButton label="Continue" onPress={onNext} disabled={!sel} />
      </View>
    </Animated.View>
  );
}

// ── Q: Distraction ─────────────────────────────────────────────────────────────
const DISTRACTIONS = [
  { emoji: "📱", label: "Social media / Reels" },
  { emoji: "🎮", label: "Games" },
  { emoji: "📰", label: "News / Reddit" },
  { emoji: "▶️", label: "YouTube" },
  { emoji: "💬", label: "Messaging apps" },
  { emoji: "🤷", label: "Everything honestly" },
];

function QDistractionScreen({ onNext }: { onNext: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>What pulls you{"\n"}away from learning?</Text>
      {DISTRACTIONS.map((d) => (
        <OptionCard
          key={d.label}
          emoji={d.emoji}
          label={d.label}
          selected={sel === d.label}
          onPress={() => {
            Haptics.selectionAsync();
            setSel(d.label);
          }}
        />
      ))}
      <View style={{ marginTop: 4 }}>
        <CTAButton label="Continue" onPress={onNext} disabled={!sel} />
      </View>
    </Animated.View>
  );
}

const qs = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 36,
    marginBottom: 20,
  },
});

// ── Q: Hours (custom slider) ───────────────────────────────────────────────────
function QHoursScreen({
  onNext,
  onHoursChange,
}: {
  onNext: () => void;
  onHoursChange: (h: number) => void;
}) {
  const [hours, setHours] = useState(4);
  const sliderWidth = SW - 48;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const clamped = Math.max(0, Math.min(x, sliderWidth));
        const h = Math.round((clamped / sliderWidth) * 12);
        setHours(h);
        onHoursChange(h);
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const clamped = Math.max(0, Math.min(x, sliderWidth));
        const h = Math.round((clamped / sliderWidth) * 12);
        setHours(h);
        onHoursChange(h);
      },
    }),
  ).current;

  const pct = hours / 12;
  const comment =
    hours <= 2
      ? "That's pretty disciplined!"
      : hours <= 4
        ? "This is a significant chunk of your day"
        : hours <= 7
          ? "This is a significant percentage of your life"
          : "That's almost half your waking hours";

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>
        How much time do you{"\n"}lose to apps daily?
      </Text>
      <Text style={hrs.sub}>You can tell the truth</Text>

      <Text style={hrs.big}>
        {hours === 12 ? "12+ hours" : `${hours} hour${hours !== 1 ? "s" : ""}`}
      </Text>

      {/* Slider track */}
      <View style={hrs.trackWrap} {...panResponder.panHandlers}>
        <View style={hrs.track}>
          <View style={[hrs.fill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={[hrs.thumb, { left: pct * (sliderWidth - 24) }]} />
        <View style={hrs.labels}>
          <Text style={hrs.lbl}>0h</Text>
          <Text style={hrs.lbl}>12h+</Text>
        </View>
      </View>

      <Text style={hrs.comment}>{comment}</Text>

      <View style={{ marginTop: "auto", paddingBottom: 8 }}>
        <CTAButton label="Continue" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

const hrs = StyleSheet.create({
  sub: { fontSize: 14, fontFamily: F.semi, color: C.sub, marginBottom: 8 },
  big: {
    fontSize: 44,
    fontFamily: F.extraBold,
    color: C.title,
    textAlign: "center",
    marginVertical: 12,
  },
  trackWrap: { marginBottom: 12, position: "relative", paddingBottom: 24 },
  track: {
    height: 8,
    backgroundColor: C.progressBg,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: C.cta, borderRadius: 4 },
  thumb: {
    position: "absolute",
    top: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 3,
    borderColor: C.cta,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  lbl: { fontSize: 12, fontFamily: F.semi, color: C.sub },
  comment: {
    fontSize: 14,
    fontFamily: F.bold,
    color: C.cta,
    textAlign: "center",
    marginTop: 4,
  },
});

// ── Loading ────────────────────────────────────────────────────────────────────
function LoadingScreen({ onNext }: { onNext: () => void }) {
  const progress = useSharedValue(0);
  const [msg, setMsg] = useState("Analyzing your habits…");

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2400 });
    const t1 = setTimeout(() => setMsg("Building your profile…"), 800);
    const t2 = setTimeout(() => setMsg("Almost there…"), 1700);
    const t3 = setTimeout(() => onNext(), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={lds.root}>
      <Text style={lds.msg}>{msg}</Text>
      <View style={lds.track}>
        <Animated.View style={[lds.fill, barStyle]} />
      </View>
    </Animated.View>
  );
}

const lds = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  msg: { fontSize: 18, fontFamily: F.bold, color: C.title },
  track: {
    height: 8,
    backgroundColor: C.progressBg,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: C.cta, borderRadius: 4 },
});

// ── Result ─────────────────────────────────────────────────────────────────────
function ResultScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={rs.root}>
      <Text style={rs.eyebrow}>Your learning profile is</Text>
      <Text style={rs.profile}>The Distracted{"\n"}Scholar</Text>

      <View style={rs.iconWrap}>
        <Text style={rs.icon}>🧠</Text>
      </View>

      <Text style={rs.desc}>
        You have the drive to learn, but constant distractions keep pulling you
        off course.
      </Text>

      <View style={rs.bars}>
        <View style={rs.barRow}>
          <Text style={rs.barLabel}>Knowledge potential</Text>
          <View style={rs.barTrack}>
            <View
              style={[rs.barFill, { width: "82%", backgroundColor: C.green }]}
            />
          </View>
        </View>
        <View style={rs.barRow}>
          <Text style={rs.barLabel}>Focus interruptions</Text>
          <View style={rs.barTrack}>
            <View
              style={[rs.barFill, { width: "75%", backgroundColor: C.cta }]}
            />
          </View>
        </View>
      </View>

      <CTAButton label="Makes sense" onPress={onNext} />
    </Animated.View>
  );
}

const rs = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  eyebrow: { fontSize: 14, fontFamily: F.semi, color: C.sub, marginBottom: 4 },
  profile: {
    fontSize: 32,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 40,
    marginBottom: 20,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: C.selected,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 40 },
  desc: {
    fontSize: 15,
    fontFamily: F.semi,
    color: C.sub,
    lineHeight: 22,
    marginBottom: 24,
  },
  bars: { gap: 16, marginBottom: 32 },
  barRow: { gap: 6 },
  barLabel: { fontSize: 14, fontFamily: F.bold, color: C.title },
  barTrack: {
    height: 10,
    backgroundColor: C.progressBg,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: { height: 10, borderRadius: 5 },
});

// ── Bad news ───────────────────────────────────────────────────────────────────
function BadNewsScreen({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={bns.root}>
      <Text style={bns.oof}>OOF</Text>
      <Text style={bns.msg}>I have some bad{"\n"}news for you…</Text>
      <TouchableOpacity onPress={onNext} style={bns.skipBtn}>
        <Text style={bns.skip}>Skip</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const bns = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  oof: {
    fontSize: 96,
    fontFamily: F.extraBold,
    color: C.cta,
    letterSpacing: -2,
    marginBottom: 16,
  },
  msg: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    textAlign: "center",
    lineHeight: 36,
  },
  skipBtn: { position: "absolute", bottom: 24 },
  skip: { fontSize: 15, fontFamily: F.semi, color: C.sub },
});

// ── Stat ───────────────────────────────────────────────────────────────────────
function StatScreen({ onNext, hours }: { onNext: () => void; hours: number }) {
  const years = Math.max(1, Math.round((hours * 70) / 24));
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={sts.root}>
      <Text style={sts.pre}>You're on track to spend</Text>
      <Text style={sts.years}>{years} years</Text>
      <Text style={sts.post}>
        of your life on apps{"\n"}instead of learning
      </Text>

      <Text style={sts.mascot}>🤢</Text>

      <Text style={sts.note}>
        Projection based on {hours}h/day over 70 years
      </Text>

      <View style={{ alignSelf: "stretch" }}>
        <CTAButton label="Next" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

const sts = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  pre: {
    fontSize: 20,
    fontFamily: F.bold,
    color: C.title,
    textAlign: "center",
  },
  years: {
    fontSize: 72,
    fontFamily: F.extraBold,
    color: C.red,
    lineHeight: 80,
  },
  post: {
    fontSize: 22,
    fontFamily: F.bold,
    color: C.title,
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 24,
  },
  mascot: { fontSize: 80, marginBottom: 16 },
  note: { fontSize: 12, fontFamily: F.regular, color: C.sub, marginBottom: 32 },
});

// ── Life grid ──────────────────────────────────────────────────────────────────
function LifeGridScreen({
  onNext,
  hours,
}: {
  onNext: () => void;
  hours: number;
}) {
  const COLS = 8;
  const ROWS = 9;
  const TOTAL = COLS * ROWS; // 72 dots ≈ 72 years
  const LIVED = 25; // assume age 25
  const wastedYears = Math.max(1, Math.round((hours * 70) / 24));
  const wastedDots = Math.min(wastedYears, TOTAL - LIVED);

  const dots = Array.from({ length: TOTAL }, (_, i) => {
    if (i < LIVED) return "green";
    if (i < LIVED + wastedDots) return "red";
    return "gray";
  });

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={lgs.root}>
      <Text style={lgs.title}>This is your life</Text>

      <View style={lgs.grid}>
        {Array.from({ length: ROWS }, (_, row) => (
          <View key={row} style={lgs.row}>
            {Array.from({ length: COLS }, (_, col) => {
              const idx = row * COLS + col;
              const color =
                dots[idx] === "green"
                  ? C.green
                  : dots[idx] === "red"
                    ? C.red
                    : C.progressBg;
              return (
                <View key={col} style={[lgs.dot, { backgroundColor: color }]} />
              );
            })}
          </View>
        ))}
      </View>

      <View style={lgs.legend}>
        <View style={lgs.legendRow}>
          <View style={[lgs.legendDot, { backgroundColor: C.green }]} />
          <Text style={lgs.legendTxt}>You are here (age ~25)</Text>
        </View>
        <View style={lgs.legendRow}>
          <View style={[lgs.legendDot, { backgroundColor: C.red }]} />
          <Text style={lgs.legendTxt}>{wastedYears} years spent on apps</Text>
        </View>
        <View style={lgs.legendRow}>
          <View style={[lgs.legendDot, { backgroundColor: C.progressBg }]} />
          <Text style={lgs.legendTxt}>Life remaining</Text>
        </View>
      </View>

      <CTAButton label="Next" onPress={onNext} />
    </Animated.View>
  );
}

const lgs = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    marginBottom: 20,
  },
  grid: { gap: 6, marginBottom: 24 },
  row: { flexDirection: "row", gap: 6 },
  dot: { width: (SW - 48 - 6 * 7) / 8, aspectRatio: 1, borderRadius: 100 },
  legend: { gap: 8, marginBottom: 32 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendTxt: { fontSize: 14, fontFamily: F.semi, color: C.title },
});

// ── Good news ──────────────────────────────────────────────────────────────────
function GoodNewsScreen({
  onNext,
  hours,
}: {
  onNext: () => void;
  hours: number;
}) {
  const years = Math.max(1, Math.round((hours * 70) / 24));
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={gns.root}>
      <Text style={gns.pre}>The good news is…</Text>
      <Text style={gns.bold}>Unloq can give you</Text>
      <Text style={gns.years}>
        {years} years{"\n"}of knowledge back
      </Text>
      <Text style={gns.mascot}>🧠</Text>
      <View style={{ alignSelf: "stretch" }}>
        <CTAButton label="Let's do this!" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

const gns = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pre: { fontSize: 18, fontFamily: F.bold, color: C.title, marginBottom: 4 },
  bold: { fontSize: 22, fontFamily: F.bold, color: C.title, marginBottom: 4 },
  years: {
    fontSize: 48,
    fontFamily: F.extraBold,
    color: C.green,
    textAlign: "center",
    lineHeight: 56,
    marginBottom: 24,
  },
  mascot: { fontSize: 80, marginBottom: 40 },
});

// ── Why Unloq ──────────────────────────────────────────────────────────────────
function WhyUnloqScreen({ onNext }: { onNext: () => void }) {
  const rows = [
    { icon: "❌", text: "App blockers", sub: "→ You bypass them", bad: true },
    {
      icon: "❌",
      text: "Willpower alone",
      sub: "→ Exhausting & fails",
      bad: true,
    },
    { icon: "✅", text: "Unloq", sub: "→ Learn to unlock", bad: false },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={wus.root}>
      <Text style={wus.title}>Why other{"\n"}methods fail</Text>
      {rows.map((r) => (
        <View key={r.text} style={[wus.row, !r.bad && wus.rowGood]}>
          <Text style={wus.rowIcon}>{r.icon}</Text>
          <Text style={[wus.rowTxt, !r.bad && wus.rowTxtGood]}>
            <Text style={wus.rowBold}>{r.text}</Text>
            {"  "}
            {r.sub}
          </Text>
        </View>
      ))}

      <View style={wus.feynman}>
        <Text style={wus.feynmanTitle}>The Feynman Method</Text>
        <Text style={wus.feynmanSub}>
          Teaching a concept back in your own words is the single most effective
          way to truly learn it. Unloq generates lessons from YOUR documents —
          you prove you understand before your apps unlock.
        </Text>
      </View>

      <CTAButton label="Continue" onPress={onNext} />
    </Animated.View>
  );
}

const wus = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  title: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 36,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowGood: { backgroundColor: C.greenLight },
  rowIcon: { fontSize: 20 },
  rowTxt: { fontSize: 14, fontFamily: F.semi, color: "#991B1B", flex: 1 },
  rowTxtGood: { color: "#15803D" },
  rowBold: { fontFamily: F.extraBold },
  feynman: {
    backgroundColor: C.selected,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.selectedBorder,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  feynmanTitle: {
    fontSize: 15,
    fontFamily: F.extraBold,
    color: C.cta,
    marginBottom: 4,
  },
  feynmanSub: {
    fontSize: 13,
    fontFamily: F.semi,
    color: C.sub,
    lineHeight: 19,
  },
});

// ── Commitment (chain tap) ─────────────────────────────────────────────────────
function CommitmentScreen({ onNext }: { onNext: () => void }) {
  const [taps, setTaps] = useState(0);
  const [done, setDone] = useState(false);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const chainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  const handleTap = useCallback(() => {
    if (done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(1.3, { damping: 6 }, () => {
      scale.value = withSpring(1, { damping: 8 });
    });
    rotate.value = withSpring(rotate.value + 15, { damping: 6 }, () => {
      rotate.value = withSpring(0, { damping: 10 });
    });

    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(onNext, 900);
    }
  }, [taps, done]);

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={cms.root}>
      {!done ? (
        <>
          <Text style={cms.title}>Ready to make every{"\n"}unlock count?</Text>
          <Text style={cms.sub}>Make a commitment to yourself</Text>

          <TouchableOpacity
            onPress={handleTap}
            activeOpacity={0.85}
            style={cms.chainArea}
          >
            <Animated.Text style={[cms.chainEmoji, chainStyle]}>
              ⛓️
            </Animated.Text>
            <View style={cms.tapHint}>
              {Array.from({ length: 5 }, (_, i) => (
                <View key={i} style={[cms.pip, i < taps && cms.pipDone]} />
              ))}
            </View>
            <Text style={cms.tapLabel}>tap {5 - taps}x to commit</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={cms.doneWrap}>
          <Text style={cms.doneEmoji}>🎉</Text>
          <Text style={cms.doneTitle}>Let's go!</Text>
          <Text style={cms.doneSub}>
            You're committed. Time to upload your first document and start
            learning.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const cms = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: {
    fontSize: 30,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 38,
    marginBottom: 8,
  },
  sub: { fontSize: 15, fontFamily: F.semi, color: C.sub, marginBottom: 40 },
  chainArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  chainEmoji: { fontSize: 80 },
  tapHint: { flexDirection: "row", gap: 10 },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.progressBg,
  },
  pipDone: { backgroundColor: C.cta },
  tapLabel: { fontSize: 18, fontFamily: F.extraBold, color: C.title },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  doneEmoji: { fontSize: 80 },
  doneTitle: { fontSize: 40, fontFamily: F.extraBold, color: C.title },
  doneSub: {
    fontSize: 16,
    fontFamily: F.semi,
    color: C.sub,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
  },
});

// ── Main ───────────────────────────────────────────────────────────────────────
type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const [hours, setHours] = useState(4);
  const screen = FLOW[idx];

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (idx === FLOW.length - 1) {
      onComplete();
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, onComplete]);

  // Progress bar: quiz screens 1-3 count as steps 1/3, 2/3, 3/3
  const quizScreens: ScreenId[] = ["q_role", "q_distraction", "q_hours"];
  const quizStep = quizScreens.indexOf(screen) + 1;
  const showProgress = PROGRESS_SCREENS.has(screen);
  const progressStep = quizStep > 0 ? quizStep : quizScreens.length + 1;

  return (
    <View style={[root.wrap, { backgroundColor: C.bg }]}>
      {/* Status bar area */}
      <View style={{ height: insets.top }} />

      {/* Top bar */}
      {showProgress && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={root.topBar}
        >
          <ProgressBar step={progressStep} total={QUIZ_TOTAL + 2} />
          <Text style={root.mascot}>📖</Text>
        </Animated.View>
      )}

      {/* Screen content */}
      <View style={root.content} key={screen}>
        {screen === "splash" && <SplashScreen onNext={next} />}
        {screen === "q_role" && <QRoleScreen onNext={next} />}
        {screen === "q_distraction" && <QDistractionScreen onNext={next} />}
        {screen === "q_hours" && (
          <QHoursScreen onNext={next} onHoursChange={setHours} />
        )}
        {screen === "loading" && <LoadingScreen onNext={next} />}
        {screen === "result" && <ResultScreen onNext={next} />}
        {screen === "bad_news" && <BadNewsScreen onNext={next} />}
        {screen === "stat" && <StatScreen onNext={next} hours={hours} />}
        {screen === "life_grid" && (
          <LifeGridScreen onNext={next} hours={hours} />
        )}
        {screen === "good_news" && (
          <GoodNewsScreen onNext={next} hours={hours} />
        )}
        {screen === "why_unloq" && <WhyUnloqScreen onNext={next} />}
        {screen === "commitment" && <CommitmentScreen onNext={onComplete} />}
      </View>

      <View style={{ height: insets.bottom + 8 }} />
    </View>
  );
}

const root = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  mascot: { fontSize: 28 },
  content: { flex: 1 },
});
