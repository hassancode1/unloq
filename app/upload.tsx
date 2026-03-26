import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useTheme } from '../hooks/useTheme';
import type { AppColors } from '../constants/Colors';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

const LESSON_STEPS = [3, 5, 10, 15];
const DIFF_CYCLE: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const DIFF_ICON: Record<Difficulty, string> = {
  beginner:     'leaf-outline',
  intermediate: 'flame-outline',
  advanced:     'flash-outline',
};
const DIFF_LABEL: Record<Difficulty, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

type Props = { onBack: () => void };

export default function UploadScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [docName, setDocName]     = useState<string | null>(null);
  const [docUri, setDocUri]       = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [prompt, setPrompt]       = useState('');
  const [lessonIdx, setLessonIdx]   = useState(1);           // default 5 lessons
  const [lessonOpen, setLessonOpen] = useState(false);
  const [diffIdx, setDiffIdx]     = useState(1);           // default intermediate
  const [phase, setPhase]         = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');

  const lessonCount = LESSON_STEPS[lessonIdx];
  const difficulty  = DIFF_CYCLE[diffIdx];

  const createCourse   = useMutation(api.courses.create);
  const generateCourse = useAction(api.ai.generateCourse);

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
      setErrorMsg('Could not open document picker.');
    }
  };

  const selectLesson = (idx: number) => {
    Haptics.selectionAsync();
    setLessonIdx(idx);
    setLessonOpen(false);
  };

  const cycleDiff = () => {
    Haptics.selectionAsync();
    setDiffIdx((i) => (i + 1) % DIFF_CYCLE.length);
  };

  const canGenerate = !!docUri && courseName.trim().length > 0 && phase === 'idle';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('uploading');
    setErrorMsg('');
    try {
      const pdfBase64 = await FileSystem.readAsStringAsync(docUri!, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const courseId = await createCourse({
        title: courseName.trim(),
        description: prompt.trim(),
        docName: docName!,
        totalLessons: lessonCount,
        difficulty,
      });
      await generateCourse({ courseId, pdfBase64, lessonCount, difficulty });
      setPhase('done');
      setTimeout(onBack, 1400);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
    }
  };

  const isGenerating = phase === 'uploading';
  const isDone       = phase === 'done';
  const isError      = phase === 'error';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* ── Back button ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero ── */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
          {isGenerating ? (
            <>
              <ActivityIndicator size="large" color={C.primary} style={{ marginBottom: 20 }} />
              <Text style={[styles.heroTitle, { fontFamily: F.bold, fontSize: fs(22), color: C.text }]}>
                Building your course…
              </Text>
              <Text style={[styles.heroSub, { fontFamily: F.regular, fontSize: fs(14), color: C.sub }]}>
                AI is generating flashcards and quizzes. This takes about 20 seconds.
              </Text>
            </>
          ) : isDone ? (
            <>
              <Text style={{ fontSize: 54, marginBottom: 16 }}>🎉</Text>
              <Text style={[styles.heroTitle, { fontFamily: F.bold, fontSize: fs(22), color: C.text }]}>
                Course created!
              </Text>
              <Text style={[styles.heroSub, { fontFamily: F.regular, fontSize: fs(14), color: C.sub }]}>
                Taking you back to your courses…
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.heroIcon, { backgroundColor: C.primaryBg, borderColor: C.primaryRing }]}>
                <Text style={{ fontSize: 42 }}>🎓</Text>
              </View>
              <Text style={[styles.heroTitle, { fontFamily: F.bold, fontSize: fs(22), color: C.text }]}>
                Got something you want{'\n'}to learn? Let's dive in!
              </Text>
              <Text style={[styles.heroSub, { fontFamily: F.regular, fontSize: fs(14), color: C.sub }]}>
                Upload a PDF and get a tailored course{'\n'}with flashcards and quizzes.
              </Text>
            </>
          )}
        </Animated.View>

        {/* ── Composer card ── */}
        {!isGenerating && !isDone && (
          <Animated.View
            entering={FadeInUp.duration(340).springify()}
            style={[styles.card, { paddingBottom: insets.bottom + 12 }]}
          >
            {/* Row 1: Add file + lesson count */}
            <View style={styles.cardTopRow}>
              <TouchableOpacity style={styles.addFileBtn} onPress={pickDocument} activeOpacity={0.7}>
                <Ionicons
                  name={docName ? 'document-text' : 'attach-outline'}
                  size={17}
                  color={docName ? C.primary : C.sub}
                />
                <Text
                  style={[styles.addFileTxt, { fontFamily: F.medium, fontSize: fs(13), color: docName ? C.primary : C.sub }]}
                  numberOfLines={1}
                >
                  {docName ?? 'Add file'}
                </Text>
              </TouchableOpacity>

              <View>
                <TouchableOpacity
                  style={[styles.lessonPicker, lessonOpen && { borderColor: C.primary, backgroundColor: C.primaryBg }]}
                  onPress={() => setLessonOpen((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={15} color={lessonOpen ? C.primary : C.sub} />
                  <Text style={[styles.lessonPickerTxt, { fontFamily: F.medium, fontSize: fs(13), color: lessonOpen ? C.primary : C.sub }]}>
                    {lessonCount} lessons
                  </Text>
                  <Ionicons name={lessonOpen ? 'chevron-up' : 'chevron-down'} size={13} color={lessonOpen ? C.primary : C.muted} />
                </TouchableOpacity>

                {lessonOpen && (
                  <View style={[styles.dropdown, { backgroundColor: C.surface, borderColor: C.border }]}>
                    {LESSON_STEPS.map((n, idx) => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.dropdownItem,
                          idx < LESSON_STEPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                          lessonIdx === idx && { backgroundColor: C.primaryBg },
                        ]}
                        onPress={() => selectLesson(idx)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownTxt, { fontFamily: lessonIdx === idx ? F.semiBold : F.regular, fontSize: fs(13), color: lessonIdx === idx ? C.primary : C.text }]}>
                          {n} lessons
                        </Text>
                        {lessonIdx === idx && <Ionicons name="checkmark" size={14} color={C.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: C.border }]} />

            {/* Course name input */}
            <TextInput
              style={[styles.nameInput, { fontFamily: F.regular, fontSize: fs(15), color: C.text }]}
              placeholder="Enter course name"
              placeholderTextColor={C.muted}
              value={courseName}
              onChangeText={setCourseName}
              returnKeyType="next"
              editable={phase === 'idle'}
            />

            {/* Prompt input */}
            <View style={styles.promptRow}>
              <Ionicons name="flash-outline" size={15} color={C.muted} style={{ marginTop: 1 }} />
              <TextInput
                style={[styles.promptInput, { fontFamily: F.regular, fontSize: fs(14), color: C.text }]}
                placeholder="Add prompt (optional)"
                placeholderTextColor={C.muted}
                value={prompt}
                onChangeText={setPrompt}
                returnKeyType="done"
                editable={phase === 'idle'}
                multiline
              />
            </View>

            {/* Error message */}
            {isError && (
              <View style={[styles.errorRow, { backgroundColor: C.errorBg }]}>
                <Ionicons name="warning-outline" size={14} color={C.error} />
                <Text style={[styles.errorTxt, { fontFamily: F.regular, fontSize: fs(12), color: C.error, flex: 1 }]}>
                  {errorMsg}
                </Text>
                <TouchableOpacity onPress={() => setPhase('idle')}>
                  <Text style={[{ fontFamily: F.semiBold, fontSize: fs(12), color: C.primary }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.cardDivider, { backgroundColor: C.border }]} />

            {/* Bottom row: difficulty + send */}
            <View style={styles.cardBottomRow}>
              <TouchableOpacity style={[styles.diffBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]} onPress={cycleDiff} activeOpacity={0.7}>
                <Ionicons name={DIFF_ICON[difficulty] as any} size={15} color={C.primary} />
                <Text style={[styles.diffTxt, { fontFamily: F.medium, fontSize: fs(12), color: C.primary }]}>
                  {DIFF_LABEL[difficulty]}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: canGenerate ? C.primary : C.border }]}
                onPress={handleGenerate}
                disabled={!canGenerate}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    header: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    backBtn: { padding: 6, alignSelf: 'flex-start' },

    // Hero
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 14,
    },
    heroIcon: {
      width: 96,
      height: 96,
      borderRadius: 28,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    heroTitle: {
      textAlign: 'center',
      lineHeight: 30,
    },
    heroSub: {
      textAlign: 'center',
      lineHeight: 22,
      color: C.sub,
    },

    // Composer card
    card: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingTop: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 8,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    addFileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      paddingRight: 12,
    },
    addFileTxt: { flex: 1 },
    lessonPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: C.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    lessonPickerTxt: {},
    dropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 4,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      minWidth: 130,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
      zIndex: 100,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    dropdownTxt: {},

    cardDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

    nameInput: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 48,
    },

    promptRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    promptInput: { flex: 1, minHeight: 36, paddingTop: 0 },

    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 10,
      borderRadius: 10,
    },
    errorTxt: {},

    cardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
    },
    diffBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
    },
    diffTxt: {},
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
