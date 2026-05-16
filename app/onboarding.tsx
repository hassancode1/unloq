import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
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
type ScreenId = "welcome" | "q_goal" | "q_distraction" | "q_hours" | "q_course";

const FLOW: ScreenId[] = ["welcome", "q_goal", "q_distraction", "q_hours", "q_course"];
const QUESTION_SCREENS: ScreenId[] = ["q_goal", "q_distraction", "q_hours", "q_course"];

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

// ── Q: Distraction ─────────────────────────────────────────────────────────────
const DISTRACTIONS: { iconName: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { iconName: "phone-portrait-outline", label: "Social media / Reels" },
  { iconName: "game-controller-outline", label: "Games" },
  { iconName: "newspaper-outline",      label: "News / Reddit" },
  { iconName: "play-circle-outline",    label: "YouTube" },
  { iconName: "chatbubbles-outline",    label: "Messaging apps" },
  { iconName: "infinite-outline",       label: "Everything honestly" },
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
          onPress={() => { Haptics.selectionAsync(); setSel(d.label); }}
        />
      ))}
      <View style={{ marginTop: 4 }}>
        <CTAButton label="Continue" onPress={onNext} disabled={!sel} />
      </View>
    </Animated.View>
  );
}

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

// ── Q: Course ──────────────────────────────────────────────────────────────────
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
        if ((fileInfo as any).size > MAX) { setBusy(false); return; }
        const uploadUrl = await getUploadUrl();
        const res = await FileSystem.uploadAsync(uploadUrl, docUri, {
          httpMethod: "POST",
          mimeType: "application/pdf",
        });
        const { storageId } = JSON.parse(res.body);
        const courseId = await createCourse({
          title: topic.trim(), description: "", docName,
          sourceType: "pdf", totalLessons: 5, difficulty: "intermediate",
        });
        generateCourse({ courseId, pdfStorageId: storageId, lessonCount: 5, difficulty: "intermediate", includeFlashcards: true, includeQuiz: true, includeDiagram: false }).catch(() => {});
      } else {
        const courseId = await createCourse({
          title: topic.trim(), description: "", docName: topic.trim(),
          totalLessons: 5, difficulty: "intermediate",
        });
        generateCourse({ courseId, courseTopic: topic.trim(), lessonCount: 5, difficulty: "intermediate", includeFlashcards: true, includeQuiz: true, includeDiagram: false }).catch(() => {});
      }
      setDone(true);
      setTimeout(onNext, 1400);
    } catch { setBusy(false); }
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
        <View style={qcs.readyBadge}>
          <Text style={qcs.readyCheck}>✓</Text>
          <Text style={qcs.readyTxt} numberOfLines={2}>
            {roleLabel} courses are ready for you
          </Text>
        </View>

        <Text style={qcs.title}>Add your own{"\n"}study material</Text>
        <Text style={qcs.sub}>
          Optional — personalised courses are already waiting. Add your own notes or lecture if you have one.
        </Text>

        {isAuthenticated ? (
          <>
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

            <TouchableOpacity style={qcs.pdfBtn} onPress={pickDocument} activeOpacity={0.8}>
              <Text style={qcs.pdfIcon}>{docUri ? "📄" : "📎"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={qcs.pdfLabel}>
                  {docUri ? docName ?? "PDF selected" : "Attach a PDF (optional)"}
                </Text>
                {!docUri && <Text style={qcs.pdfSub}>Leave empty to generate from topic name</Text>}
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
  root: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 14 },
  readyBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#DCFCE7", borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: "flex-start", marginBottom: 4,
  },
  readyCheck: { fontSize: 14, color: "#15803D", fontFamily: F.bold },
  readyTxt:   { fontSize: 13, fontFamily: F.semi, color: "#15803D", flexShrink: 1 },
  title: { fontSize: 28, fontFamily: F.extraBold, color: C.title, lineHeight: 36 },
  sub:   { fontSize: 14, fontFamily: F.semi, color: C.sub, lineHeight: 21 },
  inputWrap: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.cardBorder, paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { fontSize: 15, fontFamily: F.semi, color: C.title },
  pdfBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.cardBorder, paddingHorizontal: 16, paddingVertical: 14,
  },
  pdfIcon:   { fontSize: 20 },
  pdfLabel:  { fontSize: 14, fontFamily: F.semi, color: C.title },
  pdfSub:    { fontSize: 12, fontFamily: F.regular, color: C.sub, marginTop: 2 },
  pdfChange: { fontSize: 13, fontFamily: F.semi, color: C.cta },
  authNote: {
    backgroundColor: C.selected, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.selectedBorder, padding: 14,
  },
  authNoteText: { fontSize: 14, fontFamily: F.semi, color: C.sub, lineHeight: 20, textAlign: "center" },
  skipBtn: { alignSelf: "center", paddingVertical: 10, marginTop: 4 },
  skipTxt: { fontSize: 15, fontFamily: F.semi, color: C.sub },
  doneRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  doneCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: "center", alignItems: "center" },
  doneTitle: { fontSize: 32, fontFamily: F.extraBold, color: C.title },
  doneSub:   { fontSize: 15, fontFamily: F.semi, color: C.sub, textAlign: "center" },
});

// ── Main ───────────────────────────────────────────────────────────────────────
type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const screen = FLOW[idx];
  const { onboardingRole, setOnboardingRole, setHoursLost } = useAppStore();

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (idx === FLOW.length - 1) {
      onComplete();
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, onComplete]);

  const showProgress = screen !== "welcome";
  const progressStep = QUESTION_SCREENS.indexOf(screen) + 1;

  return (
    <View style={[root.wrap, { backgroundColor: C.bg }]}>
      <View style={{ height: insets.top }} />

      {showProgress && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={root.topBar}
        >
          <ProgressBar step={progressStep} total={QUESTION_SCREENS.length} />
          <Ionicons name="book-outline" size={22} color={C.cta} />
        </Animated.View>
      )}

      <View style={root.content} key={screen}>
        {screen === "welcome"       && <WelcomeScreen onNext={next} />}
        {screen === "q_goal"        && <QGoalScreen onNext={next} onSelect={setOnboardingRole} />}
        {screen === "q_distraction" && <QDistractionScreen onNext={next} />}
        {screen === "q_hours"       && <QHoursScreen onNext={next} onSelect={setHoursLost} />}
        {screen === "q_course"      && <QCourseScreen onNext={onComplete} role={onboardingRole} />}
      </View>

      <View style={{ height: insets.bottom + 8 }} />
    </View>
  );
}

const root = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  content: { flex: 1 },
});
