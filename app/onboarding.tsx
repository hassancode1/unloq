import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily } from '../constants/theme';
import { Spacing } from '../constants/spacing';
import DuoButton from '../components/DuoButton';

const { width: SCREEN_W } = Dimensions.get('window');
const P = Colors.primary;

type Slide = {
  key: string;
  emoji: string;
  badge: string;
  title: string;
  subtitle: string;
  content: () => React.ReactNode;
};

// ── Slide 1: Upload ───────────────────────────────────────────────────────────

function UploadPreview() {
  const formats = [
    { icon: 'document-text-outline' as const, label: 'PDF',   desc: 'Textbooks, papers, notes' },
    { icon: 'reader-outline'         as const, label: 'DOCX',  desc: 'Word documents & reports' },
    { icon: 'create-outline'         as const, label: 'Text',  desc: 'Plain text & quick paste' },
    { icon: 'film-outline'           as const, label: 'More',  desc: 'Slides coming soon' },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.grid}>
      {formats.map((f, i) => (
        <Animated.View key={f.label} entering={FadeInDown.delay(100 + i * 60).duration(260)} style={styles.gridCard}>
          <View style={styles.gridIcon}>
            <Ionicons name={f.icon} size={22} color={P} />
          </View>
          <Text style={styles.gridTitle}>{f.label}</Text>
          <Text style={styles.gridDesc}>{f.desc}</Text>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ── Slide 2: AI ───────────────────────────────────────────────────────────────

function AIPreview() {
  const steps = [
    { emoji: '⚡', text: 'Breaking your doc into bite-sized lessons' },
    { emoji: '🧠', text: 'Generating comprehension questions for each' },
    { emoji: '✅', text: 'Building your personal learning course' },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.aiCard}>
      <View style={styles.aiHeader}>
        <View style={styles.aiDot} />
        <Text style={styles.aiHeaderText}>Unloq AI is reading your doc…</Text>
      </View>
      <View style={styles.aiDivider} />
      {steps.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(200 + i * 100).duration(240)}
          style={[styles.aiRow, i > 0 && styles.aiRowBorder]}
        >
          <Text style={styles.aiEmoji}>{s.emoji}</Text>
          <Text style={styles.aiRowText}>{s.text}</Text>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ── Slide 3: Flow ─────────────────────────────────────────────────────────────

function FlowPreview() {
  const steps = [
    { emoji: '📄', label: 'Upload',  desc: 'Drop in any document you need to learn' },
    { emoji: '📖', label: 'Study',   desc: 'Work through the AI-generated lessons' },
    { emoji: '🔓', label: 'Unlock',  desc: 'Answer correctly — your apps are freed' },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ gap: Spacing.sm }}>
      {steps.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(100 + i * 80).duration(260)}
          style={styles.flowRow}
        >
          <View style={styles.flowBadge}>
            <Text style={styles.flowBadgeNum}>{i + 1}</Text>
          </View>
          <View style={styles.flowIcon}>
            <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.flowLabel}>{s.label}</Text>
            <Text style={styles.flowDesc}>{s.desc}</Text>
          </View>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ── Slide definitions ─────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    key: 'upload',
    emoji: '📄',
    badge: 'Step 1',
    title: 'Upload any\ndocument',
    subtitle: 'PDF, notes, textbook chapters — drop it in and Unloq does the rest.',
    content: () => <UploadPreview />,
  },
  {
    key: 'ai',
    emoji: '🧠',
    badge: 'Step 2',
    title: 'AI builds\nyour course',
    subtitle: 'Unloq breaks your doc into bite-sized lessons with questions to test you.',
    content: () => <AIPreview />,
  },
  {
    key: 'flow',
    emoji: '🔒',
    badge: 'Step 3',
    title: 'Unlock by\nactually learning',
    subtitle: 'Your screen stays blocked until you read and answer. No shortcuts.',
    content: () => <FlowPreview />,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isLast = activeIndex === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      onComplete();
    } else {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }
  }, [isLast, activeIndex, onComplete]);

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync();
    onComplete();
  }, [onComplete]);

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>{item.emoji}</Text>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </Animated.View>
      {item.content()}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.topBar}>
        <View />
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.flatList}
      />

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
        <DuoButton label={isLast ? "Let's Go! 🚀" : 'Continue'} onPress={handleNext} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    height: 52,
  },
  skipText: { color: Colors.textSoft, fontSize: 15, fontFamily: FontFamily.semiBold },

  flatList: { flex: 1 },
  slide: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },

  // Header (badge + title + subtitle)
  header: { gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: `${P}12`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: `${P}35`,
  },
  badgeEmoji: { fontSize: 13 },
  badgeText: { fontSize: 12, fontFamily: FontFamily.bold, color: P, letterSpacing: 0.3 },
  slideTitle: {
    fontSize: 32,
    fontFamily: FontFamily.extraBold,
    color: Colors.text,
    lineHeight: 40,
  },
  slideSubtitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  // Upload grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridCard: {
    width: (SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 4,
  },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: `${P}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  gridTitle: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.text },
  gridDesc:  { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, lineHeight: 16 },

  // AI card
  aiCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  aiHeaderText: { fontSize: 13, fontFamily: FontFamily.bold, color: Colors.text },
  aiDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginBottom: 4 },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  aiRowBorder: { borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  aiEmoji: { fontSize: 18, lineHeight: 22 },
  aiRowText: { flex: 1, fontSize: 13, fontFamily: FontFamily.semiBold, color: Colors.textMuted, lineHeight: 19 },

  // Flow rows
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  flowBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: P,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowBadgeNum: { fontSize: 12, fontFamily: FontFamily.extraBold, color: Colors.white },
  flowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: `${P}12`,
    borderWidth: 1,
    borderColor: `${P}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowLabel: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.text },
  flowDesc:  { fontSize: 12, fontFamily: FontFamily.semiBold, color: Colors.textMuted },

  // Bottom nav
  bottom: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  dotActive:   { width: 28, backgroundColor: P },
  dotInactive: { width: 8,  backgroundColor: Colors.surfaceBorder },
});
