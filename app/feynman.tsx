import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
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

// ── Orbit dots helper ─────────────────────────────────────────────────────────

function orbitDots(angles: number[], radius: number, baseDot: number, brightIdx: number[]) {
  return angles.map((deg, i) => {
    const θ = (deg - 90) * (Math.PI / 180);
    const isBright = brightIdx.includes(i);
    const s = isBright ? baseDot + 2 : baseDot;
    return (
      <View key={i} style={{
        position: 'absolute',
        width: s, height: s, borderRadius: s / 2,
        backgroundColor: isBright ? '#EDE9FE' : '#A78BFA',
        opacity: isBright ? 1 : 0.55,
        left: radius + radius * Math.cos(θ) - s / 2,
        top:  radius + radius * Math.sin(θ) - s / 2,
        shadowColor: '#C4B5FD',
        shadowRadius: isBright ? 6 : 2,
        shadowOpacity: 1,
      }} />
    );
  });
}

// ── Glow Mascot ───────────────────────────────────────────────────────────────

function GlowMascot({ size = 'medium', pulseFast = false, characterImage }: {
  size?: 'small' | 'medium' | 'large'; pulseFast?: boolean; characterImage?: any;
}) {
  const imageSize = size === 'large' ? 110 : size === 'medium' ? 76 : 50;
  const r1 = imageSize / 2 + (size === 'large' ? 20 : size === 'medium' ? 14 : 10);
  const r2 = r1 + (size === 'large' ? 14 : size === 'medium' ? 10 : 7);
  const r3 = r2 + (size === 'large' ? 12 : size === 'medium' ? 9 : 6);
  const totalSize = (r3 + 14) * 2;
  const mascotSrc = characterImage ?? require('../assets/Fyenman-mascot.png');

  const rot1     = useSharedValue(0);
  const rot2     = useSharedValue(0);
  const rot3     = useSharedValue(0);
  const pulse    = useSharedValue(1);
  const float    = useSharedValue(0);
  const glowAnim = useSharedValue(0);

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
    glowAnim.value = withRepeat(withSequence(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, [pulseFast]);

  const ring1Style    = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot1.value}deg` }] }));
  const ring2Style    = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot2.value}deg` }] }));
  const ring3Style    = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot3.value}deg` }] }));
  const pulseStyle    = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const floatStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const outerHaze     = useAnimatedStyle(() => ({ opacity: interpolate(glowAnim.value, [0, 1], [0.04, 0.13]) }));
  const innerHaze     = useAnimatedStyle(() => ({ opacity: interpolate(glowAnim.value, [0, 1], [0.10, 0.26]) }));

  const d1 = r1 * 2; const d2 = r2 * 2; const d3 = r3 * 2;

  return (
    <Animated.View style={[{ width: totalSize, height: totalSize, alignItems: 'center', justifyContent: 'center' }, floatStyle]}>

      {/* Ambient halos — pulsing radial glow layers */}
      <Animated.View style={[{ position: 'absolute', width: d3 + 36, height: d3 + 36, borderRadius: (d3 + 36) / 2, backgroundColor: '#3B0764' }, outerHaze]} />
      <Animated.View style={[{ position: 'absolute', width: d1 + 28, height: d1 + 28, borderRadius: (d1 + 28) / 2, backgroundColor: '#7C3AED' }, innerHaze]} />

      {/* Ring 3 — outermost, slow CW, constellation dots */}
      <Animated.View style={[{ position: 'absolute', width: d3, height: d3, borderRadius: r3, alignItems: 'center', justifyContent: 'center' }, ring3Style]}>
        <View style={{ position: 'absolute', width: d3, height: d3, borderRadius: r3,
          borderWidth: 1, borderTopColor: '#A78BFA55', borderRightColor: '#A78BFA18',
          borderBottomColor: '#A78BFA44', borderLeftColor: 'transparent' }} />
        {orbitDots([20, 115, 215, 310], r3, size === 'large' ? 3 : 2, [0, 2])}
      </Animated.View>

      {/* Ring 2 — middle, CCW, constellation dots */}
      <Animated.View style={[{ position: 'absolute', width: d2, height: d2, borderRadius: r2, alignItems: 'center', justifyContent: 'center' }, ring2Style]}>
        <View style={{ position: 'absolute', width: d2, height: d2, borderRadius: r2,
          borderWidth: 1.5, borderTopColor: 'transparent', borderRightColor: '#8B5CF6BB',
          borderBottomColor: '#8B5CF630', borderLeftColor: '#7C3AEDAA' }} />
        {orbitDots([50, 145, 235, 330], r2, size === 'large' ? 4 : 3, [1, 3])}
      </Animated.View>

      {/* Ring 1 — inner, faster CW, constellation dots */}
      <Animated.View style={[{ position: 'absolute', width: d1, height: d1, borderRadius: r1, alignItems: 'center', justifyContent: 'center' }, ring1Style]}>
        <View style={{ position: 'absolute', width: d1, height: d1, borderRadius: r1,
          borderWidth: 2, borderTopColor: '#9333EACC', borderRightColor: 'transparent',
          borderBottomColor: '#7C3AEDAA', borderLeftColor: '#9333EA44' }} />
        {orbitDots([0, 130, 260], r1, size === 'large' ? 5 : 4, [0])}
      </Animated.View>

      {/* Deep dark core + mascot */}
      <Animated.View style={[{
        width: imageSize + 12, height: imageSize + 12,
        borderRadius: (imageSize + 12) / 2,
        backgroundColor: '#0D0B1E',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowRadius: 24, shadowOpacity: 0.9,
        shadowOffset: { width: 0, height: 0 },
      }, pulseStyle]}>
        <View style={{
          position: 'absolute',
          width: imageSize + 6, height: imageSize + 6,
          borderRadius: (imageSize + 6) / 2,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#7C3AED88',
        }} />
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
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontFamily: F.semiBold, fontSize: fs(14), color: C.muted }}>Understanding</Text>
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(14), color }}>{score}%</Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: C.border, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

// ── Note breakdown screen ─────────────────────────────────────────────────────

function NoteBreakdownScreen({ courseTitle, feynmanTopics, C, F, fs, insets, isDark, onSection }: {
  courseTitle: string;
  feynmanTopics: { title: string; summary: string }[];
  C: any; F: any; fs: (n: number) => number; insets: any; isDark: boolean;
  onSection: (title: string, summary: string) => void;
}) {
  const cardBg = isDark ? '#1E1E2E' : '#F5F5F5';

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: Spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.md }}>
        <GlowMascot size="medium" />
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(16), color: C.text, textAlign: 'center', marginTop: Spacing.md }}>
          Pick a concept to teach
        </Text>
        <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted, marginTop: 4, textAlign: 'center' }}>
          {courseTitle}
        </Text>
      </Animated.View>

      {feynmanTopics.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={{ alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg, gap: Spacing.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bulb-outline" size={26} color="#7C3AED" />
          </View>
          <Text style={{ fontFamily: F.extraBold, fontSize: fs(16), color: C.text, textAlign: 'center' }}>
            No Feynman topics yet
          </Text>
          <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.muted, textAlign: 'center', lineHeight: 20 }}>
            This note was created before topic analysis. Delete and re-upload it to get 7–8 AI-curated concepts.
          </Text>
        </Animated.View>
      ) : (
        <View style={{ gap: 10, marginTop: Spacing.sm }}>
          {feynmanTopics.map((topic, i) => (
            <Animated.View key={`${topic.title}-${i}`} entering={FadeInDown.delay(i * 30).duration(220)}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onSection(topic.title, topic.summary); }}
                activeOpacity={0.75}
                style={[styles.sectionRow, { backgroundColor: cardBg, borderColor: C.border }]}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>
                    {topic.title}
                  </Text>
                  <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }} numberOfLines={2}>
                    {topic.summary}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.muted} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Topic state ───────────────────────────────────────────────────────────────

function TopicPicker({
  C, F, fs, onTopicChosen, onOpenLibrary,
}: {
  C: any; F: any; fs: (n: number) => number;
  onTopicChosen: (title: string, summary: string) => void;
  onOpenLibrary: () => void;
}) {
  const [text, setText] = useState('');
  const courses = useQuery(api.courses.listMine) as any[] | undefined;
  const hasReadyCourses = (courses ?? []).some((c: any) => c.status === 'ready');

  const handleFreeText = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTopicChosen(text.trim(), text.trim());
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ alignItems: 'center', paddingTop: Spacing.xl }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <View pointerEvents="none" style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#5B21B6', opacity: 0.09 }} />
            <GlowMascot size="large" />
          </View>
          <Text style={[styles.bigTitle, { color: C.text, fontFamily: F.extraBold, fontSize: fs(26), marginTop: Spacing.lg }]}>
            What topic do you{'\n'}want to explore?
          </Text>
          <Text style={{ fontFamily: F.semiBold, fontSize: fs(12), color: C.muted, marginTop: 6, textAlign: 'center' }}>
            Explain it simply. Understand it deeply.
          </Text>
        </Animated.View>

        {hasReadyCourses && (
          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.xl }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenLibrary(); }}
              style={[styles.notesRow, { borderColor: C.border, backgroundColor: C.surface }]}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="library-outline" size={16} color="#7C3AED" />
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.sub }}>From your notes</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={C.muted} />
            </TouchableOpacity>
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
  const runEvaluationRef  = useRef<((explanation: string) => Promise<void>) | null>(null);
  const transcriptRef     = useRef('');
  const hasEvaluatedRef   = useRef(false);

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

  useEffect(() => { runEvaluationRef.current = runEvaluation; }, [runEvaluation]);

  // Update transcript in real-time; isFinal just updates the button state
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
    if (e.isFinal) setIsRecording(false);
  });

  // end always fires when the session closes — use it as the sole eval trigger
  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
    if (!hasEvaluatedRef.current && transcriptRef.current.trim()) {
      hasEvaluatedRef.current = true;
      runEvaluationRef.current?.(transcriptRef.current);
    }
  });

  const startRecording = useCallback(async () => {
    try {
      transcriptRef.current   = '';
      hasEvaluatedRef.current = false;
      setTranscript('');
      setHasResult(false);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
    } catch (err) {
      console.warn('[Feynman] startRecording failed:', err);
      setUseTextMode(true);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ExpoSpeechRecognitionModule.stop(); // fires 'end', which triggers evaluation
  }, []);

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
type SelectedCourse = { id: string; title: string; feynmanTopics: { title: string; summary: string }[] };

export default function FeynmanScreen({
  onClose, onOpenLibrary, initialCourse,
}: {
  onClose: () => void;
  onOpenLibrary: () => void;
  initialCourse?: SelectedCourse;
}) {
  const { C, F, fs, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState]                   = useState<FeynmanState>(initialCourse ? 'notes' : 'topic');
  const [topicTitle, setTopicTitle]         = useState('');
  const [topicSummary, setTopicSummary]     = useState('');
  const [character, setCharacter]           = useState<Character | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<SelectedCourse | null>(initialCourse ?? null);

  const handleTopicChosen = (title: string, summary: string) => {
    setTopicTitle(title);
    setTopicSummary(summary);
    setState('character');
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
    if (state === 'notes')     { setState('topic'); setSelectedCourse(null); return; }
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
       
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {state === 'topic' && (
        <TopicPicker C={C} F={F} fs={fs} onTopicChosen={handleTopicChosen} onOpenLibrary={onOpenLibrary} />
      )}
      {state === 'notes' && selectedCourse && (
        <NoteBreakdownScreen
          courseTitle={selectedCourse.title}
          feynmanTopics={selectedCourse.feynmanTopics}
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
    borderRadius: 14,
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
    paddingBottom: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
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
