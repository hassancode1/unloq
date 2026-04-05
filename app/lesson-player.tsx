import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';

const GREEN      = '#16A34A';
const PRIMARY_DEEP = '#4338CA'; // shadow for DuoButton

type ScreenView = 'list' | 'article' | 'flashcards' | 'quiz';
type Props = { courseId: Id<'courses'>; onBack: () => void };

// ── Duo-style button ──────────────────────────────────────────────────────────

function DuoButton({
  label, onPress, color, shadowColor = PRIMARY_DEEP, disabled = false, icon,
}: {
  label: string; onPress: () => void; color: string;
  shadowColor?: string; disabled?: boolean; icon?: React.ReactNode;
}) {
  const ty = useRef(new Animated.Value(0)).current;
  const pressIn  = () => Animated.timing(ty, { toValue: 4,  duration: 80, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(ty, { toValue: 0,  duration: 80, useNativeDriver: true }).start();

  return (
    <View style={{ opacity: disabled ? 0.4 : 1 }}>
      <View style={[duo.shadow, { backgroundColor: shadowColor }]} />
      <Animated.View style={{ transform: [{ translateY: ty }] }}>
        <TouchableOpacity
          style={[duo.btn, { backgroundColor: color }]}
          onPressIn={pressIn} onPressOut={pressOut} onPress={onPress}
          disabled={disabled} activeOpacity={1}
        >
          {icon}
          <Text style={duo.label}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const duo = StyleSheet.create({
  shadow: { position: 'absolute', bottom: -4, left: 0, right: 0, height: 52, borderRadius: 14 },
  btn:    { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label:  { color: '#fff', fontSize: 16, fontFamily: 'Inter-Bold' },
});

// ── Shared footer ─────────────────────────────────────────────────────────────

function Footer({ children, C }: { children: React.ReactNode; C: AppColors }) {
  return (
    <View style={[footer.wrap, { backgroundColor: C.bg, borderTopColor: C.border }]}>
      {children}
    </View>
  );
}

const footer = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});

// ── Article view ──────────────────────────────────────────────────────────────
// Renders the lesson as a readable article:
// keyConcept as intro → each flashcard (front = heading, back = body paragraph)

function ArticleView({
  lesson, onFinish, C, fs, F,
}: {
  lesson: any; onFinish: () => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const sections: any[] = lesson.content ?? [];

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[ar.scroll, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40)
            setReachedEnd(true);
        }}
        scrollEventThrottle={16}
      >
        {/* Intro / key concept */}
        <View style={[ar.introCard, { backgroundColor: C.primaryBg, borderColor: C.primaryRing }]}>
          <Text style={[ar.introLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.primary }]}>
            LESSON OVERVIEW
          </Text>
          <Text style={[ar.introText, { fontFamily: F.regular, fontSize: fs(16), color: C.text, lineHeight: fs(16) * 1.7 }]}>
            {lesson.keyConcept}
          </Text>
        </View>

        {/* Article body — one section per content block */}
        {sections.length > 0 ? sections.map((section: any, i: number) => (
          <View key={i} style={[ar.section, i < sections.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
            <Text style={[ar.heading, { fontFamily: F.bold, fontSize: fs(16), color: C.text }]}>
              {section.heading}
            </Text>
            <Text style={[ar.body, { fontFamily: F.regular, fontSize: fs(15), color: C.sub, lineHeight: fs(15) * 1.75 }]}>
              {section.body}
            </Text>
          </View>
        )) : (
          // Fallback for older lessons without content field
          (lesson.flashcards ?? []).map((card: any, i: number) => (
            <View key={i} style={[ar.section, i < (lesson.flashcards?.length ?? 0) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
              <Text style={[ar.heading, { fontFamily: F.bold, fontSize: fs(16), color: C.text }]}>
                {card.front}
              </Text>
              <Text style={[ar.body, { fontFamily: F.regular, fontSize: fs(15), color: C.sub, lineHeight: fs(15) * 1.75 }]}>
                {card.back}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {reachedEnd && (
        <Footer C={C}>
          <DuoButton
            label="Study Flashcards"
            color={C.primary}
            onPress={onFinish}
            icon={<Ionicons name="layers-outline" size={18} color="#fff" />}
          />
        </Footer>
      )}
    </>
  );
}

const ar = StyleSheet.create({
  scroll:     { padding: Spacing.lg, gap: Spacing.xl },
  introCard:  { borderRadius: 16, borderWidth: 1, padding: Spacing.lg, gap: 10 },
  introLabel: { letterSpacing: 1.4 },
  introText:  {},
  section:    { gap: 8, paddingBottom: Spacing.lg },
  heading:    { lineHeight: 24 },
  body:       {},
});

// ── Flashcard view ────────────────────────────────────────────────────────────
// One card at a time, centred, tap-to-flip

function FlashcardView({
  lesson, onFinish, C, fs, F,
}: {
  lesson: any; onFinish: () => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const cards: any[] = lesson.flashcards ?? [];
  const [idx, setIdx]       = useState(0);
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped(v => !v);
  };

  const next = () => {
    Haptics.selectionAsync();
    if (idx < cards.length - 1) { setIdx(i => i + 1); setFlipped(false); }
  };

  const prev = () => {
    Haptics.selectionAsync();
    if (idx > 0) { setIdx(i => i - 1); setFlipped(false); }
  };

  const card = cards[idx];
  const isLast = idx === cards.length - 1;

  return (
    <View style={{ flex: 1 }}>
      {/* Progress dots */}
      <View style={fc.dots}>
        {cards.map((_, i) => (
          <View key={i} style={[fc.dot, { backgroundColor: i === idx ? C.primary : C.border, width: i === idx ? 20 : 6 }]} />
        ))}
      </View>

      {/* Card */}
      <View style={fc.cardWrap}>
        <TouchableOpacity style={[fc.card, { backgroundColor: flipped ? C.primary : C.surface, borderColor: flipped ? C.primary : C.border }]} onPress={flip} activeOpacity={0.9}>
          <Text style={[fc.side, { fontFamily: F.extraBold, fontSize: fs(10), color: flipped ? 'rgba(255,255,255,0.55)' : C.muted }]}>
            {flipped ? 'ANSWER' : `CARD ${idx + 1} OF ${cards.length}`}
          </Text>
          <Text style={[fc.cardText, { fontFamily: flipped ? F.regular : F.semiBold, fontSize: fs(19), color: flipped ? '#fff' : C.text }]}>
            {flipped ? card?.back : card?.front}
          </Text>
          <Text style={[fc.hint, { fontFamily: F.regular, fontSize: fs(12), color: flipped ? 'rgba(255,255,255,0.45)' : C.muted }]}>
            Tap to {flipped ? 'see term' : 'reveal answer'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nav + action */}
      <Footer C={C}>
        <View style={fc.navRow}>
          <TouchableOpacity style={[fc.navBtn, { backgroundColor: C.surface, borderColor: C.border, opacity: idx === 0 ? 0.35 : 1 }]} onPress={prev} disabled={idx === 0}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            {isLast ? (
              <DuoButton label="Take Quiz" color={C.primary} onPress={onFinish} icon={<Ionicons name="help-circle-outline" size={18} color="#fff" />} />
            ) : (
              <DuoButton label="Next" color={C.primary} onPress={next} icon={<Ionicons name="arrow-forward" size={17} color="#fff" />} />
            )}
          </View>

          <TouchableOpacity style={[fc.navBtn, { backgroundColor: C.surface, borderColor: C.border, opacity: isLast ? 0.35 : 1 }]} onPress={next} disabled={isLast}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
      </Footer>
    </View>
  );
}

const fc = StyleSheet.create({
  dots:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 14 },
  dot:     { height: 6, borderRadius: 3 },
  cardWrap:{ flex: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  card:    {
    borderRadius: 24, borderWidth: 1.5, padding: Spacing.xl,
    minHeight: 220, justifyContent: 'center', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  side:     { letterSpacing: 1.4, textAlign: 'center' },
  cardText: { textAlign: 'center', lineHeight: 28 },
  hint:     { textAlign: 'center' },
  navRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn:   { width: 48, height: 52, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Quiz view ─────────────────────────────────────────────────────────────────

function QuizView({
  lesson, onFinish, C, fs, F,
}: {
  lesson: any; onFinish: (score: number, total: number) => void;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const questions: any[] = lesson.quiz ?? [];
  const [idx, setIdx]           = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect]   = useState(0);
  const [done, setDone]         = useState(false);

  const q      = questions[idx];
  const isLast = idx >= questions.length - 1;

  const handleCheck = () => {
    if (!selected || answered) return;
    Haptics.selectionAsync();
    if (selected === q.correctAnswer) setCorrect(c => c + 1);
    setAnswered(true);
  };

  const handleNext = () => {
    if (isLast) { setDone(true); }
    else { setIdx(i => i + 1); setSelected(null); setAnswered(false); }
  };

  // ── Results ──
  if (done) {
    const score = Math.round((correct / questions.length) * 100);
    const emoji = score >= 80 ? '🌟' : score >= 60 ? '👍' : '💪';
    const label = score >= 80 ? 'Excellent work!' : score >= 60 ? 'Good job!' : 'Keep practising!';

    return (
      <View style={[qz.results, { flex: 1 }]}>
        <Text style={{ fontSize: 64, lineHeight: 80 }}>{emoji}</Text>
        <Text style={[{ fontFamily: F.extraBold, fontSize: fs(52), lineHeight: fs(64), color: score >= 60 ? GREEN : '#EF4444' }]}>
          {score}%
        </Text>
        <Text style={[{ fontFamily: F.bold, fontSize: fs(22), color: C.text, textAlign: 'center' }]}>{label}</Text>
        <Text style={[{ fontFamily: F.regular, fontSize: fs(14), color: C.muted }]}>
          {correct} out of {questions.length} correct
        </Text>
        <View style={qz.pipRow}>
          {questions.map((_, i) => (
            <View key={i} style={[qz.pip, i < correct ? { backgroundColor: GREEN, borderColor: GREEN } : { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]} />
          ))}
        </View>
        <View style={{ width: '100%', marginTop: Spacing.md }}>
          <DuoButton label="Continue" color={C.primary} onPress={() => onFinish(correct, questions.length)} icon={<Ionicons name="arrow-forward" size={17} color="#fff" />} />
        </View>
      </View>
    );
  }

  if (!q) return null;

  const optBg     = (opt: string) => { if (!answered) return selected === opt ? `${C.primary}12` : 'transparent'; if (opt === q.correctAnswer) return '#F0FDF4'; if (opt === selected) return '#FEF2F2'; return 'transparent'; };
  const optBorder = (opt: string) => { if (!answered) return selected === opt ? C.primary : C.border; if (opt === q.correctAnswer) return GREEN; if (opt === selected) return '#EF4444'; return C.border; };
  const optColor  = (opt: string) => { if (!answered) return selected === opt ? C.primary : C.text; if (opt === q.correctAnswer) return GREEN; if (opt === selected) return '#EF4444'; return C.muted; };
  const bulletBg  = (opt: string) => { if (answered && opt === q.correctAnswer) return GREEN; if (answered && opt === selected) return '#EF4444'; if (!answered && opt === selected) return C.primary; return C.surfaceAlt; };

  return (
    <>
      <View style={[qz.progressTrack, { backgroundColor: C.surfaceAlt }]}>
        <View style={[qz.progressFill, { width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%`, backgroundColor: C.primary }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[qz.scroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        <View style={[qz.questionCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[qz.questionNum, { fontFamily: F.extraBold, fontSize: fs(10), color: C.primary }]}>
            QUESTION {idx + 1} OF {questions.length}
          </Text>
          <Text style={[qz.questionText, { fontFamily: F.semiBold, fontSize: fs(17), color: C.text, lineHeight: fs(17) * 1.55 }]}>
            {q.question}
          </Text>
        </View>

        <View style={qz.options}>
          {q.options.map((opt: string, i: number) => (
            <TouchableOpacity
              key={i} onPress={() => !answered && setSelected(opt)}
              disabled={answered} activeOpacity={answered ? 1 : 0.75}
              style={[qz.option, { backgroundColor: optBg(opt), borderColor: optBorder(opt) }]}
            >
              <View style={[qz.bullet, { backgroundColor: bulletBg(opt), borderColor: optBorder(opt) }]}>
                <Text style={[qz.bulletTxt, { fontFamily: F.extraBold, fontSize: fs(12), color: answered || selected === opt ? '#fff' : C.muted }]}>
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text style={[qz.optionTxt, { fontFamily: F.semiBold, fontSize: fs(14), color: optColor(opt), flex: 1, lineHeight: 20 }]}>
                {opt}
              </Text>
              {answered && opt === q.correctAnswer && <Ionicons name="checkmark-circle" size={18} color={GREEN} />}
              {answered && opt === selected && opt !== q.correctAnswer && <Ionicons name="close-circle" size={18} color="#EF4444" />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Footer C={C}>
        {!answered
          ? <DuoButton label="Check Answer" color={C.primary} onPress={handleCheck} disabled={!selected} icon={<Ionicons name="checkmark-outline" size={18} color="#fff" />} />
          : <DuoButton label={isLast ? 'See Results' : 'Next Question'} color={C.primary} onPress={handleNext} icon={<Ionicons name={isLast ? 'trophy-outline' : 'arrow-forward'} size={17} color="#fff" />} />
        }
      </Footer>
    </>
  );
}

const qz = StyleSheet.create({
  progressTrack: { height: 4 },
  progressFill:  { height: '100%', borderRadius: 2 },
  scroll:        { padding: Spacing.lg, gap: Spacing.lg },
  questionCard:  { borderRadius: 16, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  questionNum:   { letterSpacing: 1.4 },
  questionText:  {},
  options:       { gap: 10 },
  option:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  bullet:        { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  bulletTxt:     {},
  optionTxt:     {},
  results:       { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  pipRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginVertical: 4 },
  pip:           { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
});

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingView({ C, onBack }: { C: AppColors; onBack: () => void }) {
  const shimmer = useSharedValue(0);
  const spin    = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    spin.value    = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const shimStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.35,
  }));

  const Bar = ({ w, h = 12, mt = 0 }: { w: string; h?: number; mt?: number }) => (
    <Reanimated.View style={[{ width: w as any, height: h, borderRadius: h / 2, backgroundColor: C.border, marginTop: mt }, shimStyle]} />
  );

  return (
    <View style={[S.root, { backgroundColor: C.bg }]}>
      {/* Header skeleton */}
      <View style={[S.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={C.muted} />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 6 }}>
          <Bar w="40%" h={10} />
          <Bar w="65%" h={14} />
        </View>
      </View>

      {/* Spinner + message */}
      <View style={lv.center}>
        <Reanimated.View style={spinStyle}>
          <Ionicons name="reload-outline" size={28} color={C.primary} />
        </Reanimated.View>
        <Reanimated.Text entering={FadeIn.delay(200)} style={[lv.label, { color: C.muted, fontFamily: 'Inter-Regular' }]}>
          Loading course…
        </Reanimated.Text>
      </View>

      {/* Skeleton rows */}
      <View style={lv.skeletonList}>
        {[0, 1, 2].map(i => (
          <Reanimated.View key={i} entering={FadeIn.delay(i * 80)} style={[lv.skeletonRow, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Reanimated.View style={[lv.skeletonCircle, { backgroundColor: C.border }, shimStyle]} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bar w="70%" h={13} />
              <Bar w="45%" h={10} />
            </View>
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
}

const lv = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, maxHeight: 140 },
  label:        { fontSize: 14 },
  skeletonList: { paddingHorizontal: 24, gap: 10 },
  skeletonRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  skeletonCircle: { width: 40, height: 40, borderRadius: 12 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LessonPlayer({ courseId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const { incrementDailyProgress } = useAppStore();

  const course  = useQuery(api.courses.get, { courseId });
  const lessonsRaw = useQuery(api.courses.getLessons, { courseId });
  const lessons = (lessonsRaw ?? []) as any[];
  const completeLesson = useMutation(api.courses.completeLesson);

  const [screenView, setScreenView]     = useState<ScreenView>('list');
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  // Auto-expand the current (next up) lesson
  useEffect(() => {
    if (!lessonsRaw) return;
    const current = (lessonsRaw as any[]).find(
      (l: any, i: number) => !l.completed && (i === 0 || (lessonsRaw as any[])[i - 1]?.completed)
    );
    if (current) setExpandedId(current._id);
  }, [!!lessonsRaw]);

  const openArticle    = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('article'); },    []);
  const openFlashcards = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('flashcards'); }, []);
  const openQuiz       = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('quiz'); },       []);

  const handleQuizFinish = useCallback(async () => {
    if (!activeLesson) return;
    await completeLesson({ lessonId: activeLesson._id as Id<'lessons'> });
    incrementDailyProgress();
    const idx  = lessons.findIndex((l: any) => l._id === activeLesson._id);
    const next = lessons[idx + 1];
    setScreenView('list');
    if (next) setExpandedId(next._id);
  }, [activeLesson, lessons, completeLesson, incrementDailyProgress]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (course === undefined || lessonsRaw === undefined) {
    return <LoadingView C={C} onBack={onBack} />;
  }

  // ── Shared header ─────────────────────────────────────────────────────────

  const Header = ({ title, sub, onBackPress }: { title: string; sub: string; onBackPress: () => void }) => (
    <View style={[S.header, { borderBottomColor: C.border }]}>
      <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onBackPress} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={20} color={C.muted} />
      </TouchableOpacity>
      <View style={S.headerInfo}>
        <Text style={[S.headerSup, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]} numberOfLines={1}>{sub}</Text>
        <Text style={[S.headerTitle, { fontFamily: F.bold, fontSize: fs(17), color: C.text }]} numberOfLines={2}>{title}</Text>
      </View>
    </View>
  );

  // ── Article ───────────────────────────────────────────────────────────────

  if (screenView === 'article' && activeLesson) {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Header title={activeLesson.title} sub={course?.title ?? ''} onBackPress={() => setScreenView('list')} />
        <ArticleView lesson={activeLesson} onFinish={() => openFlashcards(activeLesson)} C={C} fs={fs} F={F} />
      </View>
    );
  }

  // ── Flashcards ────────────────────────────────────────────────────────────

  if (screenView === 'flashcards' && activeLesson) {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Header title={activeLesson.title} sub="Flashcards" onBackPress={() => setScreenView('list')} />
        <FlashcardView lesson={activeLesson} onFinish={() => openQuiz(activeLesson)} C={C} fs={fs} F={F} />
      </View>
    );
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  if (screenView === 'quiz' && activeLesson) {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Header title={activeLesson.title} sub={`Quiz · ${(activeLesson.quiz ?? []).length} questions`} onBackPress={() => setScreenView('list')} />
        <QuizView lesson={activeLesson} onFinish={handleQuizFinish} C={C} fs={fs} F={F} />
      </View>
    );
  }

  // ── Lesson list ───────────────────────────────────────────────────────────

  const completedCount = lessons.filter((l: any) => l.completed).length;
  const progressPct    = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <Header title={course?.title ?? '…'} sub={(course?.difficulty ?? '').toUpperCase()} onBackPress={onBack} />

      <ScrollView contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

        {/* Meta */}
        <View style={[S.metaCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={S.metaRow}>
            <View style={[S.diffBadge, { backgroundColor: `${C.primary}12` }]}>
              <Text style={[{ fontFamily: F.extraBold, fontSize: fs(11), color: C.primary }]}>{(course?.difficulty ?? '').toUpperCase()}</Text>
            </View>
            <Text style={[{ color: C.muted, fontSize: 11 }]}>·</Text>
            <Text style={[{ fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }]}>{lessons.length} lessons</Text>
            {completedCount > 0 && <>
              <Text style={[{ color: C.muted, fontSize: 11 }]}>·</Text>
              <Text style={[{ fontFamily: F.extraBold, fontSize: fs(12), color: C.primary }]}>{completedCount}/{lessons.length} done</Text>
            </>}
          </View>
          {course?.description ? (
            <Text style={[{ fontFamily: F.regular, fontSize: fs(13), color: C.sub, lineHeight: 21 }]} numberOfLines={3}>{course.description}</Text>
          ) : null}
          {completedCount > 0 && (
            <View style={S.progressRow}>
              <View style={[S.progressBg, { backgroundColor: C.surfaceAlt }]}>
                <View style={[S.progressFill, { width: `${progressPct}%` as any, backgroundColor: C.primary }]} />
              </View>
              <Text style={[{ fontFamily: F.extraBold, fontSize: fs(12), color: C.primary, minWidth: 36, textAlign: 'right' }]}>{progressPct}%</Text>
            </View>
          )}
        </View>

        <Text style={[S.sectionCap, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>LESSONS</Text>

        {/* Connected path */}
        <View style={S.lessonPath}>
          {lessons.map((lesson: any, idx: number) => {
            const isCompleted = lesson.completed;
            const isLast      = idx === lessons.length - 1;
            const isOpen      = expandedId === lesson._id;
            const isCurrent   = !isCompleted && (idx === 0 || lessons[idx - 1]?.completed);

            return (
              <View key={lesson._id} style={S.lessonRow}>
                {/* Node */}
                <View style={S.connectorCol}>
                  <View style={[S.node, isCompleted ? { backgroundColor: C.primary } : isCurrent ? { borderWidth: 2, borderColor: C.primary, backgroundColor: C.bg } : { backgroundColor: C.border }]}>
                    {isCompleted
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : <View style={[S.nodeDot, { backgroundColor: isCurrent ? C.primary : C.muted }]} />}
                  </View>
                  {!isLast && <View style={[S.connector, { backgroundColor: isCompleted ? C.primary : C.border }]} />}
                </View>

                {/* Card */}
                <View style={[S.lessonCard, { backgroundColor: C.surface, borderColor: isCompleted ? `${C.primary}40` : C.border }, isLast && { marginBottom: 0 }]}>
                  <TouchableOpacity style={S.lessonCardHeader} onPress={() => setExpandedId(isOpen ? null : lesson._id)} activeOpacity={0.75}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[S.lessonTitle, { fontFamily: F.semiBold, fontSize: fs(14), color: C.text }]} numberOfLines={1}>
                        {lesson.title}
                      </Text>
                      <View style={S.lessonSubRow}>
                        <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                          {lesson.flashcards?.length ?? 0} cards · {lesson.quiz?.length ?? 0} questions
                        </Text>
                        {isCompleted && (
                          <View style={[S.badge, { backgroundColor: `${C.primary}12`, borderColor: `${C.primary}30` }]}>
                            <Text style={[S.badgeTxt, { fontFamily: F.extraBold, fontSize: fs(9), color: C.primary }]}>DONE</Text>
                          </View>
                        )}
                        {isCurrent && !isCompleted && (
                          <View style={[S.badge, { backgroundColor: `${GREEN}12`, borderColor: `${GREEN}30` }]}>
                            <Text style={[S.badgeTxt, { fontFamily: F.extraBold, fontSize: fs(9), color: GREEN }]}>UP NEXT</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={S.lessonBody}>
                      <View style={[S.bodyDivider, { backgroundColor: C.border }]} />

                      {isCompleted ? (
                        // Completed lesson — all sections available for review
                        <>
                          <TouchableOpacity style={S.contentRow} onPress={() => openArticle(lesson)} activeOpacity={0.75}>
                            <View style={[S.contentIcon, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                              <Ionicons name="book-outline" size={16} color={C.primary} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Article</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>Review lesson content</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={15} color={C.primary} />
                          </TouchableOpacity>

                          <View style={[S.bodyDivider, { backgroundColor: C.border }]} />

                          <TouchableOpacity style={S.contentRow} onPress={() => openFlashcards(lesson)} activeOpacity={0.75}>
                            <View style={[S.contentIcon, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                              <Ionicons name="layers-outline" size={16} color={C.primary} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Flashcards</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                {lesson.flashcards?.length ?? 0} cards
                              </Text>
                            </View>
                            <Ionicons name="arrow-forward" size={15} color={C.primary} />
                          </TouchableOpacity>

                          <View style={[S.bodyDivider, { backgroundColor: C.border }]} />

                          <TouchableOpacity style={S.contentRow} onPress={() => openQuiz(lesson)} activeOpacity={0.75}>
                            <View style={[S.contentIcon, { backgroundColor: `${GREEN}10`, borderColor: `${GREEN}20` }]}>
                              <Ionicons name="help-circle-outline" size={16} color={GREEN} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Quiz</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                {lesson.quiz?.length ?? 0} questions · Completed
                              </Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                          </TouchableOpacity>
                        </>
                      ) : (
                        // Incomplete lesson — article is the entry point, rest is visible but locked
                        <>
                          <TouchableOpacity style={S.contentRow} onPress={() => openArticle(lesson)} activeOpacity={0.75}>
                            <View style={[S.contentIcon, { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}30` }]}>
                              <Ionicons name="play" size={16} color={C.primary} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Start Lesson</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>Read the lesson content</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={15} color={C.primary} />
                          </TouchableOpacity>

                          <View style={[S.bodyDivider, { backgroundColor: C.border }]} />

                          <View style={[S.contentRow, { opacity: 0.35 }]}>
                            <View style={[S.contentIcon, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                              <Ionicons name="layers-outline" size={16} color={C.muted} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Flashcards</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                {lesson.flashcards?.length ?? 0} cards to study
                              </Text>
                            </View>
                            <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
                          </View>

                          <View style={[S.bodyDivider, { backgroundColor: C.border }]} />

                          <View style={[S.contentRow, { opacity: 0.35 }]}>
                            <View style={[S.contentIcon, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                              <Ionicons name="help-circle-outline" size={16} color={C.muted} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Quiz</Text>
                              <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                {lesson.quiz?.length ?? 0} questions
                              </Text>
                            </View>
                            <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:    { width: 36, height: 36, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  headerInfo: { flex: 1, gap: 3 },
  headerSup:  { letterSpacing: 1.2 },
  headerTitle:{ lineHeight: 24 },

  scroll:      { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.lg },
  metaCard:    { borderRadius: 16, borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diffBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBg:  { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:{ height: '100%', borderRadius: 3 },

  sectionCap: { letterSpacing: 1.5 },

  lessonPath:  { gap: 0 },
  lessonRow:   { flexDirection: 'row', gap: Spacing.md },
  connectorCol:{ alignItems: 'center', width: 24, paddingTop: 14 },
  node:        { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  nodeDot:     { width: 7, height: 7, borderRadius: 4 },
  connector:   { width: 2, flex: 1, minHeight: 16 },

  lessonCard:       { flex: 1, borderRadius: 14, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
  lessonCardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  lessonTitle:      { lineHeight: 20 },
  lessonSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:            { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  badgeTxt:         { letterSpacing: 0.6 },

  lessonBody:  { paddingBottom: Spacing.sm },
  bodyDivider: { height: StyleSheet.hairlineWidth },
  contentRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, gap: Spacing.md },
  contentIcon: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  contentLabel:{},
  contentSub:  {},
});
