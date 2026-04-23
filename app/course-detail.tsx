import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';

type Props = {
  courseId: Id<'courses'>;
  onBack: () => void;
  onStartLesson: () => void;
};

function topicColor(title: string): { emoji: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes('math') || t.includes('calculus') || t.includes('algebra'))
    return { emoji: '📐', color: '#7C3AED' };
  if (t.includes('history'))
    return { emoji: '🏛️', color: '#16A34A' };
  if (t.includes('science') || t.includes('physics') || t.includes('chem'))
    return { emoji: '⚗️', color: '#0EA5E9' };
  if (t.includes('biology') || t.includes('bio'))
    return { emoji: '🧬', color: '#0D9488' };
  if (t.includes('english') || t.includes('writing'))
    return { emoji: '✍️', color: '#EA580C' };
  if (t.includes('code') || t.includes('program'))
    return { emoji: '💻', color: '#6366F1' };
  if (t.includes('law') || t.includes('legal') || t.includes('bar') || t.includes('mbe') || t.includes('mee'))
    return { emoji: '⚖️', color: '#0EA5E9' };
  if (t.includes('finance') || t.includes('econ'))
    return { emoji: '📈', color: '#16A34A' };
  return { emoji: '📚', color: '#6366F1' };
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner:     '#16A34A',
  intermediate: '#D97706',
  advanced:     '#7C3AED',
};

function SkeletonLoader({ C, insets, onBack }: { C: AppColors; insets: any; onBack: () => void }) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const shimStyle = useAnimatedStyle(() => ({ opacity: 0.5 + shimmer.value * 0.4 }));

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <View style={[S.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity style={[S.backBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]} onPress={onBack}>
          <Ionicons name="arrow-back" size={19} color={C.muted} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Animated.View style={[S.skeletonHero, { backgroundColor: C.borderStrong }, shimStyle]} />
        <Animated.View style={[S.skeletonLine, { width: 160, backgroundColor: C.borderStrong }, shimStyle]} />
        <Animated.View style={[S.skeletonLine, { width: 100, backgroundColor: C.borderStrong }, shimStyle]} />
      </View>
    </View>
  );
}

export default function CourseDetailScreen({ courseId, onBack, onStartLesson }: Props) {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();

  const course  = useQuery(api.courses.get, { courseId }) as any;
  const rawLessons = useQuery(api.courses.getLessons, { courseId });
  const lessons = (rawLessons ?? []) as any[];

  const completed   = lessons.filter((l) => l.completed).length;
  const total       = lessons.length || course?.totalLessons || 0;
  const pct         = total > 0 ? completed / total : 0;
  const allDone     = total > 0 && completed === total;
  const nextLesson  = lessons.find((l) => !l.completed);
  const hasStarted  = completed > 0;

  const { emoji, color } = topicColor(course?.title ?? '');
  const diffColor = DIFFICULTY_COLOR[course?.difficulty ?? ''] ?? C.primary;

  const isLoading = course === undefined || rawLessons === undefined;

  if (isLoading) {
    return <SkeletonLoader C={C} insets={insets} onBack={onBack} />;
  }

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={[S.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[S.backBtn, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}
          onPress={() => { Haptics.selectionAsync(); onBack(); }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={19} color={C.muted} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { fontFamily: F.semiBold, fontSize: fs(16), color: C.text }]} numberOfLines={1}>
          {course?.title}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(260)} style={[S.hero, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View style={[S.heroIcon, { backgroundColor: `${color}14`, borderColor: `${color}28` }]}>
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          </View>

          <Text style={[S.heroTitle, { fontFamily: F.bold, fontSize: fs(22), color: C.text }]}>
            {course?.title}
          </Text>

          {/* Badges row */}
          <View style={S.badgeRow}>
            {course?.difficulty && (
              <View style={[S.badge, { backgroundColor: `${diffColor}14`, borderColor: `${diffColor}30` }]}>
                <Ionicons name="bar-chart-outline" size={11} color={diffColor} />
                <Text style={[S.badgeTxt, { fontFamily: F.semiBold, fontSize: fs(11), color: diffColor }]}>
                  {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
                </Text>
              </View>
            )}
            <View style={[S.badge, { backgroundColor: `${color}14`, borderColor: `${color}30` }]}>
              <Ionicons name="layers-outline" size={11} color={color} />
              <Text style={[S.badgeTxt, { fontFamily: F.semiBold, fontSize: fs(11), color }]}>
                {total} lesson{total !== 1 ? 's' : ''}
              </Text>
            </View>
            {allDone && (
              <View style={[S.badge, { backgroundColor: `${C.success}14`, borderColor: `${C.success}30` }]}>
                <Ionicons name="checkmark-circle" size={11} color={C.success} />
                <Text style={[S.badgeTxt, { fontFamily: F.semiBold, fontSize: fs(11), color: C.success }]}>
                  Complete
                </Text>
              </View>
            )}
          </View>

          {/* Progress */}
          {total > 0 && (
            <View style={S.progressWrap}>
              <View style={[S.progressBg, { backgroundColor: C.border }]}>
                <View style={[S.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: allDone ? C.success : C.primary }]} />
              </View>
              <Text style={[S.progressTxt, { fontFamily: F.medium, fontSize: fs(12), color: C.muted }]}>
                {completed} of {total} lessons complete
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── Lesson list ── */}
        {lessons.length > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(260)} style={S.section}>
            <Text style={[S.sectionCap, { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted }]}>
              LESSONS
            </Text>
            <View style={[S.lessonList, { backgroundColor: C.surface, borderColor: C.border }]}>
              {lessons.map((lesson: any, idx: number) => {
                const isNext   = lesson._id === nextLesson?._id;
                const isDone   = lesson.completed;
                const isLocked = !isDone && !isNext && idx > 0 && !lessons[idx - 1]?.completed;

                return (
                  <TouchableOpacity
                    key={lesson._id}
                    style={[
                      S.lessonRow,
                      idx < lessons.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => { Haptics.selectionAsync(); onStartLesson(); }}
                  >
                    {/* Number / status icon */}
                    <View style={[
                      S.lessonBullet,
                      isDone  && { backgroundColor: `${C.success}18`, borderColor: `${C.success}35` },
                      isNext  && { backgroundColor: `${C.primary}18`, borderColor: `${C.primary}35` },
                      !isDone && !isNext && { backgroundColor: C.surfaceAlt, borderColor: C.border },
                    ]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={14} color={C.success} />
                      ) : (
                        <Text style={[S.lessonNum, { fontFamily: F.bold, fontSize: fs(11), color: isNext ? C.primary : C.muted }]}>
                          {idx + 1}
                        </Text>
                      )}
                    </View>

                    {/* Title + key concept */}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[S.lessonTitle, {
                        fontFamily: isNext ? F.semiBold : F.medium,
                        fontSize: fs(14),
                        color: isDone ? C.muted : isNext ? C.text : C.sub,
                        textDecorationLine: isDone ? 'line-through' : 'none',
                      }]} numberOfLines={2}>
                        {lesson.title}
                      </Text>
                      {lesson.keyConcept ? (
                        <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]} numberOfLines={1}>
                          {lesson.keyConcept}
                        </Text>
                      ) : null}
                    </View>

                    {/* Right indicator */}
                    {isNext && (
                      <View style={[S.nextPill, { backgroundColor: `${C.primary}14` }]}>
                        <Text style={[{ fontFamily: F.extraBold, fontSize: fs(9), color: C.primary, letterSpacing: 0.5 }]}>
                          UP NEXT
                        </Text>
                      </View>
                    )}
                    {isDone && <Ionicons name="checkmark-circle" size={16} color={C.success} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={[S.footer, { backgroundColor: C.bg, borderTopColor: C.border, paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          style={[S.ctaBtn, { backgroundColor: allDone ? C.success : C.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onStartLesson(); }}
          activeOpacity={0.88}
        >
          <Ionicons
            name={allDone ? 'refresh-outline' : hasStarted ? 'play' : 'play'}
            size={18}
            color="#fff"
          />
          <Text style={[S.ctaTxt, { fontFamily: F.bold, fontSize: fs(16) }]}>
            {allDone ? 'Review Course' : hasStarted ? 'Continue Learning' : 'Start Learning'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroIcon: {
    width: 88, height: 88, borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: { textAlign: 'center', lineHeight: 30 },

  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeTxt: {},

  progressWrap: { width: '100%', gap: 6 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressTxt: { textAlign: 'center' },

  section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.sm },
  sectionCap: { letterSpacing: 1.4, paddingHorizontal: 2 },

  lessonList: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: 12,
  },
  lessonBullet: {
    width: 34, height: 34, borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  lessonNum: {},
  lessonTitle: { lineHeight: 19 },
  nextPill: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
  },
  ctaTxt: { color: '#fff' },

  skeletonHero: { width: 88, height: 88, borderRadius: 24 },
  skeletonLine: { height: 14, borderRadius: 7 },
});
