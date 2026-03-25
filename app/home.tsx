import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily } from '../constants/theme';
import { Spacing } from '../constants/spacing';
import { useAppStore, type GoalConfig } from '../store/useAppStore';

const P = Colors.primary;

function topicMeta(title: string): { emoji: string; color: string } {
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
    return { emoji: '💻', color: P };
  if (t.includes('law') || t.includes('legal'))
    return { emoji: '⚖️', color: '#0EA5E9' };
  if (t.includes('finance') || t.includes('econ'))
    return { emoji: '📈', color: '#16A34A' };
  return { emoji: '📚', color: '#E8A020' };
}

function isTodayGoalDay(cfg: GoalConfig): boolean {
  const day = new Date().getDay(); // 0=Sun … 6=Sat
  if (cfg.frequency === 'daily') return true;
  if (cfg.frequency === 'weekdays') return day >= 1 && day <= 5;
  return cfg.customDays.includes(day);
}

function fmtLockTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { courses, goalConfig, dailyProgress } = useAppStore();

  const totalLessons   = courses.reduce((s, c) => s + c.lessons.length, 0);
  const totalCompleted = courses.reduce(
    (s, c) => s + c.lessons.filter((l) => l.completed).length,
    0,
  );

  // Daily goal state
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const goalDay   = goalConfig ? isTodayGoalDay(goalConfig) : false;
  const goalMet   = goalConfig ? todayDone >= goalConfig.lessonTarget : false;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.screenTitle}>Your Courses</Text>
        </View>
        {courses.length > 0 && (
          <View style={styles.statsPill}>
            <Text style={styles.statsPillText}>
              {totalCompleted}/{totalLessons} done
            </Text>
          </View>
        )}
      </View>

      {/* ── Daily goal banner ── */}
      {goalConfig && (
        <Animated.View entering={FadeInDown.duration(260)} style={[
          styles.goalBanner,
          goalMet && styles.goalBannerDone,
          !goalDay && styles.goalBannerRest,
        ]}>
          <View style={styles.goalBannerLeft}>
            <Text style={styles.goalBannerEmoji}>
              {!goalDay ? '😌' : goalMet ? '🎯' : '📖'}
            </Text>
            <View style={styles.goalBannerText}>
              <Text style={[styles.goalBannerTitle, goalMet && styles.goalBannerTitleDone]}>
                {!goalDay
                  ? 'Rest day'
                  : goalMet
                  ? 'Goal complete!'
                  : `Today's goal`}
              </Text>
              <Text style={styles.goalBannerSub}>
                {!goalDay
                  ? 'No lesson required today'
                  : goalMet
                  ? 'Apps are unlocked'
                  : `${todayDone}/${goalConfig.lessonTarget} lessons · locks at ${fmtLockTime(goalConfig.lockTime)}`}
              </Text>
            </View>
          </View>
          {goalDay && (
            <View style={styles.goalPips}>
              {Array.from({ length: goalConfig.lessonTarget }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.goalPip,
                    i < todayDone && styles.goalPipDone,
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Upload CTA ── */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <TouchableOpacity
            style={styles.uploadCard}
            activeOpacity={0.8}
            onPress={() =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
          >
            <View style={styles.uploadIconWrap}>
              <Text style={{ fontSize: 24 }}>📄</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.uploadTitle}>Upload a document</Text>
              <Text style={styles.uploadSub}>PDF, DOCX, or plain text</Text>
            </View>
            <View style={[styles.arrowBtn, { backgroundColor: `${P}18` }]}>
              <Ionicons name="arrow-forward" size={15} color={P} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Courses ── */}
        {courses.length === 0 ? (
          <Animated.View
            entering={FadeInDown.delay(80).duration(280)}
            style={styles.emptyState}
          >
            <View style={styles.emptyIconWrap}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
            </View>
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptySub}>
              Upload a document and Unloq turns it into a course you must
              finish before using your apps.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(80).duration(280)}
            style={styles.courseSection}
          >
            <Text style={styles.sectionCap}>MY COURSES</Text>

            <View style={styles.courseGroup}>
              {courses.map((course, idx) => {
                const completed = course.lessons.filter(
                  (l) => l.completed,
                ).length;
                const total = course.lessons.length;
                const pct =
                  total > 0 ? Math.round((completed / total) * 100) : 0;
                const { emoji, color } = topicMeta(course.title);

                return (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.courseCard,
                      idx < courses.length - 1 && styles.courseCardBorder,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => Haptics.selectionAsync()}
                  >
                    <View
                      style={[
                        styles.courseIconWrap,
                        {
                          backgroundColor: `${color}15`,
                          borderColor: `${color}30`,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </View>

                    <View style={styles.courseInfo}>
                      <Text style={styles.courseTitle} numberOfLines={2}>
                        {course.title}
                      </Text>

                      <View style={styles.courseTags}>
                        <View
                          style={[
                            styles.lessonBadge,
                            { backgroundColor: `${color}15` },
                          ]}
                        >
                          <Text
                            style={[styles.lessonBadgeText, { color }]}
                          >
                            {total} lessons
                          </Text>
                        </View>
                        <Text style={styles.metaSep}>·</Text>
                        <Text style={styles.docName} numberOfLines={1}>
                          {course.docName}
                        </Text>
                      </View>

                      <View style={styles.progressRow}>
                        <View style={styles.progressBg}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${pct}%` as any, backgroundColor: color },
                            ]}
                          />
                        </View>
                        <Text style={[styles.progressPct, { color }]}>
                          {pct}%
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.arrowBtn,
                        { backgroundColor: `${color}18` },
                      ]}
                    >
                      <Ionicons name="arrow-forward" size={15} color={color} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  greeting: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: FontFamily.extraBold,
    color: Colors.text,
  },
  statsPill: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statsPillText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    color: Colors.textMuted,
  },

  // Daily goal banner
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: `${P}0D`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${P}25`,
  },
  goalBannerDone: {
    backgroundColor: '#10B98110',
    borderColor: '#10B98130',
  },
  goalBannerRest: {
    backgroundColor: Colors.surface,
    borderColor: Colors.surfaceBorder,
  },
  goalBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  goalBannerEmoji: { fontSize: 22 },
  goalBannerText: { gap: 2, flex: 1 },
  goalBannerTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: P,
  },
  goalBannerTitleDone: { color: '#059669' },
  goalBannerSub: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
  },
  goalPips: { flexDirection: 'row', gap: 5, marginLeft: Spacing.sm },
  goalPip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: `${P}30`,
    borderWidth: 1,
    borderColor: `${P}50`,
  },
  goalPipDone: { backgroundColor: P, borderColor: P },

  // Scroll
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },

  // Upload card
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    shadowColor: P,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: `${P}12`,
    borderWidth: 1,
    borderColor: `${P}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTitle: { fontSize: 15, fontFamily: FontFamily.bold,     color: Colors.text },
  uploadSub:   { fontSize: 12, fontFamily: FontFamily.semiBold, color: Colors.textMuted },

  // Shared arrow button
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontFamily: FontFamily.bold,     color: Colors.text },
  emptySub: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: Spacing.md,
  },

  // Course section
  courseSection: { gap: Spacing.sm },
  sectionCap: {
    fontSize: 11,
    fontFamily: FontFamily.extraBold,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  courseGroup: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    shadowColor: P,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  courseCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  courseIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseInfo:  { flex: 1, gap: 5 },
  courseTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: Colors.text,
    lineHeight: 20,
  },
  courseTags: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lessonBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  lessonBadgeText: { fontSize: 10, fontFamily: FontFamily.extraBold },
  metaSep: { fontSize: 10, color: Colors.textSoft },
  docName: {
    flex: 1,
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBg: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPct: {
    fontSize: 11,
    fontFamily: FontFamily.extraBold,
    minWidth: 30,
    textAlign: 'right',
  },
});
