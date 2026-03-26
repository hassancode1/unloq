import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';

const GOLD  = '#D97706';
const GREEN = '#16A34A';
const BLUE  = '#0EA5E9';
const TEAL  = '#0D9488';

function StatCard({
  icon,
  iconColor,
  iconBg,
  value,
  label,
  styles,
  fs,
  F,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  fs: (n: number) => number;
  F: any;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={19} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { fontSize: fs(28), fontFamily: F.bold }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: fs(12), fontFamily: F.medium }]}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { goalConfig, dailyProgress } = useAppStore();
  const courses = (useQuery(api.courses.list) ?? []) as any[];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const totalLessons = courses.reduce((s: number, c: any) => s + (c.totalLessons ?? 0), 0);
  const readyCourses = courses.filter((c: any) => c.status === 'ready').length;

  const goalTarget = goalConfig?.lessonTarget ?? 0;
  const goalPct = goalTarget > 0 ? Math.min(100, Math.round((todayDone / goalTarget) * 100)) : 0;
  const goalMet = goalTarget > 0 && todayDone >= goalTarget;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: fs(26), fontFamily: F.bold, color: C.text }]}>
          Progress
        </Text>
        <Text style={[styles.headerSub, { fontSize: fs(12), fontFamily: F.regular, color: C.muted }]}>
          تقدمك في طلب العلم
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2×2 stat grid ── */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <Text style={[styles.cap, { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted }]}>
            Overview
          </Text>
          <View style={styles.grid}>
            <StatCard icon="book-outline"             iconColor={C.primary} iconBg={`${C.primary}18`} value={String(courses.length)} label="Courses"       styles={styles} fs={fs} F={F} />
            <StatCard icon="layers-outline"           iconColor={TEAL}      iconBg={`${TEAL}22`}      value={String(totalLessons)} label="Total Lessons"   styles={styles} fs={fs} F={F} />
            <StatCard icon="checkmark-circle-outline" iconColor={GREEN}     iconBg={`${GREEN}18`}     value={String(readyCourses)} label="Ready"           styles={styles} fs={fs} F={F} />
            <StatCard icon="today-outline"            iconColor={GOLD}      iconBg={`${GOLD}20`}      value={String(todayDone)}    label="Done Today"      styles={styles} fs={fs} F={F} />
          </View>
        </Animated.View>

        {/* ── Daily goal ── */}
        {goalConfig && goalTarget > 0 && (
          <Animated.View entering={FadeInDown.delay(70).duration(260)}>
            <Text style={[styles.cap, { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted }]}>
              Today's Goal
            </Text>
            <View style={[styles.goalCard, goalMet && { borderColor: `${GREEN}40` }]}>
              <View style={styles.goalTop}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.goalTitle, { fontSize: fs(16), fontFamily: F.semiBold, color: C.text }]}>
                    {goalMet ? 'Goal complete! 🎯' : `${todayDone} of ${goalTarget} lessons`}
                  </Text>
                  <Text style={[styles.goalSub, { fontSize: fs(12), fontFamily: F.regular, color: C.sub }]}>
                    {goalMet ? 'Apps are unlocked' : `${goalTarget - todayDone} lesson${goalTarget - todayDone !== 1 ? 's' : ''} to go`}
                  </Text>
                </View>
                <Text style={[styles.goalPct, { fontSize: fs(22), fontFamily: F.bold, color: goalMet ? GREEN : C.primary }]}>
                  {goalPct}%
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${goalPct}%` as any, backgroundColor: goalMet ? GREEN : C.primary },
                  ]}
                />
              </View>
              <View style={styles.pipRow}>
                {Array.from({ length: goalTarget }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      { backgroundColor: `${C.primary}25`, borderColor: `${C.primary}40` },
                      i < todayDone && { backgroundColor: C.primary, borderColor: C.primary },
                    ]}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Courses ── */}
        {courses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(260)}>
            <Text style={[styles.cap, { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted }]}>
              Courses
            </Text>
            <View style={styles.courseList}>
              {courses.map((course: any, i: number) => {
                const isReady      = course.status === 'ready';
                const isGenerating = course.status === 'generating';
                const statusColor  = isReady ? GREEN : isGenerating ? GOLD : C.error;
                const statusLabel  = isReady ? 'Ready' : isGenerating ? 'Generating…' : 'Error';

                return (
                  <View key={course._id}>
                    <View style={styles.courseRow}>
                      <View style={[styles.courseIcon, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}28` }]}>
                        <Text style={{ fontSize: 20 }}>📚</Text>
                      </View>
                      <View style={styles.courseInfo}>
                        <Text style={[styles.courseTitle, { fontSize: fs(14), fontFamily: F.semiBold, color: C.text }]} numberOfLines={1}>
                          {course.title}
                        </Text>
                        <Text style={[styles.courseSub, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]} numberOfLines={1}>
                          {course.docName} · {course.totalLessons} lessons
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                        <Text style={[styles.statusTxt, { fontSize: fs(11), fontFamily: F.semiBold, color: statusColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    {i < courses.length - 1 && (
                      <View style={[styles.divider, { marginLeft: 56 }]} />
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Empty ── */}
        {courses.length === 0 && (
          <Animated.View entering={FadeInDown.delay(70).duration(260)} style={styles.empty}>
            <Text style={{ fontSize: 44 }}>📈</Text>
            <Text style={[styles.emptyTitle, { fontSize: fs(18), fontFamily: F.semiBold, color: C.text }]}>
              No data yet
            </Text>
            <Text style={[styles.emptySub, { fontSize: fs(13), fontFamily: F.regular, color: C.muted }]}>
              Upload a document from the Learn tab to track your progress.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    headerTitle: {},
    headerSub: { marginTop: 2, letterSpacing: 0.4 },
    content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.lg },
    cap: {
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      paddingHorizontal: 2,
      marginBottom: Spacing.sm,
    },

    // Grid
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      width: '47.5%',
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 1,
    },
    statIconWrap: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    statValue: { lineHeight: 34 },
    statLabel: { color: C.sub },

    // Goal card
    goalCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 1,
    },
    goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    goalTitle: {},
    goalSub: { marginTop: 1 },
    goalPct: {},
    progressBg: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    pipRow: { flexDirection: 'row', gap: 6 },
    pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },

    // Course list
    courseList: {
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 1,
    },
    courseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 13,
      gap: 12,
    },
    courseIcon: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    courseInfo: { flex: 1, gap: 3 },
    courseTitle: {},
    courseSub: {},
    statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusTxt: {},
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },

    // Empty
    empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyTitle: {},
    emptySub: { textAlign: 'center', lineHeight: 20, maxWidth: 250 },
  });
}
