import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
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

type ScreenView = 'list' | 'article' | 'diagram' | 'flashcards' | 'quiz';
type Props = { courseId: Id<'courses'>; onBack: () => void; initialView?: 'flashcards' | 'quiz' | 'diagram' };

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
  label:  { color: '#fff', fontSize: 16, fontFamily: 'Nunito-Bold' },
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
            label="Continue"
            color={C.primary}
            onPress={onFinish}
            icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
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

const SWIPE_THRESHOLD = 100;

function FlashcardView({
  lesson, onFinish, C, fs, F,
}: {
  lesson: any; onFinish: () => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const cards: any[] = lesson.flashcards ?? [];
  const [idx, setIdx]           = useState(0);
  const [showBack, setShowBack] = useState(false);

  // RN Animated for swipe — kept entirely separate from Reanimated
  const translateX = useRef(new Animated.Value(0)).current;

  // Reanimated scaleX for flip — collapses to 0, swaps content, expands back
  const flipScale  = useSharedValue(1);
  const flipStyle  = useAnimatedStyle(() => ({ transform: [{ scaleX: flipScale.value }] }));

  const card     = cards[idx];
  const nextCard = cards[idx + 1];
  const isLast   = idx === cards.length - 1;
  const progressPct = cards.length > 0 ? (idx + 1) / cards.length : 0;

  const rotate = translateX.interpolate({
    inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'],
  });
  const nextScale = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.93, 1], extrapolate: 'clamp',
  });
  const knowOpacity = translateX.interpolate({
    inputRange: [20, 80], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const againOpacity = translateX.interpolate({
    inputRange: [-80, -20], outputRange: [1, 0], extrapolate: 'clamp',
  });

  const advance = (dir: 'left' | 'right') => {
    Haptics.selectionAsync();
    const dest = dir === 'right' ? 600 : -600;
    Animated.timing(translateX, { toValue: dest, duration: 220, useNativeDriver: true }).start(() => {
      translateX.setValue(0);
      setShowBack(false);
      if (isLast) { onFinish(); } else { setIdx(i => i + 1); }
    });
  };

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }).start();
  };

  const toggleBack = useCallback(() => setShowBack(b => !b), []);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Collapse card horizontally → swap content at midpoint → expand
    flipScale.value = withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(toggleBack)();
        flipScale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }
    });
  };

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderGrant: () => translateX.stopAnimation(),
    onPanResponderMove: (_, gs) => translateX.setValue(gs.dx),
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.6)       advance('right');
      else if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -0.6) advance('left');
      else snapBack();
    },
    onPanResponderTerminate: snapBack,
  })).current;

  return (
    <View style={{ flex: 1 }}>

      {/* ── Progress ── */}
      <View style={fc.progressWrap}>
        <View style={[fc.progressTrack, { backgroundColor: C.surfaceAlt }]}>
          <View style={[fc.progressFill, { width: `${progressPct * 100}%` as any, backgroundColor: C.primary }]} />
        </View>
        <Text style={[{ fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }]}>
          {idx + 1} / {cards.length}
        </Text>
      </View>

      {/* ── Card stack ── */}
      <View style={fc.stackArea}>

        {/* Next card — behind, slightly inset */}
        {nextCard && (
          <Animated.View style={[fc.card, fc.nextCard, {
            backgroundColor: C.surface, borderColor: C.border,
            transform: [{ scale: nextScale }],
          }]}>
            <Text style={[fc.sideLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>QUESTION</Text>
            <Text style={[fc.cardText, { fontFamily: F.semiBold, fontSize: fs(16), color: C.text }]} numberOfLines={4}>
              {nextCard.front}
            </Text>
          </Animated.View>
        )}

        {/* Current card — swipe handled by RN Animated, flip by Reanimated scaleX */}
        <Animated.View
          style={[fc.card, fc.currentCard, {
            backgroundColor: showBack ? C.text : C.surface,
            borderColor: showBack ? C.text : C.border,
            transform: [{ translateX }, { rotate }],
          }]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[fc.swipeTag, fc.swipeTagRight, { opacity: knowOpacity, borderColor: GREEN }]}>
            <Text style={[fc.swipeTagTxt, { color: GREEN, fontFamily: F.extraBold }]}>KNOW IT</Text>
          </Animated.View>
          <Animated.View style={[fc.swipeTag, fc.swipeTagLeft, { opacity: againOpacity, borderColor: '#EF4444' }]}>
            <Text style={[fc.swipeTagTxt, { color: '#EF4444', fontFamily: F.extraBold }]}>AGAIN</Text>
          </Animated.View>

          {/* Flip wrapper — scaleX collapses and expands on tap */}
          <Reanimated.View style={[fc.cardInner, flipStyle]}>
            <TouchableOpacity style={fc.cardInner} onPress={flip} activeOpacity={0.97}>
              <Text style={[fc.sideLabel, { fontFamily: F.extraBold, fontSize: fs(10), color: showBack ? `${C.bg}55` : C.muted }]}>
                {showBack ? 'ANSWER' : 'QUESTION'}
              </Text>
              <Text style={[fc.cardText, { fontFamily: showBack ? F.regular : F.semiBold, fontSize: fs(18), color: showBack ? C.bg : C.text }]}>
                {showBack ? card?.back : card?.front}
              </Text>
              {!showBack && (
                <View style={[fc.tapPill, { backgroundColor: C.surfaceAlt }]}>
                  <Ionicons name="sync-outline" size={13} color={C.muted} />
                  <Text style={[{ fontFamily: F.semiBold, fontSize: fs(11), color: C.muted }]}>Tap to reveal</Text>
                </View>
              )}
            </TouchableOpacity>
          </Reanimated.View>
        </Animated.View>
      </View>

      {/* ── Swipe guide ── */}
      <View style={fc.guideRow}>
        <View style={fc.guideItem}>
          <Ionicons name="arrow-back" size={14} color={C.muted} />
          <Text style={[fc.guideTxt, { fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }]}>Again</Text>
        </View>
        <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>swipe to navigate</Text>
        <View style={fc.guideItem}>
          <Text style={[fc.guideTxt, { fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }]}>Know it</Text>
          <Ionicons name="arrow-forward" size={14} color={C.muted} />
        </View>
      </View>

      {/* ── Footer buttons ── */}
      <Footer C={C}>
        <View style={fc.actionRow}>
          <TouchableOpacity
            style={[fc.actionBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
            onPress={() => advance('left')}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={18} color={C.text} />
            <Text style={[fc.actionLabel, { fontFamily: F.bold, color: C.text, fontSize: fs(14) }]}>Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fc.actionBtn, { backgroundColor: C.text, borderColor: C.text }]}
            onPress={() => advance('right')}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color={C.bg} />
            <Text style={[fc.actionLabel, { fontFamily: F.bold, color: C.bg, fontSize: fs(14) }]}>
              {isLast ? 'Finish' : 'Know it'}
            </Text>
          </TouchableOpacity>
        </View>
      </Footer>
    </View>
  );
}

const fc = StyleSheet.create({
  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 4 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },

  stackArea:   { flex: 1, marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
  card: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    borderRadius: 24, borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  nextCard: {
    top: 10, left: 10, right: 10, bottom: -6,
    padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
    overflow: 'hidden',
  },
  currentCard: {
    padding: Spacing.xl, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  cardInner:   { alignItems: 'center', gap: Spacing.md, width: '100%' },
  sideLabel:   { letterSpacing: 1.6 },
  cardText:    { textAlign: 'center', lineHeight: 28, width: '100%' },
  tapPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },

  // Swipe direction stamps
  swipeTag:      { position: 'absolute', top: 20, borderWidth: 2.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  swipeTagRight: { right: 20, transform: [{ rotate: '12deg' }] },
  swipeTagLeft:  { left: 20, transform: [{ rotate: '-12deg' }] },
  swipeTagTxt:   { fontSize: 13, letterSpacing: 1 },

  guideRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  guideItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guideTxt:  {},

  actionRow:   { flexDirection: 'row', gap: 10 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16, borderWidth: 1 },
  actionLabel: {},
});

// ── Diagram view ──────────────────────────────────────────────────────────────

const NODE_COLORS = [
  '#4ADE80', // root — green
  '#F87171', // coral
  '#A78BFA', // purple
  '#60A5FA', // sky blue
  '#FCD34D', // amber
  '#34D399', // emerald
  '#F472B6', // pink
  '#FB923C', // orange
];

const NODE_EMOJIS = ['🧠', '❤️', '💡', '⭐', '🎯', '🔑', '💪', '✨', '🌟', '📌'];

// Multi-colored bundle of flexible wire-like cables between nodes
function WireBundle({ colors }: { colors: string[] }) {
  const W = 72; const H = 68; const cx = W / 2;
  const count = Math.min(colors.length, 5);
  return (
    <Svg width={W} height={H} style={{ alignSelf: 'center' }}>
      {Array.from({ length: count }, (_, i) => {
        const t = count <= 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1..1
        const startX = cx + t * (count * 5.5);
        // Cubic bezier: vertical tangent at start, gently converge to center
        const cp1x = startX;
        const cp1y = H * 0.32;
        const cp2x = cx + t * 3;
        const cp2y = H * 0.74;
        return (
          <Path
            key={i}
            d={`M ${startX} 0 C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${cx} ${H}`}
            stroke={colors[i % colors.length]}
            strokeWidth={2.4}
            strokeOpacity={0.82}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function DiagramGeneratingView({ C, fs, F }: { C: AppColors; fs: (n: number) => number; F: any }) {
  const op = useSharedValue(0.4);
  useEffect(() => {
    op.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const shimStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Reanimated.Text style={[{ fontSize: 52 }, shimStyle]}>🗺️</Reanimated.Text>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Reanimated.Text style={[{ fontSize: fs(16), fontFamily: F.bold, color: C.text }, shimStyle]}>
          Building mind map…
        </Reanimated.Text>
        <Text style={{ fontSize: fs(13), fontFamily: F.regular, color: C.muted }}>
          This usually takes a few seconds
        </Text>
      </View>
      {/* Mini wire preview animation */}
      <Reanimated.View style={[{ flexDirection: 'row', gap: 6, marginTop: 8 }, shimStyle]}>
        {['#4ADE80', '#F87171', '#A78BFA', '#60A5FA', '#FCD34D'].map((c, i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
        ))}
      </Reanimated.View>
    </View>
  );
}

function DiagramView({
  lesson, onFinish, C, fs, F,
}: {
  lesson: any; onFinish: () => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const diagram = lesson.diagram as { root: string; branches: { name: string; points: string[] }[] } | undefined;
  const [scale, setScale] = useState(1);
  if (!diagram) return null;

  const allColors = NODE_COLORS.slice(0, Math.min(diagram.branches.length + 1, NODE_COLORS.length));

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={dm.scroll}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={[dm.canvas, { transform: [{ scale }] }]}>

          {/* Root node */}
          <View style={dm.nodeWrap}>
            <View style={dm.emojiBadge}>
              <Text style={{ fontSize: 18 }}>{NODE_EMOJIS[0]}</Text>
            </View>
            <Reanimated.View entering={FadeInDown.duration(350).springify()}>
              <View style={[dm.node, { backgroundColor: NODE_COLORS[0], shadowColor: NODE_COLORS[0] }]}>
                <Text style={[dm.nodeText, { fontFamily: F.bold, fontSize: fs(16) }]} numberOfLines={3}>
                  {diagram.root}
                </Text>
              </View>
            </Reanimated.View>
          </View>

          {/* Branch nodes */}
          {diagram.branches.map((branch, bi) => {
            const color     = NODE_COLORS[(bi + 1) % NODE_COLORS.length];
            const emoji     = NODE_EMOJIS[(bi + 1) % NODE_EMOJIS.length];
            const delay     = (bi + 1) * 100;
            const wireClrs  = allColors.slice(0, bi + 2);
            return (
              <View key={bi} style={dm.nodeWrap}>
                {/* Wire bundle */}
                <WireBundle colors={wireClrs} />

                {/* Emoji badge */}
                <View style={dm.emojiBadge}>
                  <Text style={{ fontSize: 16 }}>{emoji}</Text>
                </View>

                {/* Node pill */}
                <Reanimated.View entering={FadeInDown.delay(delay).duration(320).springify()}>
                  <View style={[dm.node, { backgroundColor: color, shadowColor: color }]}>
                    <Text style={[dm.nodeText, { fontFamily: F.bold, fontSize: fs(15) }]} numberOfLines={3}>
                      {branch.name}
                    </Text>
                  </View>
                </Reanimated.View>

                {/* Points beneath node */}
                {branch.points.length > 0 && (
                  <Reanimated.View entering={FadeInDown.delay(delay + 80).duration(280)} style={[dm.pointsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    {branch.points.map((pt, pi) => (
                      <Text key={pi} style={[dm.pointTxt, { color: C.sub, fontFamily: F.regular, fontSize: fs(12) }]}>
                        · {pt}
                      </Text>
                    ))}
                  </Reanimated.View>
                )}
              </View>
            );
          })}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Zoom controls */}
      <View style={dm.zoomBar}>
        <TouchableOpacity style={dm.zoomBtn} onPress={() => setScale(1)} activeOpacity={0.8}>
          <Ionicons name="scan-outline" size={17} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={dm.zoomBtn} onPress={() => setScale(s => Math.min(parseFloat((s + 0.2).toFixed(1)), 2.0))} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={dm.zoomBtn} onPress={() => setScale(s => Math.max(parseFloat((s - 0.2).toFixed(1)), 0.4))} activeOpacity={0.8}>
          <Ionicons name="remove" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <Footer C={C}>
        <DuoButton
          label="Continue"
          color={C.primary}
          onPress={onFinish}
          icon={<Ionicons name="arrow-forward" size={18} color="#fff" />}
        />
      </Footer>
    </>
  );
}

const dm = StyleSheet.create({
  scroll:     { alignItems: 'center', paddingTop: 28 },
  canvas:     { alignItems: 'center', width: '100%' },

  nodeWrap:   { alignItems: 'center', width: '100%' },
  emojiBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: -10, zIndex: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  node: {
    width: 210,
    paddingVertical: 18, paddingHorizontal: 22,
    borderRadius: 32,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 14, elevation: 8,
  },
  nodeText:   { color: '#fff', textAlign: 'center', lineHeight: 22 },

  pointsCard: {
    marginTop: 8, width: 230,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  pointTxt:   { lineHeight: 18 },

  zoomBar: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  zoomBtn: {
    width: 46, height: 46,
    borderRadius: 13,
    backgroundColor: '#1E1E32',
    justifyContent: 'center', alignItems: 'center',
  },
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

  // Slide animation for question transitions
  const slideX = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: interpolate(Math.abs(slideX.value), [0, 200], [1, 0], 'clamp'),
  }));

  const q      = questions[idx];
  const isLast = idx >= questions.length - 1;

  const handleCheck = () => {
    if (!selected || answered) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selected === q.correctAnswer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCorrect(c => c + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setAnswered(true);
  };

  const goNext = useCallback(() => {
    setIdx(i => i + 1);
    setSelected(null);
    setAnswered(false);
  }, []);

  const handleNext = () => {
    if (isLast) { setDone(true); return; }
    Haptics.selectionAsync();
    // Slide out left, swap question, slide in from right
    slideX.value = withTiming(-380, { duration: 200, easing: Easing.in(Easing.quad) }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(goNext)();
        slideX.value = 380;
        slideX.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    });
  };

  // ── Results ──
  if (done) {
    const score = Math.round((correct / questions.length) * 100);
    const emoji = score >= 80 ? '🌟' : score >= 60 ? '👍' : '💪';
    const label = score >= 80 ? 'Excellent work!' : score >= 60 ? 'Good job!' : 'Keep practising!';

    return (
      <View style={[qz.results, { flex: 1 }]}>
        <Reanimated.Text entering={ZoomIn.springify().damping(12)} style={{ fontSize: 64, lineHeight: 80 }}>
          {emoji}
        </Reanimated.Text>
        <Reanimated.Text
          entering={FadeInDown.delay(120).springify().damping(14)}
          style={[{ fontFamily: F.extraBold, fontSize: fs(52), lineHeight: fs(64), color: score >= 60 ? GREEN : '#EF4444' }]}
        >
          {score}%
        </Reanimated.Text>
        <Reanimated.Text
          entering={FadeInDown.delay(200).duration(260)}
          style={[{ fontFamily: F.bold, fontSize: fs(22), color: C.text, textAlign: 'center' }]}
        >
          {label}
        </Reanimated.Text>
        <Reanimated.Text
          entering={FadeInDown.delay(260).duration(260)}
          style={[{ fontFamily: F.regular, fontSize: fs(14), color: C.muted }]}
        >
          {correct} out of {questions.length} correct
        </Reanimated.Text>
        <Reanimated.View entering={FadeInUp.delay(320).duration(280)} style={qz.pipRow}>
          {questions.map((_, i) => (
            <View key={i} style={[qz.pip, i < correct ? { backgroundColor: GREEN, borderColor: GREEN } : { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]} />
          ))}
        </Reanimated.View>
        <Reanimated.View entering={FadeInUp.delay(400).springify()} style={{ width: '100%', marginTop: Spacing.md }}>
          <DuoButton label="Continue" color={C.primary} onPress={() => onFinish(correct, questions.length)} icon={<Ionicons name="arrow-forward" size={17} color="#fff" />} />
        </Reanimated.View>
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
        <Reanimated.View style={[qz.progressFill, { width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%`, backgroundColor: C.primary }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[qz.scroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* Slide-animated question + options — key forces remount on question change */}
        <Reanimated.View style={slideStyle}>
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
                {answered && opt === q.correctAnswer && (
                  <Reanimated.View entering={ZoomIn.springify().damping(12)}>
                    <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                  </Reanimated.View>
                )}
                {answered && opt === selected && opt !== q.correctAnswer && (
                  <Reanimated.View entering={ZoomIn.springify().damping(12)}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </Reanimated.View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Reanimated.View>
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
    <Reanimated.View style={[{ width: w as any, height: h, borderRadius: h / 2, backgroundColor: C.borderStrong, marginTop: mt }, shimStyle]} />
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
        <Reanimated.Text entering={FadeIn.delay(200)} style={[lv.label, { color: C.muted, fontFamily: 'Nunito-Regular' }]}>
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

export default function LessonPlayer({ courseId, onBack, initialView }: Props) {
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

  const openArticle    = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('article');    }, []);
  const openDiagram    = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('diagram');    }, []);
  const openFlashcards = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('flashcards'); }, []);
  const openQuiz       = useCallback((l: any) => { Haptics.selectionAsync(); setActiveLesson(l); setScreenView('quiz');       }, []);

  const handleQuizFinish = useCallback(async () => {
    if (!activeLesson) return;
    await completeLesson({ lessonId: activeLesson._id as Id<'lessons'> });
    incrementDailyProgress();
    const idx  = lessons.findIndex((l: any) => l._id === activeLesson._id);
    const next = lessons[idx + 1];
    setScreenView('list');
    if (next) setExpandedId(next._id);
  }, [activeLesson, lessons, completeLesson, incrementDailyProgress]);

  // Smart flow helpers — skip views whose data is absent
  const nextAfterArticle = useCallback((l: any) => {
    if (l.diagram)            return openDiagram(l);
    if (l.flashcards?.length) return openFlashcards(l);
    if (l.quiz?.length)       return openQuiz(l);
    handleQuizFinish();
  }, [openDiagram, openFlashcards, openQuiz, handleQuizFinish]);

  const nextAfterDiagram = useCallback((l: any) => {
    if (l.flashcards?.length) return openFlashcards(l);
    if (l.quiz?.length)       return openQuiz(l);
    handleQuizFinish();
  }, [openFlashcards, openQuiz, handleQuizFinish]);

  const nextAfterFlashcards = useCallback((l: any) => {
    if (l.quiz?.length) return openQuiz(l);
    handleQuizFinish();
  }, [openQuiz, handleQuizFinish]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (course === undefined || lessonsRaw === undefined) {
    return <LoadingView C={C} onBack={onBack} />;
  }

  // ── Course-level views (all lessons aggregated) ───────────────────────────

  if (initialView === 'flashcards') {
    const allCards = lessons.flatMap((l: any) => l.flashcards ?? []).filter((c: any) => c?.front && c?.back);
    const syntheticLesson = { flashcards: allCards, title: course?.title ?? '' };
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <View style={[S.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.muted} />
          </TouchableOpacity>
          <View style={S.headerInfo}>
            <Text style={[S.headerSup, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>FLASHCARDS</Text>
            <Text style={[S.headerTitle, { fontFamily: F.bold, fontSize: fs(17), color: C.text }]} numberOfLines={1}>{course?.title ?? ''}</Text>
          </View>
        </View>
        {allCards.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 40 }}>🃏</Text>
            <Text style={[{ fontFamily: F.semiBold, fontSize: fs(15), color: C.muted }]}>No flashcards yet</Text>
          </View>
        ) : (
          <FlashcardView lesson={syntheticLesson} onFinish={onBack} C={C} fs={fs} F={F} />
        )}
      </View>
    );
  }

  if (initialView === 'quiz') {
    const allQuestions = lessons.flatMap((l: any) => l.quiz ?? []).filter((q: any) => q?.question && q?.options?.length);
    const syntheticLesson = { quiz: allQuestions, title: course?.title ?? '' };
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <View style={[S.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.muted} />
          </TouchableOpacity>
          <View style={S.headerInfo}>
            <Text style={[S.headerSup, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>QUIZ</Text>
            <Text style={[S.headerTitle, { fontFamily: F.bold, fontSize: fs(17), color: C.text }]} numberOfLines={1}>{course?.title ?? ''}</Text>
          </View>
        </View>
        {allQuestions.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontSize: 40 }}>📝</Text>
            <Text style={[{ fontFamily: F.semiBold, fontSize: fs(15), color: C.muted }]}>No quiz questions yet</Text>
          </View>
        ) : (
          <QuizView lesson={syntheticLesson} onFinish={onBack} C={C} fs={fs} F={F} />
        )}
      </View>
    );
  }

  if (initialView === 'diagram') {
    const firstWithDiagram = lessons.find((l: any) => l.diagram);
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <View style={[S.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.muted} />
          </TouchableOpacity>
          <View style={S.headerInfo}>
            <Text style={[S.headerSup, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>MIND MAP</Text>
            <Text style={[S.headerTitle, { fontFamily: F.bold, fontSize: fs(17), color: C.text }]} numberOfLines={1}>{course?.title ?? ''}</Text>
          </View>
        </View>
        {!firstWithDiagram ? (
          <DiagramGeneratingView C={C} fs={fs} F={F} />
        ) : (
          <DiagramView lesson={firstWithDiagram} onFinish={onBack} C={C} fs={fs} F={F} />
        )}
      </View>
    );
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
        <ArticleView lesson={activeLesson} onFinish={() => nextAfterArticle(activeLesson)} C={C} fs={fs} F={F} />
      </View>
    );
  }

  // ── Diagram ───────────────────────────────────────────────────────────────

  if (screenView === 'diagram' && activeLesson) {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Header title={activeLesson.title} sub="Diagram" onBackPress={() => setScreenView('list')} />
        <DiagramView lesson={activeLesson} onFinish={() => nextAfterDiagram(activeLesson)} C={C} fs={fs} F={F} />
      </View>
    );
  }

  // ── Flashcards ────────────────────────────────────────────────────────────

  if (screenView === 'flashcards' && activeLesson) {
    return (
      <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <Header title={activeLesson.title} sub="Flashcards" onBackPress={() => setScreenView('list')} />
        <FlashcardView lesson={activeLesson} onFinish={() => nextAfterFlashcards(activeLesson)} C={C} fs={fs} F={F} />
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
                          {[
                            (lesson.flashcards?.length ?? 0) > 0 && `${lesson.flashcards.length} cards`,
                            (lesson.quiz?.length ?? 0) > 0 && `${lesson.quiz.length} questions`,
                            lesson.diagram && 'diagram',
                          ].filter(Boolean).join(' · ') || 'article only'}
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
                        // Completed lesson — all available sections shown for review
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

                          {lesson.diagram && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openDiagram(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                                  <Ionicons name="git-branch-outline" size={16} color={C.primary} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Diagram</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>Visual concept overview</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={15} color={C.primary} />
                              </TouchableOpacity>
                            </>
                          )}

                          {(lesson.flashcards?.length ?? 0) > 0 && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openFlashcards(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                                  <Ionicons name="layers-outline" size={16} color={C.primary} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Flashcards</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                    {lesson.flashcards.length} cards
                                  </Text>
                                </View>
                                <Ionicons name="arrow-forward" size={15} color={C.primary} />
                              </TouchableOpacity>
                            </>
                          )}

                          {(lesson.quiz?.length ?? 0) > 0 && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openQuiz(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: `${GREEN}10`, borderColor: `${GREEN}20` }]}>
                                  <Ionicons name="help-circle-outline" size={16} color={GREEN} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Quiz</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                    {lesson.quiz.length} questions · Completed
                                  </Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      ) : (
                        // Incomplete lesson — article is the entry point, rest locked
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

                          {lesson.diagram && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openDiagram(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                                  <Ionicons name="git-branch-outline" size={16} color={C.muted} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Diagram</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>Visual concept overview</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={15} color={C.muted} />
                              </TouchableOpacity>
                            </>
                          )}

                          {(lesson.flashcards?.length ?? 0) > 0 && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openFlashcards(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                                  <Ionicons name="layers-outline" size={16} color={C.muted} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Flashcards</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                    {lesson.flashcards.length} cards to study
                                  </Text>
                                </View>
                                <Ionicons name="arrow-forward" size={15} color={C.muted} />
                              </TouchableOpacity>
                            </>
                          )}

                          {(lesson.quiz?.length ?? 0) > 0 && (
                            <>
                              <View style={[S.bodyDivider, { backgroundColor: C.border }]} />
                              <TouchableOpacity style={S.contentRow} onPress={() => openQuiz(lesson)} activeOpacity={0.75}>
                                <View style={[S.contentIcon, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                                  <Ionicons name="help-circle-outline" size={16} color={C.muted} />
                                </View>
                                <View style={{ flex: 1, gap: 2 }}>
                                  <Text style={[S.contentLabel, { fontFamily: F.semiBold, fontSize: fs(13), color: C.text }]}>Quiz</Text>
                                  <Text style={[S.contentSub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                                    {lesson.quiz.length} questions
                                  </Text>
                                </View>
                                <Ionicons name="arrow-forward" size={15} color={C.muted} />
                              </TouchableOpacity>
                            </>
                          )}
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
