import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useAction, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAppStore } from "../store/useAppStore";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
  bold:      'Nunito-Bold',
  extraBold: 'Nunito-ExtraBold',
  semi:      'Nunito-SemiBold',
  regular:   'Nunito-Regular',
};

// ── Screen IDs ─────────────────────────────────────────────────────────────────
type ScreenId =
  | "splash"
  | "q_role"
  | "q_distraction"
  | "q_hours"
  | "loading"
  | "result"
  | "semester_goal"
  | "bad_news"
  | "stat"
  | "life_grid"
  | "good_news"
  | "why_unloq"
  | "commitment"
  | "pricing"
  | "q_course";

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
  "pricing",
  "q_course",
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
  wrap: { marginBottom: 8 },
  shadow: {
    position: "absolute",
    bottom: -5,
    left: 0,
    right: 0,
    height: 62,
    borderRadius: 18,
    backgroundColor: C.ctaShadow,
  },
  btn: {
    backgroundColor: C.cta,
    borderRadius: 18,
    height: 62,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { color: C.white, fontSize: 18, fontFamily: F.bold },
});

// ── IconBadge ──────────────────────────────────────────────────────────────────
function IconBadge({
  name,
  size = 32,
  color = C.cta,
  bg = C.selected,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={{ width: size * 2, height: size * 2, borderRadius: size,
      backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

// ── OptionCard ─────────────────────────────────────────────────────────────────
function OptionCard({
  label,
  iconName,
  selected,
  onPress,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[optStyles.card, selected && optStyles.selected]}
    >
      <View style={[optStyles.iconBox, selected && optStyles.iconBoxSelected]}>
        <Ionicons name={iconName} size={20} color={selected ? C.cta : C.sub} />
      </View>
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
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxSelected: { backgroundColor: C.selectedBorder + "22" },
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
        <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={ss.phoneGlow}>
          <View style={ss.phone}>
            <View style={ss.phoneLockBar} />
            <View style={ss.phoneContent}>
              <View style={ss.lockIconWrap}>
                <Ionicons name="lock-closed" size={26} color={C.cta} />
              </View>
              <Text style={ss.phoneQ}>Study first.{"\n"}Then unlock your apps.</Text>
              <View style={ss.phoneOpt}>
                <Text style={ss.phoneOptTxt}>Complete lesson ✓</Text>
              </View>
              <View style={ss.phoneOpt}>
                <Text style={ss.phoneOptTxt}>Pass quiz ✓</Text>
              </View>
              <View style={[ss.phoneOpt, ss.phoneOptUnlocked]}>
                <Text style={[ss.phoneOptTxt, ss.phoneOptTxtGreen]}>Apps unlocked ✓</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <Text style={ss.title}>Learn anything.{"\n"}Block distractions.</Text>
      <Text style={ss.sub}>
        Your apps are blocking your semester goals.{"\n"}Study first — then unlock.
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
  phoneGlow: {
    borderRadius: 36,
    padding: 12,
    shadowColor: C.cta,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  phone: {
    width: 200,
    borderRadius: 22,
    backgroundColor: "#F0EDE8",
    borderWidth: 8,
    borderColor: "#2D2D2D",
    overflow: "hidden",
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
  lockIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.selected,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
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
  phoneOptUnlocked: { backgroundColor: C.greenLight },
  phoneOptTxt: {
    fontSize: 10,
    fontFamily: F.semi,
    color: C.title,
    textAlign: "center",
  },
  phoneOptTxtGreen: { color: "#15803D" },
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
const ROLES: { iconName: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { iconName: "book-outline", label: "Self-improvement / curiosity" },
  { iconName: "briefcase-outline", label: "Professional skills / career" },
  { iconName: "scale-outline", label: "Bar Exam / Law school" },
  { iconName: "medkit-outline", label: "Medical student (boards)" },
  { iconName: "school-outline", label: "Academic exam prep" },
  { iconName: "globe-outline", label: "Language learning" },
];

function QRoleScreen({ onNext, onSelect }: { onNext: () => void; onSelect: (role: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>What are you{"\n"}learning for?</Text>
      {ROLES.map((r) => (
        <OptionCard
          key={r.label}
          iconName={r.iconName}
          label={r.label}
          selected={sel === r.label}
          onPress={() => {
            Haptics.selectionAsync();
            setSel(r.label);
            onSelect(r.label);
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
const DISTRACTIONS: { iconName: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { iconName: "phone-portrait-outline", label: "Social media / Reels" },
  { iconName: "game-controller-outline", label: "Games" },
  { iconName: "newspaper-outline", label: "News / Reddit" },
  { iconName: "play-circle-outline", label: "YouTube" },
  { iconName: "chatbubbles-outline", label: "Messaging apps" },
  { iconName: "infinite-outline", label: "Everything honestly" },
];

function QDistractionScreen({ onNext }: { onNext: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>What pulls you{"\n"}away from learning?</Text>
      {DISTRACTIONS.map((d) => (
        <OptionCard
          key={d.label}
          iconName={d.iconName}
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
  const startX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        startX.current = x;
        const clamped = Math.max(0, Math.min(x, sliderWidth));
        const h = Math.round((clamped / sliderWidth) * 12);
        setHours(h);
        onHoursChange(h);
      },
      onPanResponderMove: (_, gestureState) => {
        const x = startX.current + gestureState.dx;
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
      ? "Better than most — but growth still demands more."
      : hours <= 4
        ? "That's learning time you're giving to an algorithm."
        : hours <= 7
          ? "Most people never reach their goals because of this."
          : "No wonder making progress feels impossible.";

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>
        How much time do you{"\n"}lose to apps daily?
      </Text>
      <Text style={hrs.sub}>Honest answers build a better study plan</Text>

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
  const pulse = useSharedValue(1);
  const [msg, setMsg] = useState("Mapping your semester ahead…");

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2400 });
    pulse.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
    const t1 = setTimeout(() => setMsg("Building your study plan…"), 800);
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
      <Animated.View style={[lds.iconWrap, pulseStyle]}>
        <Ionicons name="lock-open-outline" size={40} color={C.cta} />
      </Animated.View>
      <Text style={lds.msg}>{msg}</Text>
      <View style={lds.track}>
        <Animated.View style={[lds.fill, barStyle]} />
      </View>
    </Animated.View>
  );
}

const lds = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16, alignItems: "center" },
  iconWrap: { marginBottom: 8 },
  msg: { fontSize: 18, fontFamily: F.bold, color: C.title, alignSelf: "flex-start" },
  track: {
    height: 8,
    backgroundColor: C.progressBg,
    borderRadius: 4,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  fill: { height: 8, backgroundColor: C.cta, borderRadius: 4 },
});

// ── Result ─────────────────────────────────────────────────────────────────────
function ResultScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={rs.root}>
      <Text style={rs.eyebrow}>Your learning profile is</Text>
      <Text style={rs.profile}>The Capable{"\n"}Procrastinator</Text>

      <LinearGradient colors={["#818CF8", "#6366F1"]} style={rs.iconWrap}>
        <Ionicons name="flash" size={40} color="#FFFFFF" />
      </LinearGradient>

      <Text style={rs.desc}>
        You know the material matters. But when it's time to study, your phone
        always wins — for now.
      </Text>

      <View style={rs.bars}>
        <View style={rs.barRow}>
          <Text style={rs.barLabel}>Learning potential</Text>
          <View style={rs.barTrack}>
            <View
              style={[rs.barFill, { width: "82%", backgroundColor: C.green }]}
            />
          </View>
        </View>
        <View style={rs.barRow}>
          <Text style={rs.barLabel}>Daily distraction score</Text>
          <View style={rs.barTrack}>
            <View
              style={[rs.barFill, { width: "75%", backgroundColor: C.cta }]}
            />
          </View>
        </View>
      </View>

      <CTAButton label="That's exactly me" onPress={onNext} />
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
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
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

// ── Semester Goal ──────────────────────────────────────────────────────────────
function SemesterGoalScreen({
  onNext,
  onGoalSet,
}: {
  onNext: () => void;
  onGoalSet: (goal: string) => void;
}) {
  const [goal, setGoal] = useState("");
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Animated.View entering={FadeInDown.duration(300)} style={sgs.root}>
        <IconBadge name="trophy-outline" size={28} color={C.cta} bg={C.selected} />
        <Text style={sgs.title}>What's your{"\n"}goal this semester?</Text>
        <Text style={sgs.sub}>Be specific — vague goals stay dreams</Text>

        <TextInput
          style={sgs.input}
          placeholder="e.g. Pass the MCAT, ace my finals, finish my thesis..."
          placeholderTextColor={C.sub}
          value={goal}
          onChangeText={setGoal}
          multiline
          maxLength={120}
        />

        <Text style={sgs.hint}>This becomes your daily reminder of what you're unlocking for</Text>

        <View style={{ marginTop: "auto", paddingBottom: 8 }}>
          <CTAButton
            label={goal.trim() ? "Lock it in" : "Skip for now"}
            onPress={() => {
              if (goal.trim()) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onGoalSet(goal.trim());
              }
              onNext();
            }}
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const sgs = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  title: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 36,
    marginTop: 4,
  },
  sub: { fontSize: 14, fontFamily: F.semi, color: C.sub },
  input: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: F.semi,
    color: C.title,
    minHeight: 100,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    fontFamily: F.regular,
    color: C.sub,
    lineHeight: 17,
  },
});

// ── Bad news ───────────────────────────────────────────────────────────────────
function BadNewsScreen({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={bns.root}>
      <Text style={bns.oof}>WAIT.</Text>
      <Text style={bns.msg}>Your semester goal{"\n"}is already in danger.</Text>
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
      <Text style={sts.pre}>At this rate, you'll spend</Text>
      <Text style={sts.years}>{years} years</Text>
      <Text style={sts.post}>
        of your life lost —{"\n"}and your semester is just the start
      </Text>

      <View style={sts.mascotWrap}>
        <LinearGradient colors={["#FEE2E2", "#FECACA"]} style={sts.mascotGrad}>
          <Ionicons name="phone-portrait-outline" size={44} color={C.red} />
          <View style={sts.mascotBadge}>
            <Ionicons name="close-circle" size={22} color={C.red} />
          </View>
        </LinearGradient>
      </View>

      <Text style={sts.note}>
        Based on {hours}h/day × your remaining years
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
  mascotWrap: { position: "relative", marginBottom: 16 },
  mascotGrad: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: C.white,
    borderRadius: 11,
  },
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
      <Text style={lgs.title}>This is your life.{"\n"}One dot = one year.</Text>
      <Text style={lgs.gridSub}>Every year you scroll instead of study is a year you can't get back.</Text>

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
          <Text style={lgs.legendTxt}>Where you are now</Text>
        </View>
        <View style={lgs.legendRow}>
          <View style={[lgs.legendDot, { backgroundColor: C.red }]} />
          <Text style={lgs.legendTxt}>{wastedYears} years lost to distraction</Text>
        </View>
        <View style={lgs.legendRow}>
          <View style={[lgs.legendDot, { backgroundColor: C.progressBg }]} />
          <Text style={lgs.legendTxt}>Time remaining to learn and grow</Text>
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
  gridSub: { fontSize: 13, fontFamily: F.semi, color: C.sub, lineHeight: 18, marginBottom: 16, marginTop: -12 },
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
      <Text style={gns.pre}>Here's the good news.</Text>
      <Text style={gns.bold}>Unloq gives that time back</Text>
      <Text style={gns.years}>
        {years} years of{"\n"}focused learning
      </Text>
      <Text style={gns.semester}>Starting this semester.</Text>
      <LinearGradient colors={["#D1FAE5", "#A7F3D0"]} style={gns.mascotCircle}>
        <Ionicons name="checkmark-circle" size={64} color={C.green} />
      </LinearGradient>
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
  semester: { fontSize: 16, fontFamily: F.bold, color: C.green, marginBottom: 16 },
  mascotCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
});

// ── Why Unloq ──────────────────────────────────────────────────────────────────
function WhyUnloqScreen({ onNext }: { onNext: () => void }) {
  const rows = [
    { text: "App blockers", sub: "→ You find a workaround in 30 seconds", bad: true },
    { text: "Willpower alone", sub: "→ Decision fatigue kills it by lunch", bad: true },
    { text: "Unloq", sub: "→ Prove you studied, then unlock", bad: false },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={wus.root}>
      <Text style={wus.title}>Why nothing has{"\n"}worked — until now</Text>
      {rows.map((r) => (
        <View key={r.text} style={[wus.row, !r.bad && wus.rowGood]}>
          <View style={[wus.iconBox, r.bad ? wus.iconBoxBad : wus.iconBoxGood]}>
            <Ionicons
              name={r.bad ? "close" : "checkmark"}
              size={15}
              color={r.bad ? "#DC2626" : "#16A34A"}
            />
          </View>
          <Text style={[wus.rowTxt, !r.bad && wus.rowTxtGood]}>
            <Text style={wus.rowBold}>{r.text}</Text>
            {"  "}
            {r.sub}
          </Text>
        </View>
      ))}

      <View style={wus.feynman}>
        <Text style={wus.feynmanTitle}>The Unloq Method</Text>
        <Text style={wus.feynmanSub}>
          Complete daily lessons and quizzes. Your apps stay locked until you finish.
          No bypass. No exceptions. Consistent daily reps beat a two-week cram — every time.
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
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxBad: { backgroundColor: "#FEE2E2" },
  iconBoxGood: { backgroundColor: "#DCFCE7" },
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
          <Text style={cms.title}>Your semester starts{"\n"}with this choice.</Text>
          <Text style={cms.sub}>Study first. Then your apps unlock.</Text>

          <TouchableOpacity
            onPress={handleTap}
            activeOpacity={0.85}
            style={cms.chainArea}
          >
            <Animated.View style={[cms.lockWrap, chainStyle]}>
              <LinearGradient colors={["#818CF8", "#6366F1"]} style={cms.lockGrad}>
                <Ionicons name={done ? "lock-open" : "lock-closed"} size={48} color="#FFF" />
              </LinearGradient>
            </Animated.View>
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
          <LinearGradient colors={["#D1FAE5", "#6EE7B7"]} style={cms.doneCircle}>
            <Ionicons name="checkmark" size={56} color={C.green} />
          </LinearGradient>
          <Text style={cms.doneTitle}>You're locked in.</Text>
          <Text style={cms.doneSub}>
            Your semester goal is set. Upload your first study document
            and let's get to work.
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
  lockWrap: { alignItems: "center", justifyContent: "center" },
  lockGrad: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
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
  doneCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: "center",
    alignItems: "center",
  },
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

// ── Pricing ────────────────────────────────────────────────────────────────────
function PricingScreen({ onNext }: { onNext: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleGetPremium = async () => {
    setLoading(true);
    try {
      await RevenueCatUI.presentPaywall();
    } catch {}
    setLoading(false);
    onNext();
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={pr.root}>
      <Text style={pr.eyebrow}>Your learning plan</Text>
      <Text style={pr.title}>Start today.{'\n'}Your goals won't wait.</Text>

      <View style={pr.card}>
        {[
          { bold: 'Unlimited courses from your content', sub: 'Upload notes, outlines, any PDF or YouTube video' },
          { bold: 'YouTube import', sub: 'Turn any lecture into a structured daily lesson in seconds' },
          { bold: 'Enforced app blocking', sub: 'Apps stay locked until you finish your daily lessons — no bypass' },
          { bold: 'Flashcards & quizzes', sub: 'Active recall built into every lesson — the method that actually builds memory' },
        ].map((f) => (
          <View key={f.bold} style={pr.featureRow}>
            <Text style={pr.featureCheck}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={pr.featureBold}>{f.bold}</Text>
              <Text style={pr.featureSub}>{f.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[pr.btnPrimary, loading && { opacity: 0.7 }]}
        onPress={handleGetPremium}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={pr.btnPrimaryTxt}>{loading ? 'Loading…' : 'Unlock Premium'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} activeOpacity={0.7} style={pr.btnSecondary}>
        <Text style={pr.btnSecondaryTxt}>Start free, upgrade later →</Text>
      </TouchableOpacity>

      <Text style={pr.legal}>Free plan: 1 course included · No credit card required · Cancel anytime</Text>

      <Text style={pr.legal}>
        By subscribing you agree to our{' '}
        <Text
          style={pr.legalLink}
          onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/terms-of-service.html')}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={pr.legalLink}
          onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/privacy-policy.html')}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </Animated.View>
  );
}

const pr = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 14 },
  eyebrow: { fontSize: 11, fontFamily: F.extraBold, color: C.cta, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 28, fontFamily: F.extraBold, color: C.title, lineHeight: 36 },
  card: {
    backgroundColor: '#F5F5FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 14,
  },
  featureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  featureCheck: { fontSize: 15, color: C.cta, fontFamily: F.extraBold, width: 18, marginTop: 1 },
  featureBold: { fontSize: 14, fontFamily: F.bold, color: C.title },
  featureSub: { fontSize: 12, fontFamily: F.regular, color: C.sub, lineHeight: 17, marginTop: 1 },
  btnPrimary: {
    backgroundColor: C.cta, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: C.ctaShadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8,
  },
  btnPrimaryTxt: { fontSize: 16, fontFamily: F.extraBold, color: '#fff' },
  btnSecondary: { alignItems: 'center', paddingVertical: 8 },
  btnSecondaryTxt: { fontSize: 15, fontFamily: F.semi, color: C.sub },
  legal: { fontSize: 11, fontFamily: F.regular, color: C.sub, textAlign: 'center' },
  legalLink: { color: C.cta, fontFamily: F.semi },
});

// ── Q: Course (final onboarding step) ─────────────────────────────────────────
function QCourseScreen({ onNext, role }: { onNext: () => void; role: string | null }) {
  const { isAuthenticated } = useConvexAuth();
  const createCourse   = useMutation(api.courses.create);
  const generateCourse = useAction(api.ai.generateCourse);
  const getUploadUrl   = useMutation(api.courses.generateUploadUrl);

  const [topic, setTopic]     = useState("");
  const [docName, setDocName] = useState<string | null>(null);
  const [docUri, setDocUri]   = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);

  const roleLabel = role ?? "your courses";

  const pickDocument = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setDocName(asset.name);
      setDocUri(asset.uri);
      if (!topic) setTopic(asset.name.replace(/\.pdf$/i, ""));
    } catch {}
  };

  const handleCreate = async () => {
    if (!topic.trim() || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      if (docUri && docName) {
        const fileInfo = await FileSystem.getInfoAsync(docUri);
        const MAX = 20 * 1024 * 1024;
        if ((fileInfo as any).size > MAX) {
          setBusy(false);
          return;
        }
        const uploadUrl = await getUploadUrl();
        const res = await FileSystem.uploadAsync(uploadUrl, docUri, {
          httpMethod: "POST",
          mimeType: "application/pdf",
        });
        const { storageId } = JSON.parse(res.body);
        const courseId = await createCourse({
          title: topic.trim(),
          description: "",
          docName,
          sourceType: "pdf",
          totalLessons: 5,
          difficulty: "intermediate",
        });
        generateCourse({ courseId, pdfStorageId: storageId, lessonCount: 5, difficulty: "intermediate", includeFlashcards: true, includeQuiz: true, includeDiagram: false }).catch(() => {});
      } else {
        const courseId = await createCourse({
          title: topic.trim(),
          description: "",
          docName: topic.trim(),
          totalLessons: 5,
          difficulty: "intermediate",
        });
        generateCourse({ courseId, courseTopic: topic.trim(), lessonCount: 5, difficulty: "intermediate", includeFlashcards: true, includeQuiz: true, includeDiagram: false }).catch(() => {});
      }
      setDone(true);
      setTimeout(onNext, 1400);
    } catch {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Animated.View entering={FadeIn.duration(400)} style={qcs.doneRoot}>
        <LinearGradient colors={["#D1FAE5", "#6EE7B7"]} style={qcs.doneCircle}>
          <Ionicons name="checkmark" size={48} color={C.green} />
        </LinearGradient>
        <Text style={qcs.doneTitle}>Course added!</Text>
        <Text style={qcs.doneSub}>It'll be ready by the time you get there.</Text>
      </Animated.View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={qcs.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Ready badge */}
        <View style={qcs.readyBadge}>
          <Text style={qcs.readyCheck}>✓</Text>
          <Text style={qcs.readyTxt} numberOfLines={2}>
            {roleLabel} courses are ready for you
          </Text>
        </View>

        <Text style={qcs.title}>Add your own{"\n"}study material</Text>
        <Text style={qcs.sub}>
          Optional — you don't need to upload anything. Your personalised courses
          are already waiting. But if you have your own notes or a lecture, add
          it here.
        </Text>

        {isAuthenticated ? (
          <>
            {/* Topic input */}
            <View style={qcs.inputWrap}>
              <TextInput
                style={qcs.input}
                placeholder="What's the topic? (e.g. Tort Law)"
                placeholderTextColor={C.sub}
                value={topic}
                onChangeText={setTopic}
                returnKeyType="done"
              />
            </View>

            {/* PDF picker */}
            <TouchableOpacity style={qcs.pdfBtn} onPress={pickDocument} activeOpacity={0.8}>
              <Text style={qcs.pdfIcon}>{docUri ? "📄" : "📎"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={qcs.pdfLabel}>
                  {docUri ? docName ?? "PDF selected" : "Attach a PDF (optional)"}
                </Text>
                {!docUri && (
                  <Text style={qcs.pdfSub}>Leave empty to generate from topic name</Text>
                )}
              </View>
              {docUri && <Text style={qcs.pdfChange}>Change</Text>}
            </TouchableOpacity>

            <View style={{ marginTop: 8 }}>
              <CTAButton
                label={busy ? "Adding…" : "Add course"}
                onPress={handleCreate}
                disabled={!topic.trim() || busy}
              />
            </View>
          </>
        ) : (
          <View style={qcs.authNote}>
            <Text style={qcs.authNoteText}>
              Sign in from the home screen to add your own courses anytime.
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={onNext} style={qcs.skipBtn} activeOpacity={0.7}>
          <Text style={qcs.skipTxt}>Skip for now  →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const qcs = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  readyCheck: { fontSize: 14, color: "#15803D", fontFamily: F.bold },
  readyTxt: { fontSize: 13, fontFamily: F.semi, color: "#15803D", flexShrink: 1 },
  title: {
    fontSize: 28,
    fontFamily: F.extraBold,
    color: C.title,
    lineHeight: 36,
  },
  sub: {
    fontSize: 14,
    fontFamily: F.semi,
    color: C.sub,
    lineHeight: 21,
  },
  inputWrap: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontSize: 15,
    fontFamily: F.semi,
    color: C.title,
  },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pdfIcon: { fontSize: 20 },
  pdfLabel: { fontSize: 14, fontFamily: F.semi, color: C.title },
  pdfSub:   { fontSize: 12, fontFamily: F.regular, color: C.sub, marginTop: 2 },
  pdfChange: { fontSize: 13, fontFamily: F.semi, color: C.cta },
  authNote: {
    backgroundColor: C.selected,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.selectedBorder,
    padding: 14,
  },
  authNoteText: {
    fontSize: 14,
    fontFamily: F.semi,
    color: C.sub,
    lineHeight: 20,
    textAlign: "center",
  },
  skipBtn: { alignSelf: "center", paddingVertical: 10, marginTop: 4 },
  skipTxt: { fontSize: 15, fontFamily: F.semi, color: C.sub },
  doneRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  doneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  doneTitle: { fontSize: 32, fontFamily: F.extraBold, color: C.title },
  doneSub:   { fontSize: 15, fontFamily: F.semi, color: C.sub, textAlign: "center" },
});

// ── Main ───────────────────────────────────────────────────────────────────────
type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const [hours, setHours] = useState(4);
  const screen = FLOW[idx];
  const { onboardingRole, setOnboardingRole } = useAppStore();

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
          <Ionicons name="book-outline" size={22} color={C.cta} />
        </Animated.View>
      )}

      {/* Screen content */}
      <View style={root.content} key={screen}>
        {screen === "splash" && <SplashScreen onNext={next} />}
        {screen === "q_role" && <QRoleScreen onNext={next} onSelect={setOnboardingRole} />}
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
        {screen === "commitment" && <CommitmentScreen onNext={next} />}
        {screen === "pricing" && <PricingScreen onNext={next} />}
        {screen === "q_course" && <QCourseScreen onNext={onComplete} role={onboardingRole} />}
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
  content: { flex: 1 },
});
