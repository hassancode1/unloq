import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useAction, useQuery } from 'convex/react';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { api } from '../convex/_generated/api';
import { useTheme } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { Spacing } from '../constants/spacing';
import Toast from 'react-native-toast-message';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type SourceTab = 'pdf' | 'youtube';

const LESSON_STEPS = [5, 7, 10, 12, 15];

const DIFFICULTIES: { id: Difficulty; label: string; icon: string; color: string }[] = [
  { id: 'beginner',     label: 'Beginner',     icon: 'leaf',       color: '#16A34A' },
  { id: 'intermediate', label: 'Intermediate', icon: 'flame',      color: '#D97706' },
  { id: 'advanced',     label: 'Advanced',     icon: 'flash',      color: '#7C3AED' },
];

type Props = { onBack: () => void };

// ── Animated generating screen ───────────────────────────────────────────────

const STEPS = [
  { icon: 'document-text-outline', label: 'Reading your document',     ms: 0    },
  { icon: 'git-branch-outline',    label: 'Structuring lessons',        ms: 4500 },
  { icon: 'layers-outline',        label: 'Writing flashcards',         ms: 9000 },
  { icon: 'help-circle-outline',   label: 'Creating quiz questions',    ms: 14000},
  { icon: 'checkmark-circle',      label: 'Finalising your course',     ms: 19000},
];

function GeneratingView({ C, fs, F, insetTop }: { C: any; fs: any; F: any; insetTop: number }) {
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps]   = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pulsing outer ring
  const ringScale   = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  // Icon rotate
  const rotate = useSharedValue(0);

  // Progress bar
  const progress = useSharedValue(0);

  // Dots
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    // Pulse ring
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
        withTiming(1,   { duration: 1000, easing: Easing.in(Easing.ease) }),
      ), -1, true,
    );
    ringOpacity.value = withRepeat(
      withSequence(withTiming(0.12, { duration: 1000 }), withTiming(0.35, { duration: 1000 })),
      -1, true,
    );

    // Gentle rotate
    rotate.value = withRepeat(withTiming(360, { duration: 3000, easing: Easing.linear }), -1, false);

    // Progress bar slowly fills (~25s total)
    progress.value = withTiming(0.9, { duration: 24000, easing: Easing.out(Easing.quad) });

    // Bouncing dots
    const dotAnim = (sv: any, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      ));
    };
    dotAnim(d1, 0); dotAnim(d2, 180); dotAnim(d3, 360);

    // Step progression
    STEPS.forEach((step, i) => {
      if (i === 0) return;
      const t = setTimeout(() => {
        setDoneSteps(prev => [...prev, i - 1]);
        setActiveStep(i);
      }, step.ms);
      timers.current.push(t);
    });

    return () => timers.current.forEach(clearTimeout);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));
  const dotStyle = (sv: any) => useAnimatedStyle(() => ({
    opacity: interpolate(sv.value, [0, 1], [0.25, 1]),
    transform: [{ translateY: interpolate(sv.value, [0, 1], [0, -5]) }],
  }));

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insetTop }]}>
      <Animated.View entering={FadeIn.duration(500)} style={S.stateScreen}>

        {/* Icon with pulse ring */}
        <View style={S.iconOuter}>
          <Animated.View style={[S.pulseRing, { backgroundColor: C.primary }, ringStyle]} />
          <View style={[S.stateIconRing, { borderColor: C.primaryRing, backgroundColor: C.primaryBg }]}>
            <Animated.View style={iconStyle}>
              <Ionicons name="sparkles" size={34} color={C.primary} />
            </Animated.View>
          </View>
        </View>

        <Text style={[S.stateTitle, { fontFamily: F.bold, fontSize: fs(22), color: C.text }]}>
          Building your course…
        </Text>
        <Text style={[S.stateSub, { fontFamily: F.regular, fontSize: fs(13), color: C.sub }]}>
          AI is reading and structuring your document.{'\n'}This takes about 20–30 seconds.
        </Text>

        {/* Progress bar */}
        <View style={[S.progressTrack, { backgroundColor: C.surfaceAlt }]}>
          <Animated.View style={[S.progressFill, { backgroundColor: C.primary }, barStyle]} />
        </View>

        {/* Steps */}
        <View style={[S.stepsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          {STEPS.map((step, i) => {
            const isDone   = doneSteps.includes(i);
            const isActive = activeStep === i;
            return (
              <Animated.View
                key={step.label}
                entering={FadeInDown.delay(i * 60).duration(300)}
                style={[
                  S.stepRow,
                  i < STEPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                ]}
              >
                <View style={[
                  S.stepIconBox,
                  isDone   && { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40` },
                  isActive && { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}35` },
                  !isDone && !isActive && { backgroundColor: C.surfaceAlt, borderColor: C.border },
                ]}>
                  {isDone
                    ? <Ionicons name="checkmark" size={14} color={C.primary} />
                    : <Ionicons name={step.icon as any} size={14} color={isActive ? C.primary : C.muted} />
                  }
                </View>
                <Text style={[
                  S.stepLabel,
                  { fontFamily: isActive ? F.semiBold : F.regular, fontSize: fs(13) },
                  isDone   && { color: C.primary },
                  isActive && { color: C.text },
                  !isDone && !isActive && { color: C.muted },
                ]}>
                  {step.label}
                </Text>
                {isActive && (
                  <View style={S.activeDots}>
                    <Animated.View style={[S.activeDot, { backgroundColor: C.primary }, dotStyle(d1)]} />
                    <Animated.View style={[S.activeDot, { backgroundColor: C.primary }, dotStyle(d2)]} />
                    <Animated.View style={[S.activeDot, { backgroundColor: C.primary }, dotStyle(d3)]} />
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

      </Animated.View>
    </View>
  );
}

export default function UploadScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();

  const [docName, setDocName]       = useState<string | null>(null);
  const [docUri, setDocUri]         = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [prompt, setPrompt]         = useState('');
  const [lessonIdx, setLessonIdx]   = useState(0);
  const [diffIdx, setDiffIdx]       = useState(1);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle');

  const [sourceTab, setSourceTab]           = useState<SourceTab>('pdf');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [includeFlashcards, setIncludeFlashcards] = useState(true);
  const [includeQuiz,       setIncludeQuiz]       = useState(true);
  const [includeDiagram,    setIncludeDiagram]    = useState(false);

  const lessonCount = LESSON_STEPS[lessonIdx];
  const difficulty  = DIFFICULTIES[diffIdx];

  const { isPremium } = useEntitlement();
  const existingCourses = useQuery(api.courses.listMine) ?? [];
  const hasCourse = existingCourses.length > 0;

  const createCourse     = useMutation(api.courses.create);
  const generateCourse   = useAction(api.ai.generateCourse);
  const getUploadUrl     = useMutation(api.courses.generateUploadUrl);

  const btnScale = useSharedValue(1);
  const btnAnim  = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const pickDocument = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setDocName(asset.name);
      setDocUri(asset.uri);
      if (!courseName) setCourseName(asset.name.replace(/\.pdf$/i, ''));
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open document picker', visibilityTime: 3000 });
    }
  };

  const youtubeValid = /(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/.test(youtubeUrl.trim());

  const canGenerate =
    phase === 'idle' &&
    courseName.trim().length > 0 &&
    (sourceTab === 'youtube' ? youtubeValid : true) &&
    (includeFlashcards || includeQuiz || includeDiagram);

  const toastError = (err: any) => {
    // Convex wraps server errors — extract the real message
    const raw: string = err?.data?.message ?? err?.message ?? String(err ?? '');
    let message = 'Something went wrong. Please try again.';
    if (raw.includes('transcript') || raw.includes('captions') || raw.includes('subtitles') || raw.includes('no transcript')) {
      Toast.show({ type: 'error', text1: "Can't generate this video", text2: "This video has no captions. Try a video with subtitles enabled.", visibilityTime: 5000 });
      return;
    }
    else if (raw.includes('too large') || raw.includes('5 MiB') || raw.includes('size')) message = 'PDF is too large. Please use a file under 20 MB.';
    else if (raw.includes('API key')) message = 'AI service not configured. Contact support.';
    else if (raw.includes('429') || raw.includes('quota') || raw.includes('rate limit')) message = 'AI is busy right now. Wait a moment and try again.';
    else if (raw.includes('parse') || raw.includes('JSON')) message = 'AI returned an unexpected response. Try again.';
    else if (raw.includes('PDF') || raw.includes('pdf')) message = 'Could not read the PDF. Make sure it\'s a valid text-based PDF.';
    else if (raw.includes('network') || raw.includes('fetch')) message = 'Network error. Check your connection and try again.';
    Toast.show({ type: 'error', text1: 'Failed', text2: message, visibilityTime: 5000 });
  };

  const presentPaywall = async (): Promise<boolean> => {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: 'premium',
    });
    const purchased = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    if (purchased) await Purchases.getCustomerInfo();
    return purchased;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (!isPremium && hasCourse) {
      await presentPaywall();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnScale.value = withSpring(0.96, { damping: 12, stiffness: 500 }, () => {
      btnScale.value = withSpring(1);
    });
    setPhase('uploading');
    const componentArgs = {
      includeFlashcards,
      includeQuiz,
      includeDiagram,
    };
    try {
      if (sourceTab === 'pdf') {
        if (docUri) {
          // PDF selected — upload and generate from it
          const fileInfo = await FileSystem.getInfoAsync(docUri);
          const MAX_BYTES = 20 * 1024 * 1024;
          const fileSize = (fileInfo as any).size as number | undefined;
          if (fileInfo.exists && fileSize !== undefined && fileSize > MAX_BYTES) {
            setPhase('idle');
            Toast.show({
              type: 'error',
              text1: 'PDF too large',
              text2: `Maximum file size is 20 MB. Your file is ${(fileSize / 1024 / 1024).toFixed(1)} MB.`,
              visibilityTime: 5000,
            });
            return;
          }
          const uploadUrl = await getUploadUrl();
          const uploadResponse = await FileSystem.uploadAsync(uploadUrl, docUri, {
            httpMethod: 'POST',
            mimeType: 'application/pdf',
          });
          const { storageId: pdfStorageId } = JSON.parse(uploadResponse.body);
          const courseId = await createCourse({
            title: courseName.trim(),
            description: prompt.trim(),
            docName: docName!,
            sourceType: 'pdf',
            totalLessons: lessonCount,
            difficulty: difficulty.id,
          });
          await generateCourse({ courseId, pdfStorageId, lessonCount, difficulty: difficulty.id, userPrompt: prompt.trim() || undefined, ...componentArgs });
        } else {
          // No PDF — generate from topic name alone
          const courseId = await createCourse({
            title: courseName.trim(),
            description: prompt.trim(),
            docName: courseName.trim(),
            totalLessons: lessonCount,
            difficulty: difficulty.id,
          });
          await generateCourse({ courseId, courseTopic: courseName.trim(), lessonCount, difficulty: difficulty.id, userPrompt: prompt.trim() || undefined, ...componentArgs });
        }
      } else {
        if (!courseName.trim()) setCourseName('YouTube Course');
        const courseId = await createCourse({
          title: courseName.trim() || 'YouTube Course',
          description: prompt.trim(),
          docName: youtubeUrl.trim(),
          sourceType: 'youtube',
          totalLessons: lessonCount,
          difficulty: difficulty.id,
        });
        await generateCourse({ courseId, youtubeUrl: youtubeUrl.trim(), lessonCount, difficulty: difficulty.id, userPrompt: prompt.trim() || undefined, ...componentArgs });
      }
      setPhase('done');
      setTimeout(onBack, 1600);
    } catch (err: any) {
      setPhase('idle');
      toastError(err);
    }
  };

  // ── Generating state ────────────────────────────────────────────────────────
  if (phase === 'uploading') {
    return <GeneratingView C={C} fs={fs} F={F} insetTop={insets.top} />;
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Animated.View entering={FadeInUp.duration(400)} style={S.stateScreen}>
          <Text style={{ fontSize: 72 }}>🎉</Text>
          <Text style={[S.stateTitle, { fontFamily: F.bold, fontSize: fs(24), color: C.text }]}>
            Course ready!
          </Text>
          <Text style={[S.stateSub, { fontFamily: F.regular, fontSize: fs(14), color: C.sub }]}>
            Taking you back to your courses…
          </Text>
        </Animated.View>
      </View>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>

        {/* Header */}
        <View style={[S.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onBack} style={S.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { fontFamily: F.bold, fontSize: fs(17), color: C.text }]}>
            New Course
          </Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Source tab toggle ── */}
          <Animated.View entering={FadeInDown.delay(40).duration(300)}>
            <Text style={[S.sectionLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              SOURCE
            </Text>
            <View style={[S.tabRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              {(['pdf', 'youtube'] as SourceTab[]).map((tab) => {
                const active = sourceTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[S.tabBtn, active && { backgroundColor: C.primary }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSourceTab(tab);
                      setDocUri(null); setDocName(null);
                      setYoutubeUrl('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={tab === 'pdf' ? 'document-text-outline' : 'logo-youtube'}
                      size={15}
                      color={active ? '#fff' : C.sub}
                    />
                    <Text style={[S.tabBtnTxt, { fontFamily: F.semiBold, fontSize: fs(13), color: active ? '#fff' : C.sub }]}>
                      {tab === 'pdf' ? 'PDF' : 'YouTube'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* PDF upload zone */}
            {sourceTab === 'pdf' && (
              <TouchableOpacity
                onPress={pickDocument}
                activeOpacity={0.8}
                style={[
                  S.uploadZone,
                  { marginTop: 10, borderColor: docUri ? C.primary : C.border, backgroundColor: docUri ? C.primaryBg : C.surface },
                ]}
              >
                {docUri ? (
                  <View style={S.uploadedRow}>
                    <View style={[S.uploadedIconWrap, { backgroundColor: `${C.primary}18` }]}>
                      <Ionicons name="document-text" size={26} color={C.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[S.uploadedName, { fontFamily: F.semiBold, fontSize: fs(14), color: C.text }]} numberOfLines={1}>
                        {docName}
                      </Text>
                      <Text style={[{ fontFamily: F.regular, fontSize: fs(12), color: C.primary }]}>
                        PDF · Tap to change
                      </Text>
                    </View>
                    <View style={[S.checkBadge, { backgroundColor: C.primary }]}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <View style={S.uploadEmptyContent}>
                    <View style={[S.uploadIconWrap, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                      <Ionicons name="cloud-upload-outline" size={32} color={C.muted} />
                    </View>
                    <Text style={[S.uploadTitle, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>
                      Upload a PDF (optional)
                    </Text>
                    <Text style={[S.uploadSub, { fontFamily: F.regular, fontSize: fs(13), color: C.muted }]}>
                      Tap to browse · Leave empty to generate from topic
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* YouTube URL input */}
            {sourceTab === 'youtube' && (
              <View style={{ marginTop: 10 }}>
                <View style={[S.inputCard, {
                  backgroundColor: C.surface,
                  borderColor: youtubeUrl.trim().length === 0 ? C.border : youtubeValid ? C.primary : C.error,
                }]}>
                  <View style={S.inputRow}>
                    <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                    <TextInput
                      style={[S.input, { fontFamily: F.regular, fontSize: fs(15), color: C.text, flex: 1 }]}
                      placeholder="Paste YouTube URL…"
                      placeholderTextColor={C.muted}
                      value={youtubeUrl}
                      onChangeText={setYoutubeUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                      returnKeyType="done"
                    />
                    {youtubeUrl.trim().length > 0 && (
                      <Ionicons
                        name={youtubeValid ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={youtubeValid ? C.primary : C.error}
                      />
                    )}
                  </View>
                </View>
                {youtubeUrl.trim().length > 0 && !youtubeValid && (
                  <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.error, marginTop: 4, paddingHorizontal: 2 }}>
                    Not a valid YouTube URL
                  </Text>
                )}
              </View>
            )}
          </Animated.View>

          {/* ── Course details ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ gap: 10 }}>
            <Text style={[S.sectionLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              COURSE DETAILS
            </Text>
            <View style={[S.inputCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[S.inputRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
                <Ionicons name="bookmark-outline" size={16} color={C.muted} />
                <TextInput
                  style={[S.input, { fontFamily: F.regular, fontSize: fs(15), color: C.text, flex: 1 }]}
                  placeholder="Course name"
                  placeholderTextColor={C.muted}
                  value={courseName}
                  onChangeText={setCourseName}
                  returnKeyType="next"
                  editable={phase === 'idle'}
                />
              </View>
              <View style={S.inputRow}>
                <Ionicons name="sparkles-outline" size={16} color={C.muted} />
                <TextInput
                  style={[S.input, S.promptInput, { fontFamily: F.regular, fontSize: fs(14), color: C.text, flex: 1 }]}
                  placeholder="Focus or context (optional) — e.g. exam prep, job interview…"
                  placeholderTextColor={C.muted}
                  value={prompt}
                  onChangeText={setPrompt}
                  returnKeyType="done"
                  editable={phase === 'idle'}
                  multiline
                />
              </View>
            </View>
          </Animated.View>

          {/* ── Difficulty ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(300)} style={{ gap: 10 }}>
            <Text style={[S.sectionLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              DIFFICULTY
            </Text>
            <View style={S.chipRow}>
              {DIFFICULTIES.map((d, i) => {
                const active = diffIdx === i;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      S.diffChip,
                      {
                        backgroundColor: active ? `${d.color}15` : C.surface,
                        borderColor: active ? d.color : C.border,
                        flex: 1,
                      },
                    ]}
                    onPress={() => { Haptics.selectionAsync(); setDiffIdx(i); }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={d.icon as any} size={16} color={active ? d.color : C.muted} />
                    <Text style={[S.diffChipTxt, { fontFamily: active ? F.semiBold : F.regular, fontSize: fs(13), color: active ? d.color : C.sub }]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Lesson count ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ gap: 10 }}>
            <Text style={[S.sectionLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              NUMBER OF LESSONS
            </Text>
            <View style={S.chipRow}>
              {LESSON_STEPS.map((n, i) => {
                const active = lessonIdx === i;
                const locked = !isPremium && i > 0;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      S.lessonChip,
                      {
                        backgroundColor: active ? C.primaryBg : C.surface,
                        borderColor: active ? C.primary : C.border,
                        flex: 1,
                        opacity: locked ? 0.45 : 1,
                      },
                    ]}
                    onPress={async () => {
                      if (locked) {
                        const purchased = await presentPaywall();
                        if (!purchased) return;
                      }
                      Haptics.selectionAsync();
                      setLessonIdx(i);
                    }}
                    activeOpacity={0.75}
                  >
                    {locked ? (
                      <Ionicons name="lock-closed" size={13} color={C.muted} />
                    ) : (
                      <Text style={[S.lessonChipNum, { fontFamily: F.bold, fontSize: fs(18), color: active ? C.primary : C.text }]}>
                        {n}
                      </Text>
                    )}
                    <Text style={[S.lessonChipSub, { fontFamily: F.regular, fontSize: fs(11), color: active ? C.primary : C.muted }]}>
                      {locked ? 'pro' : 'lessons'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Course components ── */}
          <Animated.View entering={FadeInDown.delay(220).duration(300)} style={{ gap: 10 }}>
            <Text style={[S.sectionLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              INCLUDE IN COURSE
            </Text>
            <View style={S.chipRow}>
              {([
                { key: 'flashcards', label: 'Flashcards', icon: 'layers-outline',       value: includeFlashcards, set: setIncludeFlashcards },
                { key: 'quiz',       label: 'Quiz',       icon: 'help-circle-outline',  value: includeQuiz,       set: setIncludeQuiz       },
                { key: 'diagram',    label: 'Diagram',    icon: 'git-branch-outline',   value: includeDiagram,    set: setIncludeDiagram    },
              ] as const).map(({ key, label, icon, value, set }) => {
                const activeCount = [includeFlashcards, includeQuiz, includeDiagram].filter(Boolean).length;
                const canToggleOff = !(value && activeCount === 1);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      S.diffChip,
                      {
                        backgroundColor: value ? `${C.primary}15` : C.surface,
                        borderColor: value ? C.primary : C.border,
                        flex: 1,
                      },
                    ]}
                    onPress={() => {
                      if (!canToggleOff) return;
                      Haptics.selectionAsync();
                      set(!value);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={icon as any} size={15} color={value ? C.primary : C.muted} />
                    <Text style={[S.diffChipTxt, { fontFamily: value ? F.semiBold : F.regular, fontSize: fs(12), color: value ? C.primary : C.sub }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Generate button ── */}
          <Animated.View entering={FadeInDown.delay(260).duration(300)} style={btnAnim}>
            <TouchableOpacity
              style={[
                S.generateBtn,
                { backgroundColor: canGenerate ? C.primary : C.surfaceAlt, borderColor: canGenerate ? C.primary : C.border },
              ]}
              onPress={handleGenerate}
              disabled={!canGenerate}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={18} color={canGenerate ? '#fff' : C.muted} />
              <Text style={[S.generateBtnTxt, { fontFamily: F.semiBold, fontSize: fs(16), color: canGenerate ? '#fff' : C.muted }]}>
                Generate Course
              </Text>
            </TouchableOpacity>
            {sourceTab === 'youtube' && !youtubeValid && !youtubeUrl.trim() && (
              <Text style={[S.generateHint, { fontFamily: F.regular, fontSize: fs(12), color: C.muted }]}>
                Paste a YouTube URL to get started
              </Text>
            )}
            {(sourceTab === 'pdf' ? !!docUri : youtubeValid) && !courseName.trim() && (
              <Text style={[S.generateHint, { fontFamily: F.regular, fontSize: fs(12), color: C.muted }]}>
                Enter a course name to continue
              </Text>
            )}
          </Animated.View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 6 },
  headerTitle: {},

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  sectionLabel: {
    letterSpacing: 1.4,
    marginBottom: 2,
  },

  // Upload zone
  uploadZone: {
    borderWidth: 1.5,
    borderRadius: 20,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadEmptyContent: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  uploadIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: {},
  uploadSub: {},
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  uploadedIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedName: {},
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Input card
  inputCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { paddingTop: 0 },
  promptInput: { minHeight: 48 },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  diffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  diffChipTxt: {},
  lessonChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 2,
  },
  lessonChipNum: {},
  lessonChipSub: {},
  proCaptionTxt: { textAlign: 'center', marginTop: 6 },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  errorTxt: {},

  // Generate button
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  generateBtnTxt: {},
  generateHint: {
    textAlign: 'center',
    marginTop: 10,
  },

  // Source tabs
  tabRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnTxt: {},

  // YouTube
  transcriptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  // States (generating / done)
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconOuter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  stateIconRing: {
    width: 84,
    height: 84,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateTitle: { textAlign: 'center' },
  stateSub: { textAlign: 'center', lineHeight: 20 },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepsCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  stepIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: { flex: 1 },
  activeDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  activeDot:  { width: 5, height: 5, borderRadius: 3 },
});
