import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
const PURPLE = "#7C3AED";

function topicEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("math") || t.includes("calculus")) return "📐";
  if (t.includes("history")) return "🏛️";
  if (t.includes("science") || t.includes("physics")) return "⚗️";
  if (t.includes("biology")) return "🧬";
  if (t.includes("code") || t.includes("program")) return "💻";
  if (t.includes("law") || t.includes("legal")) return "⚖️";
  if (t.includes("finance") || t.includes("econ")) return "📈";
  return "📚";
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { goalConfig, dailyProgress } = useAppStore();

  const coursesRaw = (useQuery(api.courses.listWithProgress) ?? []) as any[];
  const courses = coursesRaw.filter((c: any) => c.status !== "error");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const goalTarget = goalConfig?.lessonTarget ?? 0;
  const goalPct =
    goalTarget > 0
      ? Math.min(100, Math.round((todayDone / goalTarget) * 100))
      : 0;
  const goalMet = goalTarget > 0 && todayDone >= goalTarget;

  const totalCompleted = courses.reduce(
    (s: number, c: any) => s + (c.completedCount ?? 0),
    0,
  );
  const totalLessons = courses.reduce(
    (s: number, c: any) => s + (c.lessonCount ?? 0),
    0,
  );
  const readyCourses = courses.filter((c: any) => c.status === "ready").length;

  return (
    <View style={[styles.root]}>
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Text
          style={[
            styles.headerTitle,
            { fontSize: fs(22), fontFamily: F.bold, color: C.text },
          ]}
        >
          Progress
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stat grid ── */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <Text
            style={[
              styles.cap,
              { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted },
            ]}
          >
            OVERVIEW
          </Text>
          <View style={styles.grid}>
            {[
              {
                icon: "book-outline",
                color: C.primary,
                value: String(readyCourses),
                label: "Courses",
              },
              {
                icon: "layers-outline",
                color: PURPLE,
                value: String(totalLessons),
                label: "Total Lessons",
              },
              {
                icon: "checkmark-circle-outline",
                color: GREEN,
                value: String(totalCompleted),
                label: "Completed",
              },
              {
                icon: "today-outline",
                color: GOLD,
                value: String(todayDone),
                label: "Done Today",
              },
            ].map(({ icon, color, value, label }) => (
              <View
                key={label}
                style={[
                  styles.statCard,
                  { backgroundColor: C.surface, borderColor: C.border },
                ]}
              >
                <View
                  style={[styles.statIcon, { backgroundColor: `${color}18` }]}
                >
                  <Ionicons name={icon as any} size={19} color={color} />
                </View>
                <Text
                  style={[
                    styles.statValue,
                    { fontFamily: F.bold, fontSize: fs(28), color: C.text },
                  ]}
                >
                  {value}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    { fontFamily: F.medium, fontSize: fs(12), color: C.sub },
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Daily goal ── */}
        {goalConfig && goalTarget > 0 && (
          <Animated.View entering={FadeInDown.delay(70).duration(260)}>
            <Text
              style={[
                styles.cap,
                { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted },
              ]}
            >
              TODAY'S GOAL
            </Text>
            <View
              style={[
                styles.goalCard,
                {
                  backgroundColor: C.surface,
                  borderColor: goalMet ? `${GREEN}40` : C.border,
                },
              ]}
            >
              <View style={styles.goalTop}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      styles.goalTitle,
                      {
                        fontFamily: F.semiBold,
                        fontSize: fs(16),
                        color: C.text,
                      },
                    ]}
                  >
                    {goalMet
                      ? "Goal complete! 🎯"
                      : `${todayDone} of ${goalTarget} lessons`}
                  </Text>
                  <Text
                    style={[
                      { fontFamily: F.regular, fontSize: fs(12), color: C.sub },
                    ]}
                  >
                    {goalMet
                      ? "Apps are unlocked"
                      : `${goalTarget - todayDone} lesson${goalTarget - todayDone !== 1 ? "s" : ""} to go`}
                  </Text>
                </View>
                <Text
                  style={[
                    {
                      fontFamily: F.bold,
                      fontSize: fs(12),
                      color: goalMet ? GREEN : C.primary,
                    },
                  ]}
                >
                  {goalPct}%
                </Text>
              </View>
              <View style={[styles.progressBg, { backgroundColor: C.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${goalPct}%` as any,
                      backgroundColor: goalMet ? GREEN : C.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.pipRow}>
                {Array.from({ length: goalTarget }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      {
                        backgroundColor: `${C.primary}25`,
                        borderColor: `${C.primary}40`,
                      },
                      i < todayDone && {
                        backgroundColor: C.primary,
                        borderColor: C.primary,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Course progress ── */}
        {courses.filter((c: any) => c.status === "ready").length > 0 && (
          <Animated.View entering={FadeInDown.delay(140).duration(260)}>
            <Text
              style={[
                styles.cap,
                { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted },
              ]}
            >
              COURSE PROGRESS
            </Text>
            <View
              style={[
                styles.courseList,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              {courses
                .filter((c: any) => c.status === "ready")
                .map((course: any, i: number, arr: any[]) => {
                  const completed = course.completedCount ?? 0;
                  const total = course.lessonCount ?? course.totalLessons ?? 0;
                  const pct =
                    total > 0 ? Math.round((completed / total) * 100) : 0;
                  const isFinished = total > 0 && completed === total;

                  return (
                    <View key={course._id}>
                      <View style={styles.courseRow}>
                        <View
                          style={[
                            styles.courseIcon,
                            {
                              backgroundColor: `${C.primary}14`,
                              borderColor: `${C.primary}25`,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 20 }}>
                            {topicEmoji(course.title)}
                          </Text>
                        </View>
                        <View style={styles.courseInfo}>
                          <Text
                            style={[
                              styles.courseTitle,
                              {
                                fontFamily: F.semiBold,
                                fontSize: fs(14),
                                color: C.text,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {course.title}
                          </Text>
                          <View
                            style={[
                              styles.courseProgressBg,
                              { backgroundColor: C.surfaceAlt },
                            ]}
                          >
                            <View
                              style={[
                                styles.courseProgressFill,
                                {
                                  width: `${pct}%` as any,
                                  backgroundColor: isFinished
                                    ? GREEN
                                    : C.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              {
                                fontFamily: F.regular,
                                fontSize: fs(11),
                                color: C.muted,
                              },
                            ]}
                          >
                            {completed} of {total} lessons
                            {isFinished ? " · Complete ✓" : ""}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.pctLabel,
                            {
                              fontFamily: F.bold,
                              fontSize: fs(13),
                              color: isFinished ? GREEN : C.primary,
                            },
                          ]}
                        >
                          {pct}%
                        </Text>
                      </View>
                      {i < arr.length - 1 && (
                        <View
                          style={[
                            styles.divider,
                            { backgroundColor: C.border, marginLeft: 56 },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
            </View>
          </Animated.View>
        )}

        {/* ── Generating ── */}
        {courses.filter((c: any) => c.status === "generating").length > 0 && (
          <Animated.View entering={FadeInDown.delay(180).duration(260)}>
            <Text
              style={[
                styles.cap,
                { fontFamily: F.extraBold, fontSize: fs(10), color: C.muted },
              ]}
            >
              GENERATING
            </Text>
            <View
              style={[
                styles.courseList,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              {courses
                .filter((c: any) => c.status === "generating")
                .map((course: any, i: number, arr: any[]) => (
                  <View key={course._id}>
                    <View style={styles.courseRow}>
                      <View
                        style={[
                          styles.courseIcon,
                          {
                            backgroundColor: `${GOLD}14`,
                            borderColor: `${GOLD}25`,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>⏳</Text>
                      </View>
                      <View style={styles.courseInfo}>
                        <Text
                          style={[
                            styles.courseTitle,
                            {
                              fontFamily: F.semiBold,
                              fontSize: fs(14),
                              color: C.text,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {course.title}
                        </Text>
                        <Text
                          style={[
                            {
                              fontFamily: F.regular,
                              fontSize: fs(11),
                              color: C.muted,
                            },
                          ]}
                        >
                          AI is generating your course…
                        </Text>
                      </View>
                    </View>
                    {i < arr.length - 1 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: C.border, marginLeft: 56 },
                        ]}
                      />
                    )}
                  </View>
                ))}
            </View>
          </Animated.View>
        )}

        {courses.length === 0 && (
          <Animated.View
            entering={FadeInDown.delay(70).duration(260)}
            style={styles.empty}
          >
            <Text style={{ fontSize: 44 }}>📈</Text>
            <Text
              style={[
                { fontFamily: F.semiBold, fontSize: fs(18), color: C.text },
              ]}
            >
              No data yet
            </Text>
            <Text
              style={[
                {
                  fontFamily: F.regular,
                  fontSize: fs(13),
                  color: C.muted,
                  textAlign: "center",
                  lineHeight: 20,
                },
              ]}
            >
              Upload a document from the Learn tab to start tracking your
              progress.
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
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {},
    content: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      gap: Spacing.lg,
    },
    cap: { letterSpacing: 1.4, marginBottom: Spacing.sm },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: {
      width: "47.5%",
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: Spacing.md,
      gap: 4,
    },
    statIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    statValue: { lineHeight: 34 },
    statLabel: {},

    goalCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    goalTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    goalTitle: {},
    progressBg: { height: 5, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 3 },
    pipRow: { flexDirection: "row", gap: 6 },
    pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },

    courseList: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    courseRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: 13,
      gap: 12,
    },
    courseIcon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    courseInfo: { flex: 1, gap: 5 },
    courseTitle: {},
    courseProgressBg: { height: 4, borderRadius: 2, overflow: "hidden" },
    courseProgressFill: { height: "100%", borderRadius: 2 },
    pctLabel: { minWidth: 36, textAlign: "right" },
    divider: { height: StyleSheet.hairlineWidth },

    empty: {
      alignItems: "center",
      paddingVertical: Spacing.xxl,
      gap: Spacing.md,
    },
  });
}
