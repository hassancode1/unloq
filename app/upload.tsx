import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
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
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import Toast from 'react-native-toast-message';

const DEFAULT_LESSON_COUNT = 7;
const DEFAULT_DIFFICULTY   = 'intermediate' as const;

type SourceType = 'pdf' | 'youtube' | 'text' | 'capture';
type Props = { onBack: () => void; onGoToLibrary?: () => void; initialSourceTab?: SourceType; onGenerated?: (courseId: string) => void };

// ── Generation screen ─────────────────────────────────────────────────────────

const GEN_STEPS = [
  { label: 'Reading your content',  ms: 0     },
  { label: 'Structuring notes',     ms: 5000  },
  { label: 'Writing flashcards',    ms: 11000 },
  { label: 'Polishing output',      ms: 17000 },
  { label: 'Note ready',            ms: 22000 },
];

function GeneratingView({ onBack, onGoToLibrary }: { onBack: () => void; onGoToLibrary?: () => void }) {
  const { C, fs, F } = useTheme();
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pulse = useSharedValue(1);
  const barW  = useSharedValue(0);
  const d1 = useSharedValue(0), d2 = useSharedValue(0), d3 = useSharedValue(0);

  const dotAnim = (sv: typeof d1, delay: number) => {
    sv.value = withDelay(delay, withRepeat(
      withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })), -1,
    ));
  };

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
    barW.value  = withTiming(0.88, { duration: 24000, easing: Easing.out(Easing.quad) });
    dotAnim(d1, 0); dotAnim(d2, 200); dotAnim(d3, 400);

    GEN_STEPS.forEach((step, i) => {
      if (i === 0) return;
      const t = setTimeout(() => {
        setDoneSteps(p => [...p, i - 1]);
        setActiveStep(i);
        if (i === GEN_STEPS.length - 1) {
          setTimeout(() => { setDoneSteps(p => [...p, i]); setAllDone(true); }, 1800);
        }
      }, step.ms);
      timers.current.push(t);
    });
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 0.08 + (pulse.value - 1) * 0.4 }));
  const barStyle   = useAnimatedStyle(() => ({ width: `${barW.value * 100}%` as any }));
  const dotS = (sv: typeof d1) => useAnimatedStyle(() => ({
    opacity: interpolate(sv.value, [0, 1], [0.2, 1]),
    transform: [{ translateY: interpolate(sv.value, [0, 1], [0, -4]) }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 }}>
        <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <Animated.View style={[{ position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary }, pulseStyle]} />
          <View style={{ width: 72, height: 72, borderRadius: 22, borderWidth: 1, borderColor: C.primaryRing, backgroundColor: C.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="document-text" size={28} color={C.primary} />
          </View>
        </View>

        <Text style={{ fontSize: fs(22), fontFamily: F.extraBold, color: C.text, textAlign: 'center' }}>Building your note…</Text>
        <Text style={{ fontSize: fs(14), fontFamily: F.regular, color: C.sub, textAlign: 'center', lineHeight: 20 }}>Hang tight — AI is working its magic.</Text>

        <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: C.surfaceAlt, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: 2, backgroundColor: C.primary }, barStyle]} />
        </View>

        <View style={{ width: '100%', borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden' }}>
          {GEN_STEPS.map((step, i) => {
            const isDone   = doneSteps.includes(i);
            const isActive = activeStep === i;
            return (
              <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 }, i < GEN_STEPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
                <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDone ? C.primaryBg : isActive ? `${C.primary}12` : C.surfaceAlt, borderColor: isDone ? `${C.primary}60` : isActive ? `${C.primary}40` : C.border }}>
                  {isDone
                    ? <Ionicons name="checkmark" size={13} color={C.primary} />
                    : <Ionicons name="ellipse" size={6} color={isActive ? C.primary : C.muted} />}
                </View>
                <Text style={{ flex: 1, fontSize: fs(13), fontFamily: F.semiBold, color: isDone ? C.primary : isActive ? C.text : C.muted }}>
                  {step.label}
                </Text>
                {isActive && (
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary }, dotS(d1)]} />
                    <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary }, dotS(d2)]} />
                    <Animated.View style={[{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary }, dotS(d3)]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {allDone && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ width: '100%' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 14, backgroundColor: C.text }}
              onPress={onGoToLibrary ?? onBack}
              activeOpacity={0.85}
            >
              <Ionicons name="library-outline" size={18} color={C.bg} />
              <Text style={{ fontSize: fs(16), fontFamily: F.bold, color: C.bg }}>Go to My Library</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function UploadScreen({ onBack, onGoToLibrary, initialSourceTab, onGenerated }: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();

  const source = initialSourceTab ?? 'pdf';
  const [docName, setDocName]   = useState<string | null>(null);
  const [docUri, setDocUri]     = useState<string | null>(null);
  const [noteName, setNoteName] = useState('');
  const [context, setContext]   = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [captureUri, setCaptureUri]     = useState<string | null>(null);
  const [captureBase64, setCaptureBase64] = useState<string | null>(null);
  const [phase, setPhase]       = useState<'idle' | 'uploading' | 'done'>('idle');

  const createCourse   = useMutation(api.courses.create);
  const generateCourse = useAction(api.ai.generateCourse);
  const getUploadUrl   = useMutation(api.courses.generateUploadUrl);

  const youtubeValid = /(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/.test(youtubeUrl.trim());

  const canGenerate = phase === 'idle' && (
    (source === 'pdf' && !!docUri) ||
    (source === 'youtube' && youtubeValid) ||
    (source === 'text' && customText.trim().length > 10) ||
    (source === 'capture' && !!captureBase64)
  );

  const headerTitle =
    source === 'pdf' ? 'Generate from PDF' :
    source === 'text' ? 'Generate from Text' :
    source === 'capture' ? 'Capture Text or Image' :
    'Generate from YouTube';

  const pickCapture = async (mode: 'camera' | 'library') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      let result: ImagePicker.ImagePickerResult;
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
        allowsEditing: false,
      };
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Toast.show({ type: 'error', text1: 'Camera permission denied', visibilityTime: 3000 }); return; }
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Toast.show({ type: 'error', text1: 'Photo library permission denied', visibilityTime: 3000 }); return; }
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      setCaptureUri(asset.uri);
      setCaptureBase64(asset.base64 ?? null);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open image picker', visibilityTime: 3000 });
    }
  };

  const pickDocument = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setDocName(asset.name);
      setDocUri(asset.uri);
      if (!noteName) setNoteName(asset.name.replace(/\.pdf$/i, ''));
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open document picker', visibilityTime: 3000 });
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('uploading');

    try {
      let pdfStorageId: string | undefined;
      const autoTitle = noteName.trim() || (
        source === 'pdf' ? (docName?.replace(/\.pdf$/i, '') ?? 'My Note') :
        source === 'text' ? customText.trim().slice(0, 40) :
        source === 'capture' ? 'Captured Note' :
        'YouTube Note'
      );

      if (source === 'pdf' && docUri) {
        const info = await FileSystem.getInfoAsync(docUri);
        const size = (info as any).size as number | undefined;
        if (size && size > 20 * 1024 * 1024) {
          setPhase('idle');
          Toast.show({ type: 'error', text1: 'PDF too large', text2: 'Max 20 MB', visibilityTime: 4000 });
          return;
        }
        const uploadUrl = await getUploadUrl();
        const res = await FileSystem.uploadAsync(uploadUrl, docUri, { httpMethod: 'POST', mimeType: 'application/pdf' });
        const { storageId } = JSON.parse(res.body);
        pdfStorageId = storageId;
      }

      const courseId = await createCourse({
        title: autoTitle,
        description: context.trim(),
        docName: docName ?? autoTitle,
        sourceType: source === 'pdf' ? 'pdf' : source === 'youtube' ? 'youtube' : undefined,
        totalLessons: DEFAULT_LESSON_COUNT,
        difficulty: DEFAULT_DIFFICULTY,
        pdfStorageId: pdfStorageId as any,
      });

      await generateCourse({
        courseId,
        pdfStorageId: pdfStorageId as any,
        imageBase64: source === 'capture' ? (captureBase64 ?? undefined) : undefined,
        youtubeUrl: source === 'youtube' ? youtubeUrl.trim() : undefined,
        courseTopic: source === 'text' ? customText.trim() : undefined,
        lessonCount: DEFAULT_LESSON_COUNT,
        difficulty: DEFAULT_DIFFICULTY,
        userPrompt: context.trim() || undefined,
        includeFlashcards: true,
        includeQuiz: false,
        includeDiagram: false,
      });

      if (onGenerated) {
        onGenerated(courseId as string);
      } else {
        setPhase('done');
      }
    } catch (err: any) {
      setPhase('idle');
      const msg = err?.data?.message ?? err?.message ?? '';
      if (msg.includes('PDF_TOO_LONG') || msg.includes('page limit')) {
        Toast.show({ type: 'error', text1: 'PDF too long', text2: 'Max 1000 pages. Upload a specific chapter or section.', visibilityTime: 6000 });
      } else if (msg.includes('transcript') || msg.includes('captions')) {
        Toast.show({ type: 'error', text1: "Can't process this video", text2: 'No captions found. Try a video with subtitles.', visibilityTime: 5000 });
      } else {
        Toast.show({ type: 'error', text1: 'Generation failed', text2: msg || 'Check your connection and try again.', visibilityTime: 6000 });
      }
    }
  };

  if (phase === 'uploading' || phase === 'done') {
    return <GeneratingView onBack={onBack} onGoToLibrary={onGoToLibrary} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, paddingTop: insets.top }}>

        {/* Header */}
        <View style={[S.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity style={S.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[S.headerTitle, { color: C.text, fontFamily: F.bold }]}>{headerTitle}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: insets.bottom + 120, gap: Spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Capture source ── */}
          {source === 'capture' && (
            <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 12 }}>
              {captureUri ? (
                <TouchableOpacity onPress={() => pickCapture('library')} activeOpacity={0.85}>
                  <View style={[{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }]}>
                    <Image source={{ uri: captureUri }} style={{ width: '100%', height: 240 }} resizeMode="cover" />
                    <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: '#fff', fontFamily: F.semiBold, fontSize: fs(12) }}>Tap to change</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => pickCapture('camera')}
                    activeOpacity={0.82}
                    style={[{ backgroundColor: C.surface, borderColor: C.borderStrong, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20, paddingVertical: 36, alignItems: 'center', gap: 10 }]}
                  >
                    <View style={[{ width: 60, height: 60, borderRadius: 18, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="camera" size={28} color={C.text} />
                    </View>
                    <Text style={{ fontFamily: F.extraBold, fontSize: fs(16), color: C.text }}>Take a Photo</Text>
                    <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }}>Point at notes, a textbook, or any text</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => pickCapture('library')}
                    activeOpacity={0.82}
                    style={[{ backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }]}
                  >
                    <View style={[{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="images-outline" size={20} color={C.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.semiBold, fontSize: fs(14), color: C.text }}>Choose from Library</Text>
                      <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }}>Select an existing photo or screenshot</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── PDF source ── */}
          {source === 'pdf' && (
            <Animated.View entering={FadeInDown.duration(280)}>
              <TouchableOpacity onPress={pickDocument} activeOpacity={0.82}>
                {docUri ? (
                  <View style={[S.pdfFilled, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={[S.pdfFilledIcon, { backgroundColor: `${C.success}14` }]}>
                      <Ionicons name="document-text" size={26} color={C.success} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>{docName}</Text>
                      <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }}>Tap to change file</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color={C.success} />
                  </View>
                ) : (
                  <View style={[S.pdfEmpty, { backgroundColor: C.surface, borderColor: C.borderStrong }]}>
                    <View style={[S.pdfIconCircle, { backgroundColor: C.surfaceAlt }]}>
                      <Ionicons name="cloud-upload-outline" size={32} color={C.text} />
                    </View>
                    <Text style={{ fontFamily: F.extraBold, fontSize: fs(19), color: C.text }}>Upload your PDF</Text>
                    <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: 18 }}>
                      Tap to browse your files{'\n'}PDF format · max 20 MB
                    </Text>
                    <View style={[S.chooseBtn, { backgroundColor: C.text }]}>
                      <Text style={{ fontFamily: F.bold, fontSize: fs(13), color: C.bg }}>Choose file</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Text source ── */}
          {source === 'text' && (
            <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 10 }}>
              <View style={[S.textAreaCard, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                <TextInput
                  style={[S.textArea, { fontFamily: F.regular, fontSize: fs(15), color: C.text }]}
                  placeholder="Type or paste your text here..."
                  placeholderTextColor={C.muted}
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              </View>
            </Animated.View>
          )}

          {/* ── YouTube source ── */}
          {source === 'youtube' && (
            <Animated.View entering={FadeInDown.duration(280)} style={{ gap: Spacing.md }}>
              <Text style={{ fontFamily: F.extraBold, fontSize: fs(15), color: C.text }}>Paste your YouTube link</Text>
              <View style={[S.urlCard, { backgroundColor: C.surface, borderColor: youtubeUrl.trim() ? (youtubeValid ? C.success : '#EF4444') : C.border }]}>
                <View style={[S.ytIconBox, { backgroundColor: '#EF444415' }]}>
                  <Ionicons name="logo-youtube" size={16} color="#EF4444" />
                </View>
                <TextInput
                  style={{ flex: 1, fontFamily: F.regular, fontSize: fs(14), color: C.text, paddingTop: 0 }}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={C.muted}
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="done"
                  autoFocus
                />
                {youtubeUrl.trim().length > 0 && (
                  <Ionicons name={youtubeValid ? 'checkmark-circle' : 'close-circle'} size={18} color={youtubeValid ? C.success : '#EF4444'} />
                )}
              </View>
              {youtubeValid && (
                <Animated.View entering={FadeInDown.duration(200)} style={[S.ytPreview, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                  <Ionicons name="play-circle-outline" size={20} color={C.text} />
                  <Text style={{ flex: 1, fontFamily: F.semiBold, fontSize: fs(13), color: C.text }}>Valid YouTube link detected</Text>
                  <Ionicons name="checkmark" size={16} color={C.success} />
                </Animated.View>
              )}
            </Animated.View>
          )}

        </ScrollView>

        {/* ── Floating generate button ── */}
        <View style={[S.btnBar, { paddingBottom: insets.bottom + 12, backgroundColor: C.bg, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[S.generateBtn, { backgroundColor: canGenerate ? C.text : C.borderStrong }]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.88}
          >
            <Ionicons name="sparkles" size={18} color={canGenerate ? C.bg : C.muted} />
            <Text style={[S.generateBtnTxt, { fontFamily: F.bold, color: canGenerate ? C.bg : C.muted }]}>
              Generate Note
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 17 },

  // PDF empty state
  pdfEmpty: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20,
    paddingVertical: 44, paddingHorizontal: 24,
    alignItems: 'center', gap: 12,
  },
  pdfIconCircle: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  chooseBtn: {
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9, marginTop: 4,
  },
  // PDF filled state
  pdfFilled: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  pdfFilledIcon: {
    width: 48, height: 48, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },

  textAreaCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  textArea:    { minHeight: 260, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  urlCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  ytIconBox: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  ytPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },

  btnBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 16,
  },
  generateBtnTxt: { fontSize: 17 },
});
