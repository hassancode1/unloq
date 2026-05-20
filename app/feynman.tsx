import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

import { useTheme } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { Spacing } from '../constants/spacing';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Characters ────────────────────────────────────────────────────────────────

type CharacterLevel = 'super_hard' | 'hard' | 'medium' | 'easy';

interface Character {
  id: string;
  name: string;
  age: number;
  level: CharacterLevel;
  levelLabel: string;
  levelColor: string;
  image: any;
  prompt: string;
}

const CHARACTERS: Character[] = [
  { id: 'nova', name: 'Nova', age: 5,  level: 'super_hard', levelLabel: 'Super Hard', levelColor: '#EF4444', image: require('../assets/nova.png'),  prompt: "like I'm 5 years old — use very simple words, no jargon!" },
  { id: 'zara', name: 'Zara', age: 12, level: 'hard',       levelLabel: 'Hard',       levelColor: '#F97316', image: require('../assets/zara.png'),  prompt: "like I'm 12 — keep it clear, some detail is ok but stay simple" },
  { id: 'rex',  name: 'Rex',  age: 16, level: 'medium',     levelLabel: 'Medium',     levelColor: '#EAB308', image: require('../assets/Rex.png'),   prompt: "like I'm 16 — you can use moderate complexity, but explain concepts properly" },
  { id: 'kai',  name: 'Kai',  age: 22, level: 'easy',       levelLabel: 'Easy',       levelColor: '#22C55E', image: require('../assets/kai.png'),   prompt: "like I'm a college student — full depth, technical terms ok" },
];

// ── Glow Mascot ───────────────────────────────────────────────────────────────

function GlowMascot({ size = 'medium', pulseFast = false, characterImage }: {
  size?: 'small' | 'medium' | 'large'; pulseFast?: boolean; characterImage?: any;
}) {
  const imageSize = size === 'large' ? 110 : size === 'medium' ? 76 : 50;
  const r1 = imageSize / 2 + (size === 'large' ? 20 : size === 'medium' ? 14 : 10); // ring 1 radius
  const r2 = r1 + (size === 'large' ? 14 : size === 'medium' ? 10 : 7);              // ring 2 radius
  const r3 = r2 + (size === 'large' ? 12 : size === 'medium' ? 9 : 6);              // ring 3 radius
  const totalSize = (r3 + 4) * 2;
  const mascotSrc = characterImage ?? require('../assets/Fyenman-mascot.png');

  const rot1  = useSharedValue(0);   // ring 1 — clockwise
  const rot2  = useSharedValue(0);   // ring 2 — counter-clockwise
  const rot3  = useSharedValue(0);   // ring 3 — clockwise slow
  const pulse = useSharedValue(1);
  const float = useSharedValue(0);

  useEffect(() => {
    const speed = pulseFast ? 0.45 : 1;
    rot1.value  = withRepeat(withTiming(360,  { duration: 3800 * speed, easing: Easing.linear }), -1, false);
    rot2.value  = withRepeat(withTiming(-360, { duration: 5500 * speed, easing: Easing.linear }), -1, false);
    rot3.value  = withRepeat(withTiming(360,  { duration: 8000 * speed, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withSequence(
      withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      withTiming(1.00, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
    float.value = withRepeat(withSequence(
      withTiming(-7, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      withTiming(0,  { duration: 1800, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, [pulseFast]);

  const ring1Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot1.value}deg` }] }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot2.value}deg` }] }));
  const ring3Style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot3.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  const d1 = r1 * 2; const d2 = r2 * 2; const d3 = r3 * 2;

  return (
    <Animated.View style={[{ width: totalSize, height: totalSize, alignItems: 'center', justifyContent: 'center' }, floatStyle]}>

      {/* Ring 3 — outermost, slow CW, dim arcs + shine dot */}
      <Animated.View style={[{ position: 'absolute', width: d3, height: d3, borderRadius: r3, alignItems: 'center', justifyContent: 'center' }, ring3Style]}>
        <View style={{ position: 'absolute', width: d3, height: d3, borderRadius: r3,
          borderWidth: 1.5, borderTopColor: '#A78BFA55', borderRightColor: 'transparent',
          borderBottomColor: '#A78BFA44', borderLeftColor: 'transparent' }} />
        {/* Shine dot */}
        <View style={{ position: 'absolute', top: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#E9D5FF', shadowColor: '#C4B5FD', shadowRadius: 6, shadowOpacity: 1 }} />
      </Animated.View>

      {/* Ring 2 — middle, CCW, opposite arcs */}
      <Animated.View style={[{ position: 'absolute', width: d2, height: d2, borderRadius: r2, alignItems: 'center', justifyContent: 'center' }, ring2Style]}>
        <View style={{ position: 'absolute', width: d2, height: d2, borderRadius: r2,
          borderWidth: 2, borderTopColor: 'transparent', borderRightColor: '#8B5CF6BB',
          borderBottomColor: 'transparent', borderLeftColor: '#7C3AEDAA' }} />
        {/* Shine dot */}
        <View style={{ position: 'absolute', right: 1, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#DDD6FE', shadowColor: '#A78BFA', shadowRadius: 8, shadowOpacity: 1 }} />
      </Animated.View>

      {/* Ring 1 — inner, faster CW, stronger color */}
      <Animated.View style={[{ position: 'absolute', width: d1, height: d1, borderRadius: r1, alignItems: 'center', justifyContent: 'center' }, ring1Style]}>
        <View style={{ position: 'absolute', width: d1, height: d1, borderRadius: r1,
          borderWidth: 2.5, borderTopColor: '#9333EACC', borderRightColor: 'transparent',
          borderBottomColor: '#7C3AEDAA', borderLeftColor: 'transparent' }} />
        {/* Shine dot */}
        <View style={{ position: 'absolute', top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F5F3FF', shadowColor: '#9333EA', shadowRadius: 10, shadowOpacity: 1 }} />
      </Animated.View>

      {/* Purple fill + mascot image */}
      <Animated.View style={[{ width: imageSize + 8, height: imageSize + 8, borderRadius: (imageSize + 8) / 2,
        backgroundColor: '#5B21B6', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7C3AED', shadowRadius: 18, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 },
      }, pulseStyle]}>
        <Image source={mascotSrc}
          style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }}
          resizeMode="cover"
        />
      </Animated.View>

    </Animated.View>
  );
}

// ── Understanding bar ─────────────────────────────────────────────────────────

function UnderstandingBar({ score, C, F, fs }: { score: number; C: any; F: any; fs: (n: number) => number }) {
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(score / 100, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [score]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  const color = score >= 75 ? '#22C55E' : score >= 40 ? '#EAB308' : '#EF4444';

  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }}>Understanding</Text>
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(12), color }}>{score}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

// ── Note breakdown screen ─────────────────────────────────────────────────────

const BREAKDOWN_GREETINGS = [
  'Pick a topic and teach it back 🔥',
  'What do you actually know? Prove it 🧠',
  'Time to break it down ⚡',
  'Grab a topic and let\'s go 🚀',
  'Show what you know 💡',
];

function NoteBreakdownScreen({ courseId, C, F, fs, insets, isDark, onSection }: {
  courseId: string;
  C: any; F: any; fs: (n: number) => number; insets: any; isDark: boolean;
  onSection: (title: string, summary: string) => void;
}) {
  const cardBg = isDark ? '#1E1E2E' : '#F5F5F5';
  const lessons = useQuery(api.courses.getLessons, { courseId: courseId as any }) as any[] | undefined;
  const [greeting] = useState(() => BREAKDOWN_GREETINGS[Math.floor(Math.random() * BREAKDOWN_GREETINGS.length)]);

  // Flatten all sections into a single list
  const allSections: { heading: string; body: string; lessonTitle: string }[] = [];
  (lessons ?? []).forEach((lesson: any) => {
    const sections: { heading: string; body: string }[] = lesson.content ?? [];
    if (sections.length > 0) {
      sections.forEach((sec) => allSections.push({ ...sec, lessonTitle: lesson.title }));
    } else {
      allSections.push({ heading: lesson.title, body: lesson.keyConcept ?? lesson.title, lessonTitle: lesson.title });
    }
  });

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: Spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md }}>
        <GlowMascot size="medium" />
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(16), color: C.text, textAlign: 'center', marginTop: Spacing.md }}>
          {greeting}
        </Text>
      </Animated.View>

      {lessons === undefined && (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: Spacing.xl }} />
      )}

      <View style={{ gap: 10, marginTop: Spacing.sm }}>
        {allSections.map((sec, i) => (
          <Animated.View key={`${sec.heading}-${i}`} entering={FadeInDown.delay(i * 25).duration(220)}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onSection(sec.heading, sec.body); }}
              activeOpacity={0.75}
              style={[styles.sectionRow, { backgroundColor: cardBg, borderColor: C.border }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>
                  {sec.heading}
                </Text>
                {sec.body && sec.body !== sec.heading && (
                  <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }} numberOfLines={2}>
                    {sec.body}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.muted} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Topic state ───────────────────────────────────────────────────────────────

function TopicPicker({
  C, F, fs, onTopicChosen, onNoteChosen,
}: {
  C: any; F: any; fs: (n: number) => number;
  onTopicChosen: (title: string, summary: string) => void;
  onNoteChosen: (id: string, title: string) => void;
}) {
  const [text, setText]           = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const courses = useQuery(api.courses.listMine) as any[] | undefined;

  const handleFreeText = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTopicChosen(text.trim(), text.trim());
  };

  const readyCourses = (courses ?? []).filter((c: any) => c.status === 'ready');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ alignItems: 'center', paddingTop: Spacing.xl }}>
          <GlowMascot size="medium" />
          <Text style={[styles.bigTitle, { color: C.text, fontFamily: F.extraBold, fontSize: fs(26), marginTop: Spacing.lg }]}>
            What topic do you{'\n'}want to explore?
          </Text>
        </Animated.View>

        {/* From notes */}
        {readyCourses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.xl }}>
            <TouchableOpacity
              onPress={() => setShowNotes(!showNotes)}
              style={[styles.notesRow, { borderColor: C.border, backgroundColor: C.surface }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.sub }}>Or from your notes</Text>
              <Ionicons name={showNotes ? 'chevron-up' : 'chevron-forward'} size={16} color={C.muted} />
            </TouchableOpacity>

            {showNotes && (
              <Animated.View entering={FadeInDown.duration(220)}>
                {readyCourses.map((course: any, i: number) => (
                  <Animated.View key={course._id} entering={FadeInDown.delay(i * 40).duration(220)}>
                    <TouchableOpacity
                      onPress={() => { Haptics.selectionAsync(); onNoteChosen(course._id, course.title); }}
                      activeOpacity={0.7}
                      style={[styles.lessonRow, { backgroundColor: C.surface, borderColor: C.border }]}
                    >
                      <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.text, flex: 1 }} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={C.muted} />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Input bar */}
      <Animated.View entering={FadeInUp.delay(100).duration(300)} style={[styles.inputBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        <View style={[styles.inputRow, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
          <Text style={{ fontSize: 16 }}>✨</Text>
          <TextInput
            placeholder="Enter any topic…"
            placeholderTextColor={C.muted}
            value={text}
            onChangeText={setText}
            style={[styles.input, { color: C.text, fontFamily: F.regular, fontSize: fs(15) }]}
            returnKeyType="go"
            onSubmitEditing={handleFreeText}
          />
          <TouchableOpacity
            onPress={handleFreeText}
            disabled={!text.trim()}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? '#7C3AED' : C.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ── Character picker ──────────────────────────────────────────────────────────

function CharacterPicker({
  C, F, fs, isDark, onCharacterChosen,
}: {
  C: any; F: any; fs: (n: number) => number; isDark: boolean;
  onCharacterChosen: (character: Character) => void;
}) {
  const cardBg = isDark ? '#2A2A2A' : '#EBEBEB';
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xl }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md }}>
        <GlowMascot size="small" />
        <Text style={[styles.bigTitle, { color: C.text, fontFamily: F.extraBold, fontSize: fs(22), marginTop: Spacing.md, textAlign: 'center' }]}>
          Choose your crew!
        </Text>
        <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.muted, marginTop: 4 }}>
          Harder = simpler explanation required
        </Text>
      </Animated.View>

      <View style={{ paddingHorizontal: Spacing.lg, gap: 20, marginTop: Spacing.sm }}>
        {CHARACTERS.map((char, i) => (
          <Animated.View key={char.id} entering={FadeInDown.delay(80 + i * 60).duration(280)} style={{ overflow: 'visible' }}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onCharacterChosen(char); }}
              activeOpacity={0.75}
              style={[styles.charCard, { backgroundColor: cardBg, borderColor: C.border }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: F.extraBold, fontSize: fs(16), color: C.text }}>
                  {char.name} · {char.age} years old
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.levelDot, { backgroundColor: char.levelColor }]} />
                  <Text style={{ fontFamily: F.semiBold, fontSize: fs(12), color: C.sub }}>
                    Level: {char.levelLabel}
                  </Text>
                </View>
              </View>
              <Image source={char.image} style={styles.charThumb} resizeMode="contain" />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Session state ─────────────────────────────────────────────────────────────

function SessionView({
  topicTitle, topicSummary, character,
  C, F, fs, insets,
}: {
  topicTitle: string; topicSummary: string; character: Character;
  C: any; F: any; fs: (n: number) => number; insets: any;
}) {
  const { isPremium } = useEntitlement();
  const [isRecording, setIsRecording]   = useState(false);
  const [transcript,  setTranscript]    = useState('');
  const [score,       setScore]         = useState(0);
  const [feedback,    setFeedback]      = useState('');
  const [gaps,        setGaps]          = useState<string[]>([]);
  const [loading,     setLoading]       = useState(false);
  const [hasResult,   setHasResult]     = useState(false);
  const [useTextMode, setUseTextMode]   = useState(false);
  const [textInput,   setTextInput]     = useState('');

  const evaluate = useAction(api.ai.evaluateFeynmanExplanation);
  const recognitionRef = useRef<any>(null);

  const runEvaluation = useCallback(async (explanation: string) => {
    if (!explanation.trim()) return;
    setLoading(true);
    try {
      const result = await evaluate({
        topicTitle,
        topicSummary,
        userExplanation: explanation,
        characterAge: character.age,
      });
      setScore(result.score);
      setFeedback(result.feedback);
      setGaps(result.gaps);
      setHasResult(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setFeedback('Could not evaluate your explanation. Please try again.');
      setHasResult(true);
    } finally {
      setLoading(false);
    }
  }, [evaluate, topicTitle, topicSummary, character.age]);

  const startRecording = useCallback(async () => {
    try {
      const { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } = await import('expo-speech-recognition');
      setTranscript('');
      setHasResult(false);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
      recognitionRef.current = ExpoSpeechRecognitionModule;
    } catch {
      setUseTextMode(true);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    if (transcript.trim()) {
      await runEvaluation(transcript);
    }
  }, [transcript, runEvaluation]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
        const resultHandler = (e: any) => {
          const text = e.results?.[0]?.transcript ?? '';
          setTranscript(text);
          if (e.isFinal) {
            setIsRecording(false);
            if (text.trim()) runEvaluation(text);
          }
        };
        const sub = ExpoSpeechRecognitionModule.addListener?.('result', resultHandler);
        unsub = () => sub?.remove?.();
      } catch {}
    })();
    return () => unsub?.();
  }, [runEvaluation]);

  const handleMicPress = async () => {
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await RevenueCatUI.presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await Purchases.getCustomerInfo();
        startRecording();
      }
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      if (useTextMode) {
        setHasResult(false);
        setUseTextMode(true);
      } else {
        startRecording();
      }
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    setTranscript(textInput);
    runEvaluation(textInput);
    setTextInput('');
    setUseTextMode(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Understanding bar */}
        <UnderstandingBar score={score} C={C} F={F} fs={fs} />

        {/* Mascot */}
        <View style={{ alignItems: 'center', marginTop: Spacing.lg }}>
          <GlowMascot size="large" pulseFast={isRecording} characterImage={character.image} />
        </View>

        {/* Prompt */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
          <Text style={{ fontFamily: F.extraBold, fontSize: fs(21), color: C.text, textAlign: 'center', lineHeight: 30 }}>
            {hasResult
              ? `${character.name} understood ${score}%!`
              : `Explain "${topicTitle}" to ${character.name} ${character.prompt}`
            }
          </Text>
        </Animated.View>

        {/* Transcript preview */}
        {transcript.length > 0 && !hasResult && (
          <Animated.View entering={FadeInDown.duration(200)} style={[styles.transcriptBox, { backgroundColor: C.surfaceAlt, borderColor: C.border, marginHorizontal: Spacing.lg, marginTop: Spacing.md }]}>
            <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.sub, fontStyle: 'italic' }} numberOfLines={4}>
              "{transcript}"
            </Text>
          </Animated.View>
        )}

        {/* Feedback card */}
        {hasResult && feedback.length > 0 && (
          <Animated.View entering={FadeInUp.delay(100).duration(350)} style={[styles.feedbackCard, { backgroundColor: C.surface, borderColor: C.border, marginHorizontal: Spacing.lg, marginTop: Spacing.md }]}>
            <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text, marginBottom: 6 }}>Feedback</Text>
            <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.sub, lineHeight: 20 }}>{feedback}</Text>
            {gaps.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontFamily: F.bold, fontSize: fs(12), color: C.muted, marginBottom: 4 }}>Gaps to review:</Text>
                {gaps.map((g, i) => (
                  <Text key={i} style={{ fontFamily: F.regular, fontSize: fs(12), color: C.sub }}>• {g}</Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              onPress={() => { setHasResult(false); setTranscript(''); setScore(0); setFeedback(''); setGaps([]); }}
              style={[styles.tryAgainBtn, { borderColor: '#7C3AED' }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: F.bold, fontSize: fs(13), color: '#7C3AED' }}>Try again</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Text mode input */}
        {useTextMode && !hasResult && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
            <TextInput
              placeholder={`Type your explanation for ${character.name}…`}
              placeholderTextColor={C.muted}
              value={textInput}
              onChangeText={setTextInput}
              multiline
              style={[styles.textArea, { backgroundColor: C.surfaceAlt, borderColor: C.border, color: C.text, fontFamily: F.regular, fontSize: fs(14) }]}
            />
            <TouchableOpacity
              onPress={handleTextSubmit}
              disabled={!textInput.trim() || loading}
              style={[styles.submitTextBtn, { backgroundColor: textInput.trim() && !loading ? '#7C3AED' : C.border }]}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: '#fff' }}>
                {loading ? 'Evaluating…' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Mic button area */}
        {!useTextMode && !hasResult && (
          <View style={{ alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.sm }}>
            {loading ? (
              <ActivityIndicator size="large" color="#7C3AED" />
            ) : (
              <>
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.muted }}>
                  {isRecording ? 'Listening… tap to stop' : 'Press to talk'}
                </Text>
                <TouchableOpacity onPress={handleMicPress} activeOpacity={0.8} style={styles.micWrapper}>
                  <View style={[styles.micBtn, { backgroundColor: isRecording ? '#EF4444' : '#1a1a2e' }]}>
                    <Ionicons name={isRecording ? 'stop' : 'mic'} size={28} color="#fff" />
                    {!isPremium && !isRecording && (
                      <View style={styles.lockBadge}>
                        <Text style={{ fontSize: 12 }}>🔒</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {!isPremium && (
                  <Text style={{ fontFamily: F.semiBold, fontSize: fs(11), color: C.muted }}>
                    Upgrade to unlock voice sessions
                  </Text>
                )}
                {isPremium && !isRecording && (
                  <TouchableOpacity onPress={() => setUseTextMode(true)}>
                    <Text style={{ fontFamily: F.semiBold, fontSize: fs(11), color: C.muted, textDecorationLine: 'underline' }}>
                      Type instead
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Main Feynman Screen ───────────────────────────────────────────────────────

type FeynmanState = 'topic' | 'notes' | 'character' | 'session';

export default function FeynmanScreen({ onClose }: { onClose: () => void }) {
  const { C, F, fs, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState]                 = useState<FeynmanState>('topic');
  const [topicTitle, setTopicTitle]       = useState('');
  const [topicSummary, setTopicSummary]   = useState('');
  const [character, setCharacter]         = useState<Character | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; title: string } | null>(null);

  const handleTopicChosen = (title: string, summary: string) => {
    setTopicTitle(title);
    setTopicSummary(summary);
    setState('character');
  };

  const handleNoteChosen = (id: string, title: string) => {
    setSelectedCourse({ id, title });
    setState('notes');
  };

  const handleSection = (title: string, summary: string) => {
    handleTopicChosen(title, summary || title);
  };

  const handleCharacterChosen = (char: Character) => {
    setCharacter(char);
    setState('session');
  };

  const handleBack = () => {
    if (state === 'session')   { setState('character'); return; }
    if (state === 'character') { setState(selectedCourse ? 'notes' : 'topic'); return; }
    if (state === 'notes')     { setState('topic'); return; }
    onClose();
  };

  const stateTitle: Record<FeynmanState, string> = {
    topic:     'Teach it Back',
    notes:     selectedCourse?.title ?? 'Pick a Topic',
    character: 'Choose Crew',
    session:   character?.name ?? 'Session',
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(17), color: C.text }}>
          {stateTitle[state]}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {state === 'topic' && (
        <TopicPicker C={C} F={F} fs={fs} onTopicChosen={handleTopicChosen} onNoteChosen={handleNoteChosen} />
      )}
      {state === 'notes' && selectedCourse && (
        <NoteBreakdownScreen
          courseId={selectedCourse.id}
          C={C} F={F} fs={fs} insets={insets} isDark={isDark}
          onSection={handleSection}
        />
      )}
      {state === 'character' && (
        <CharacterPicker C={C} F={F} fs={fs} isDark={isDark} onCharacterChosen={handleCharacterChosen} />
      )}
      {state === 'session' && character && (
        <SessionView
          topicTitle={topicTitle}
          topicSummary={topicSummary}
          character={character}
          C={C} F={F} fs={fs} insets={insets}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  bigTitle: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    marginLeft: 8,
  },
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 18,
    paddingRight: 110,
    paddingVertical: 16,
    gap: 12,
    overflow: 'visible',
    minHeight: 80,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  charThumb: {
    position: 'absolute',
    right: 8,
    top: -22,
    width: 105,
    height: 120,
    borderRadius: 14,
  },
  transcriptBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  feedbackCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  tryAgainBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 12,
  },
  textArea: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitTextBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  micWrapper: {
    position: 'relative',
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FCD34D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
