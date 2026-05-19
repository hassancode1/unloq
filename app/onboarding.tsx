import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import { useAppStore } from "../store/useAppStore";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#FFFFFF",
  cta: "#6366F1",
  ctaShadow: "#4338CA",
  title: "#1A1A2E",
  sub: "#6B7280",
  card: "#FFFFFF",
  cardBorder: "#E0E7FF",
  green: "#10B981",
  greenLight: "#D1FAE5",
  progress: "#6366F1",
  progressBg: "#E0E7FF",
  white: "#FFFFFF",
  selected: "#EEF2FF",
  selectedBorder: "#6366F1",
};

const F = {
  bold:      "Nunito-Bold",
  extraBold: "Nunito-ExtraBold",
  semi:      "Nunito-SemiBold",
  regular:   "Nunito-Regular",
};

// ── Flow ───────────────────────────────────────────────────────────────────────
type ScreenId = "welcome" | "q_goal" | "feynman" | "ai_notes" | "q_hours";

const FLOW: ScreenId[] = ["welcome", "q_goal", "feynman", "ai_notes", "q_hours"];
const QUESTION_SCREENS: ScreenId[] = ["q_goal", "feynman", "ai_notes", "q_hours"];

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
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <View style={ctaStyles.wrap}>
      <View style={[ctaStyles.shadow, disabled && { opacity: 0.4 }]} />
      <Animated.View style={style}>
        <TouchableOpacity
          activeOpacity={1}
          disabled={disabled}
          onPressIn={() => { ty.value = withSpring(4, { damping: 12 }); }}
          onPressOut={() => { ty.value = withSpring(0, { damping: 12 }); }}
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
    position: "absolute", bottom: -5, left: 0, right: 0,
    height: 62, borderRadius: 18, backgroundColor: C.ctaShadow,
  },
  btn: {
    backgroundColor: C.cta, borderRadius: 18,
    height: 62, justifyContent: "center", alignItems: "center",
  },
  label: { color: C.white, fontSize: 18, fontFamily: F.bold },
});

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
      <Text style={[optStyles.label, selected && optStyles.labelSelected]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={C.cta} />}
    </TouchableOpacity>
  );
}

// Static info card — same visual as OptionCard but not pressable
function InfoCard({
  label,
  sublabel,
  iconName,
  accent,
}: {
  label: string;
  sublabel?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accent?: string;
}) {
  const color = accent ?? C.cta;
  return (
    <View style={[optStyles.card, { borderColor: color + "30", backgroundColor: color + "08" }]}>
      <View style={[optStyles.iconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={iconName} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[optStyles.label, { color: C.title }]}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 12, fontFamily: F.regular, color: C.sub, marginTop: 1 }}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const optStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.cardBorder, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
  },
  selected: { backgroundColor: C.selected, borderColor: C.selectedBorder },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center",
  },
  iconBoxSelected: { backgroundColor: C.selectedBorder + "22" },
  label: { fontSize: 15, fontFamily: F.semi, color: C.title, flex: 1 },
  labelSelected: { color: C.cta },
});

// ── ProgressBar ────────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pbStyles.track}>
      <View style={[pbStyles.fill, { width: `${(step / total) * 100}%` }]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: { height: 6, backgroundColor: C.progressBg, borderRadius: 3, flex: 1 },
  fill: { height: 6, backgroundColor: C.progress, borderRadius: 3 },
});

// ── Welcome ────────────────────────────────────────────────────────────────────
function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={ss.root}>
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
      <Text style={ss.legal}>By continuing you agree to our Terms & Privacy Policy</Text>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 16 },
  phoneWrap: { marginBottom: 28, marginTop: 8 },
  phoneGlow: {
    borderRadius: 36, padding: 12,
    shadowColor: C.cta, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  phone: {
    width: 200, borderRadius: 22, backgroundColor: "#F0EDE8",
    borderWidth: 8, borderColor: "#2D2D2D", overflow: "hidden",
  },
  phoneLockBar: { height: 6, backgroundColor: "#2D2D2D", marginHorizontal: 60, borderRadius: 3, marginVertical: 8 },
  phoneContent: { paddingHorizontal: 14, paddingBottom: 16, alignItems: "center", gap: 8 },
  lockIconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.selected,
    justifyContent: "center", alignItems: "center", marginBottom: 2,
  },
  phoneQ: { fontSize: 12, fontFamily: F.bold, color: C.title, textAlign: "center", lineHeight: 17 },
  phoneOpt: { width: "100%", backgroundColor: C.white, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  phoneOptUnlocked: { backgroundColor: C.greenLight },
  phoneOptTxt: { fontSize: 10, fontFamily: F.semi, color: C.title, textAlign: "center" },
  phoneOptTxtGreen: { color: "#15803D" },
  title: { fontSize: 34, fontFamily: F.extraBold, color: C.title, textAlign: "center", lineHeight: 42, marginBottom: 12 },
  sub: { fontSize: 15, fontFamily: F.semi, color: C.sub, textAlign: "center", lineHeight: 22, marginBottom: 8 },
  legal: { fontSize: 11, fontFamily: F.regular, color: C.sub, textAlign: "center", marginTop: 12, paddingHorizontal: 24 },
});

// ── Q: Goal ────────────────────────────────────────────────────────────────────
const ROLES: { iconName: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { iconName: "book-outline",      label: "Self-improvement / curiosity" },
  { iconName: "briefcase-outline", label: "Professional skills / career" },
  { iconName: "scale-outline",     label: "Bar Exam / Law school" },
  { iconName: "medkit-outline",    label: "Medical student (boards)" },
  { iconName: "school-outline",    label: "Academic exam prep" },
  { iconName: "globe-outline",     label: "Language learning" },
];

function QGoalScreen({ onNext, onSelect }: { onNext: () => void; onSelect: (role: string) => void }) {
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
          onPress={() => { Haptics.selectionAsync(); setSel(r.label); onSelect(r.label); }}
        />
      ))}
      <View style={{ marginTop: 4 }}>
        <CTAButton label="Continue" onPress={onNext} disabled={!sel} />
      </View>
    </Animated.View>
  );
}

// ── Feynman Technique ──────────────────────────────────────────────────────────
function FeynmanScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <View style={{ marginBottom: 6 }}>
        <View style={infoStyles.badge}>
          <Text style={infoStyles.badgeText}>How you'll learn</Text>
        </View>
      </View>
      <Text style={qs.title}>The Feynman{"\n"}Technique</Text>
      <Text style={[qs.sub, { marginBottom: 16 }]}>The fastest way to truly master anything</Text>

      <InfoCard iconName="book-outline"    label="Study the material"              sublabel="Read and absorb the key ideas" accent="#6366F1" />
      <InfoCard iconName="create-outline"  label="Explain it simply"               sublabel="Teach it back in plain language" accent="#8B5CF6" />
      <InfoCard iconName="search-outline"  label="Find your gaps"                  sublabel="Notice what you can't explain yet" accent="#EC4899" />
      <InfoCard iconName="refresh-outline" label="Go back and fill those gaps"     sublabel="Review until you've got it solid" accent="#F59E0B" />

      <View style={{ marginTop: 8 }}>
        <CTAButton label="Got it →" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

// ── AI Generated Notes ─────────────────────────────────────────────────────────
function AiNotesScreen({ onNext }: { onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <View style={{ marginBottom: 6 }}>
        <View style={infoStyles.badge}>
          <Text style={infoStyles.badgeText}>Powered by AI</Text>
        </View>
      </View>
      <Text style={qs.title}>AI builds your{"\n"}lessons instantly</Text>
      <Text style={[qs.sub, { marginBottom: 16 }]}>Upload any PDF, YouTube link, or topic</Text>

      <InfoCard iconName="document-text-outline"      label="Smart Notes"   sublabel="Key concepts summarised for you" accent="#6366F1" />
      <InfoCard iconName="albums-outline"             label="Flashcards"    sublabel="Active recall to lock in memory" accent="#8B5CF6" />
      <InfoCard iconName="checkmark-circle-outline"   label="Quiz"          sublabel="Test your understanding instantly" accent="#10B981" />

      <View style={{ marginTop: 8 }}>
        <CTAButton label="Let's go →" onPress={onNext} />
      </View>
    </Animated.View>
  );
}

const infoStyles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: C.selected,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.selectedBorder + "40",
  },
  badgeText: { fontSize: 12, fontFamily: F.semi, color: C.cta },
});

// ── Q: Hours ───────────────────────────────────────────────────────────────────
const HOURS_OPTIONS: { iconName: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
  { iconName: "time-outline", label: "Less than 1 hour", value: "<1h" },
  { iconName: "time-outline", label: "1–2 hours",        value: "1-2h" },
  { iconName: "time-outline", label: "2–4 hours",        value: "2-4h" },
  { iconName: "time-outline", label: "4+ hours",         value: "4+h" },
];

function QHoursScreen({ onNext, onSelect }: { onNext: () => void; onSelect: (h: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={qs.root}>
      <Text style={qs.title}>How much time do you{"\n"}lose to apps daily?</Text>
      <Text style={qs.sub}>Be honest — this shapes your study plan</Text>
      {HOURS_OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          iconName={o.iconName}
          label={o.label}
          selected={sel === o.value}
          onPress={() => { Haptics.selectionAsync(); setSel(o.value); onSelect(o.value); }}
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
  title: { fontSize: 28, fontFamily: F.extraBold, color: C.title, lineHeight: 36, marginBottom: 20 },
  sub: { fontSize: 14, fontFamily: F.semi, color: C.sub, marginBottom: 12, marginTop: -12 },
});

// ── Main ───────────────────────────────────────────────────────────────────────
type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const screen = FLOW[idx];
  const { setOnboardingRole, setHoursLost } = useAppStore();

  const finish = useCallback(async () => {
    try {
      await RevenueCatUI.presentPaywall();
    } catch {}
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (idx === FLOW.length - 1) {
      finish();
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, finish]);

  const showProgress = screen !== "welcome";
  const progressStep = QUESTION_SCREENS.indexOf(screen) + 1;

  return (
    <View style={[rootStyles.wrap, { backgroundColor: C.bg }]}>
      <View style={{ height: insets.top }} />

      {showProgress && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={rootStyles.topBar}
        >
          <ProgressBar step={progressStep} total={QUESTION_SCREENS.length} />
          <Ionicons name="book-outline" size={22} color={C.cta} />
        </Animated.View>
      )}

      <View style={rootStyles.content} key={screen}>
        {screen === "welcome"   && <WelcomeScreen  onNext={next} />}
        {screen === "q_goal"    && <QGoalScreen    onNext={next} onSelect={setOnboardingRole} />}
        {screen === "feynman"   && <FeynmanScreen   onNext={next} />}
        {screen === "ai_notes"  && <AiNotesScreen   onNext={next} />}
        {screen === "q_hours"   && <QHoursScreen   onNext={next} onSelect={setHoursLost} />}
      </View>

      <View style={{ height: insets.bottom + 8 }} />
    </View>
  );
}

const rootStyles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  content: { flex: 1 },
});
