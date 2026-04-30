import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import React, { useState, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { Image } from 'react-native';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

import { useTheme } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { hasSelection } from '../lib/familyControls';
import { useAppStore, type GoalConfig } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';
import UploadScreen from './upload';
import StatsScreen from './stats';
import SettingsScreen from './settings';
import LessonPlayer from './lesson-player';
import CourseDetailScreen from './course-detail';
import AuthModal from './auth-modal';

type Tab = 'learn' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string; iconFilled: string }[] = [
  { id: 'learn',    label: 'Learn',    icon: 'book-outline',      iconFilled: 'book' },
  { id: 'stats',    label: 'Progress', icon: 'bar-chart-outline',  iconFilled: 'bar-chart' },
  { id: 'settings', label: 'Profile',  icon: 'person-outline',    iconFilled: 'person' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<string, string[]> = {
  "Bar Exam / Law school":        ["law", "bar", "mbe", "mee", "legal", "constitutional", "tort", "contracts"],
  "Medical student (boards)":     ["medical", "usmle", "anatomy", "physiology", "pharmacology", "pathology"],
  "Academic exam prep":           ["sat", "act", "gre", "gmat", "exam", "academic"],
  "Professional skills / career": ["business", "finance", "leadership", "management", "career"],
  "Language learning":            ["language", "spanish", "french", "english", "mandarin"],
  "Self-improvement / curiosity": [],
};

function courseMatchesRole(course: any, role: string | null): boolean {
  if (!role) return true;
  const keywords = ROLE_KEYWORDS[role] ?? [];
  if (keywords.length === 0) return false;
  const haystack = `${course.title} ${course.description ?? ''} ${course.course_topic ?? ''} ${(course.tags ?? []).join(' ')}`.toLowerCase();
  return keywords.some(kw => haystack.includes(kw));
}

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

function isTodayGoalDay(cfg: GoalConfig): boolean {
  const day = new Date().getDay();
  if (cfg.frequency === 'daily') return true;
  if (cfg.frequency === 'weekdays') return day >= 1 && day <= 5;
  return cfg.customDays.includes(day);
}

function fmtLockTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Bottom tab item ───────────────────────────────────────────────────────────

function TabItem({
  tab, active, onPress, C, F,
}: {
  tab: typeof TABS[number]; active: boolean; onPress: () => void; C: AppColors; F: any;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <TouchableOpacity
      style={tabStyles.item}
      onPress={() => {
        scale.value = withSpring(0.82, { damping: 12, stiffness: 500 }, () => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        });
        onPress();
      }}
      activeOpacity={0.8}
    >
      <Animated.View style={[tabStyles.inner, anim]}>
        {active && <View style={[tabStyles.pill, { backgroundColor: `${C.primary}14` }]} />}
        <Ionicons
          name={(active ? tab.iconFilled : tab.icon) as any}
          size={21}
          color={active ? C.primary : C.muted}
        />
        <Text style={[tabStyles.label, { fontFamily: active ? F.semiBold : F.regular, color: active ? C.primary : C.muted }]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const tabStyles = StyleSheet.create({
  item:  { flex: 1, alignItems: 'center' },
  inner: { alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 18, position: 'relative' },
  pill:  { position: 'absolute', inset: 0, borderRadius: 14 },
  label: { fontSize: 10, letterSpacing: 0.2 },
});

// ── Daily mission card ────────────────────────────────────────────────────────

function MissionCard({ goalConfig, todayDone, appsSelected, C, fs, F }: {
  goalConfig: GoalConfig; todayDone: number; appsSelected: boolean; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const goalDay = isTodayGoalDay(goalConfig);
  const goalMet = todayDone >= goalConfig.lessonTarget;
  const pct     = goalConfig.lessonTarget > 0
    ? Math.min(1, todayDone / goalConfig.lessonTarget) : 0;

  if (!goalDay) {
    return (
      <Animated.View entering={FadeInDown.duration(280)} style={[missionStyles.card, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
        <Text style={{ fontSize: 26 }}>😌</Text>
        <View style={{ flex: 1 }}>
          <Text style={[missionStyles.title, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>Rest day</Text>
          <Text style={[missionStyles.sub, { fontFamily: F.regular, fontSize: fs(12), color: C.muted }]}>No lessons required today</Text>
        </View>
      </Animated.View>
    );
  }

  if (!appsSelected && !goalMet) {
    return (
      <Animated.View entering={FadeInDown.duration(280)} style={[missionStyles.card, { backgroundColor: `${C.muted}08`, borderColor: `${C.muted}20` }]}>
        <View style={[missionStyles.iconWrap, { backgroundColor: `${C.muted}12` }]}>
          <Ionicons name="phone-portrait-outline" size={20} color={C.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[missionStyles.title, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>
            No apps blocked yet
          </Text>
          <Text style={[missionStyles.sub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
            Pick apps in Goal Setup to start locking
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      style={[missionStyles.card, {
        backgroundColor: goalMet ? `${C.success}0F` : `${C.primary}0C`,
        borderColor: goalMet ? `${C.success}30` : `${C.primary}28`,
      }]}
    >
      <View style={[missionStyles.iconWrap, { backgroundColor: goalMet ? `${C.success}18` : `${C.primary}18` }]}>
        <Ionicons
          name={goalMet ? 'lock-open-outline' : 'lock-closed-outline'}
          size={20}
          color={goalMet ? C.success : C.primary}
        />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={missionStyles.row}>
          <Text style={[missionStyles.title, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>
            {goalMet ? 'Apps unlocked' : 'Apps locked'}
          </Text>
          <Text style={[{ fontFamily: F.bold, fontSize: fs(13), color: goalMet ? C.success : C.primary }]}>
            {todayDone}/{goalConfig.lessonTarget}
          </Text>
        </View>
        <View style={[missionStyles.trackBg, { backgroundColor: goalMet ? `${C.success}25` : `${C.primary}20` }]}>
          <View style={[missionStyles.trackFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: goalMet ? C.success : C.primary }]} />
        </View>
        <Text style={[missionStyles.sub, { fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
          {goalMet
            ? 'Daily goal complete · great work'
            : `${goalConfig.lessonTarget - todayDone} more lesson${goalConfig.lessonTarget - todayDone !== 1 ? 's' : ''} · locks at ${fmtLockTime(goalConfig.lockTime)}`}
        </Text>
      </View>
    </Animated.View>
  );
}

const missionStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: Spacing.lg, marginVertical: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { lineHeight: 20 },
  sub: { lineHeight: 16 },
  trackBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
});


// ── Group accordion card (kept for potential future use) ─────────────────────

function GroupCard({ group, onCourseSelect, C, fs, F, initialOpen = false, isPremium, freeCourseId }: {
  group: { name: string; courses: any[] };
  onCourseSelect: (id: Id<'courses'>) => void;
  C: AppColors; fs: (n: number) => number; F: any;
  initialOpen?: boolean;
  isPremium: boolean;
  freeCourseId: string | null;
}) {
  const [open, setOpen] = useState(initialOpen);
  const rotation = useSharedValue(initialOpen ? 1 : 0);
  const chevronAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const toggle = () => {
    Haptics.selectionAsync();
    const next = !open;
    rotation.value = withSpring(next ? 1 : 0, { damping: 14, stiffness: 160 });
    setOpen(next);
  };

  const { emoji, color } = topicColor(group.name);
  const totalLessons = group.courses.reduce((s: number, c: any) => s + (c.totalLessons ?? 0), 0);

  return (
    <View style={[accordionStyles.card, { backgroundColor: C.surface, borderColor: open ? `${color}35` : C.border }]}>
      {/* ── Header (always visible) ── */}
      <TouchableOpacity style={accordionStyles.header} onPress={toggle} activeOpacity={0.75}>
        <View style={[accordionStyles.iconWrap, { backgroundColor: `${color}14`, borderColor: `${color}28` }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text, lineHeight: 20 }]} numberOfLines={2}>
            {group.name}
          </Text>
          <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
            {group.courses.length} course{group.courses.length !== 1 ? 's' : ''} · {totalLessons} lessons
          </Text>
        </View>
        <Animated.View style={chevronAnim}>
          <Ionicons name="chevron-down" size={18} color={C.muted} />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Expanded course rows ── */}
      {open && (
        <Animated.View entering={FadeInDown.duration(180)} style={[accordionStyles.courseList, { borderTopColor: C.border }]}>
          {group.courses.map((course: any, ci: number) => {
            const { color: cColor } = topicColor(course.title);
            const locked = !isPremium && course._id !== freeCourseId;
            return (
              <TouchableOpacity
                key={course._id}
                style={[
                  accordionStyles.courseRow,
                  ci < group.courses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                  locked && { opacity: 0.6 },
                ]}
                activeOpacity={0.72}
                onPress={async () => {
                  if (locked) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await RevenueCatUI.presentPaywall();
                  } else {
                    Haptics.selectionAsync();
                    onCourseSelect(course._id);
                  }
                }}
              >
                <View style={[accordionStyles.courseDot, { backgroundColor: `${cColor}18`, borderColor: `${cColor}35` }]}>
                  <Ionicons name={locked ? 'lock-closed' : 'book-outline'} size={13} color={locked ? C.muted : cColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[{ fontFamily: F.semiBold, fontSize: fs(13), color: locked ? C.muted : C.text }]} numberOfLines={1}>
                    {course.title}
                  </Text>
                  <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                    {locked ? 'Premium' : `${course.totalLessons} lessons`}
                  </Text>
                </View>
                <Ionicons name={locked ? 'lock-closed-outline' : 'chevron-forward'} size={14} color={C.muted} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

const accordionStyles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
  iconWrap: { width: 48, height: 48, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  courseList: { borderTopWidth: StyleSheet.hairlineWidth },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.md, paddingVertical: 13 },
  courseDot: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Courses content (unified: my courses + suggested) ────────────────────────

function CoursesContent({ onUpload, onCourseSelect, suggestedCourses, isPremium, C, fs, F }: {
  onUpload: () => void;
  onCourseSelect: (id: Id<'courses'>) => void;
  suggestedCourses: any[];
  isPremium: boolean;
  C: AppColors;
  fs: (n: number) => number;
  F: any;
}) {
  const styles = React.useMemo(() => makeSharedStyles(C), [C]);
  const rawCourses = useQuery(api.courses.listMine);
  const isLoading = rawCourses === undefined;
  const removeCourse = useMutation(api.courses.remove);

  const personalCourses = ((rawCourses ?? []) as any[]).filter((c: any) => c.status === 'ready');

  const handleCoursePress = async (course: any) => {
    if (course.status === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await removeCourse({ courseId: course._id as Id<'courses'> });
      onUpload();
    } else {
      Haptics.selectionAsync();
      onCourseSelect(course._id as Id<'courses'>);
    }
  };

  const handleLongPress = (course: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(course.title, 'What would you like to do?', [
      {
        text: 'Delete Course', style: 'destructive',
        onPress: () => Alert.alert('Delete Course', 'This will permanently delete the course and all its lessons.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete', style: 'destructive',
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await removeCourse({ courseId: course._id as Id<'courses'> });
            },
          },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (isLoading) {
    return (
      <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={[styles.skeletonIcon, { backgroundColor: C.borderStrong }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skeletonLine, { width: '55%', backgroundColor: C.borderStrong }]} />
              <View style={[styles.skeletonLine, { width: '35%', backgroundColor: C.borderStrong }]} />
            </View>
          </View>
        ))}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 12 }}>
      {/* Upload card */}
      <TouchableOpacity
        style={[styles.uploadCard, { backgroundColor: C.surface, borderColor: C.border }]}
        activeOpacity={0.78}
        onPress={onUpload}
      >
        <View style={[styles.uploadIcon, { backgroundColor: `${C.primary}12`, borderColor: `${C.primary}22` }]}>
          <Text style={{ fontSize: 22 }}>📄</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[{ fontFamily: F.semiBold, fontSize: fs(14), color: C.text }]}>
            Add study material
          </Text>
          <Text style={[{ fontFamily: F.regular, fontSize: fs(12), color: C.sub }]}>
            PDF · AI generates your lessons
          </Text>
        </View>
        <View style={[styles.arrowBtn, { backgroundColor: `${C.primary}14` }]}>
          <Ionicons name="add" size={16} color={C.primary} />
        </View>
      </TouchableOpacity>

      {/* My courses section */}
      {personalCourses.length > 0 && (
        <>
          {suggestedCourses.length > 0 && (
            <Text style={[{ fontFamily: F.semiBold, fontSize: fs(11), color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 2 }]}>
              Your Courses
            </Text>
          )}
          <View style={[{ backgroundColor: C.surface, borderColor: C.border, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }]}>
            {personalCourses.map((course: any, idx: number) => {
              const { emoji, color } = topicColor(course.title);
              return (
                <TouchableOpacity
                  key={course._id}
                  style={[
                    styles.courseRow,
                    idx < personalCourses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                  ]}
                  activeOpacity={0.72}
                  onPress={() => handleCoursePress(course)}
                  onLongPress={() => handleLongPress(course)}
                  delayLongPress={400}
                >
                  <View style={[styles.courseIcon, { backgroundColor: `${color}14`, borderColor: `${color}28` }]}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={styles.courseInfo}>
                    <Text style={[{ fontFamily: F.semiBold, fontSize: fs(14), color: C.text, lineHeight: 19 }]} numberOfLines={2}>
                      {course.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[{ borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: `${color}14` }]}>
                        <Text style={[{ fontSize: fs(10), fontFamily: F.semiBold, color }]}>{course.totalLessons} lessons</Text>
                      </View>
                      <Text style={[{ fontSize: fs(11), fontFamily: F.regular, color: C.muted, flex: 1 }]} numberOfLines={1}>
                        {course.docName}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={C.muted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Suggested courses section */}
      {suggestedCourses.length > 0 && (
        <Animated.View entering={FadeInDown.delay(80).duration(260)} style={{ gap: 8 }}>
          <Text style={[{ fontFamily: F.semiBold, fontSize: fs(11), color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 2 }]}>
            Suggested for You
          </Text>
          <View style={[{ backgroundColor: C.surface, borderColor: C.border, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }]}>
            {suggestedCourses.map((course: any, ci: number) => {
              const { emoji, color } = topicColor(course.title);
              const locked = !isPremium && ci > 0;
              return (
                <TouchableOpacity
                  key={course._id}
                  style={[
                    styles.courseRow,
                    ci < suggestedCourses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
                    locked && { opacity: 0.6 },
                  ]}
                  activeOpacity={0.72}
                  onPress={async () => {
                    if (locked) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      await RevenueCatUI.presentPaywall();
                    } else {
                      Haptics.selectionAsync();
                      onCourseSelect(course._id as Id<'courses'>);
                    }
                  }}
                >
                  <View style={[styles.courseIcon, { backgroundColor: `${color}14`, borderColor: `${color}28` }]}>
                    <Text style={{ fontSize: 20 }}>{locked ? '🔒' : emoji}</Text>
                  </View>
                  <View style={styles.courseInfo}>
                    <Text style={[{ fontFamily: F.semiBold, fontSize: fs(14), color: locked ? C.muted : C.text, lineHeight: 19 }]} numberOfLines={2}>
                      {course.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!locked && (
                        <View style={[{ borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: `${color}14` }]}>
                          <Text style={[{ fontSize: fs(10), fontFamily: F.semiBold, color }]}>{course.totalLessons} lessons</Text>
                        </View>
                      )}
                      <View style={[{ borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: `${C.primary}10` }]}>
                        <Text style={[{ fontSize: fs(10), fontFamily: F.semiBold, color: C.primary }]}>From Unloq</Text>
                      </View>
                      {locked && (
                        <Text style={[{ fontSize: fs(11), fontFamily: F.regular, color: C.muted }]}>Premium</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name={locked ? 'lock-closed-outline' : 'chevron-forward'} size={15} color={C.muted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* Empty state — shown only if no courses at all */}
      {personalCourses.length === 0 && suggestedCourses.length === 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(260)} style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: C.primaryBg, borderColor: C.border }]}>
            <Text style={{ fontSize: 34 }}>📄</Text>
          </View>
          <Text style={[styles.emptyTitle, { fontSize: fs(17), fontFamily: F.semiBold, color: C.text }]}>
            No courses yet
          </Text>
          <Text style={[styles.emptySub, { fontSize: fs(13), fontFamily: F.regular, color: C.sub }]}>
            Upload a PDF or YouTube link and AI will generate lessons for you.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Courses tab ──────────────────────────────────────────────────────────────

function CoursesTab({ onUpload, onCourseSelect, C, fs, F }: {
  onUpload: () => void; onCourseSelect: (id: Id<'courses'>) => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const { goalConfig, dailyProgress, onboardingRole } = useAppStore();
  const { isPremium } = useEntitlement();
  const viewer = useQuery(api.users.currentUser);
  const rawAdmin = useQuery(api.courses.listPublishedAdminCourses);
  const [appsSelected, setAppsSelected] = useState(true);

  React.useEffect(() => {
    hasSelection().then(setAppsSelected).catch(() => setAppsSelected(true));
  }, []);

  const suggestedCourses = useMemo(() => {
    const ready = ((rawAdmin ?? []) as any[]).filter((c: any) => c.status === 'ready');
    return ready.filter((c: any) => courseMatchesRole(c, onboardingRole));
  }, [rawAdmin, onboardingRole]);

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;

  return (
    <>
      {/* ── Top bar ── */}
      <View style={[headerStyles.bar, { borderBottomColor: C.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[headerStyles.greeting, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]}>
            Welcome back
          </Text>
          <Text style={[headerStyles.title, { fontSize: fs(22), fontFamily: F.bold, color: C.text }]} numberOfLines={1}>
            {viewer?.name?.split(' ')[0] ?? 'Your Courses'}
          </Text>
        </View>
        <View style={headerStyles.right}>
          {isPremium ? (
            <View style={[headerStyles.badge, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}30` }]}>
              <Ionicons name="star" size={10} color={C.primary} />
              <Text style={[{ fontFamily: F.extraBold, fontSize: fs(10), color: C.primary }]}>PRO</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const result = await RevenueCatUI.presentPaywall();
                if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
                  await Purchases.getCustomerInfo();
                }
              }}
              activeOpacity={0.8}
              style={[headerStyles.badge, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}22` }]}
            >
              <Ionicons name="flash-outline" size={10} color={C.primary} />
              <Text style={[{ fontFamily: F.bold, fontSize: fs(10), color: C.primary }]}>Upgrade</Text>
            </TouchableOpacity>
          )}
          {viewer?.image ? (
            <Image source={{ uri: viewer.image }} style={[headerStyles.avatar, { borderColor: C.border }]} />
          ) : viewer?.name ? (
            <View style={[headerStyles.avatarFallback, { backgroundColor: `${C.primary}18`, borderColor: C.border }]}>
              <Text style={[{ color: C.primary, fontFamily: F.bold, fontSize: fs(14) }]}>{viewer.name[0].toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Daily mission ── */}
      {goalConfig && <MissionCard goalConfig={goalConfig} todayDone={todayDone} appsSelected={appsSelected} C={C} fs={fs} F={F} />}

      {/* ── Course list ── */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <CoursesContent
          onUpload={onUpload}
          onCourseSelect={onCourseSelect}
          suggestedCourses={suggestedCourses}
          isPremium={isPremium}
          C={C} fs={fs} F={F}
        />
      </ScrollView>
    </>
  );
}

const headerStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  greeting: { letterSpacing: 0.6, marginBottom: 1 },
  title: {},
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});

// ── Root ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const { isConnected, networkLoading } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<Tab>('learn');
  const [showUpload, setShowUpload] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Id<'courses'> | null>(null);
  const [activeCourse, setActiveCourse] = useState<Id<'courses'> | null>(null);

  const handleUploadPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isAuthenticated) { setShowUpload(true); } else { setShowAuthModal(true); }
  };

  if (showUpload) return <UploadScreen onBack={() => setShowUpload(false)} />;
  if (activeCourse) return (
    <LessonPlayer
      courseId={activeCourse}
      onBack={() => { setActiveCourse(null); }}
    />
  );
  if (detailCourse) return (
    <CourseDetailScreen
      courseId={detailCourse}
      onBack={() => setDetailCourse(null)}
      onStartLesson={() => setActiveCourse(detailCourse)}
    />
  );

  const showOfflineBanner = !networkLoading && !isConnected;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {showOfflineBanner && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[rootStyles.networkBanner, { backgroundColor: C.warning }]}
        >
          <Ionicons name="wifi-outline" size={13} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: F.semiBold, fontSize: fs(12) }}>
            No internet connection
          </Text>
        </Animated.View>
      )}
      <View style={{ flex: 1 }}>
        {activeTab === 'learn'    && <CoursesTab onUpload={handleUploadPress} onCourseSelect={setDetailCourse} C={C} fs={fs} F={F} />}
        {activeTab === 'stats'    && <StatsScreen onOpenCourse={(id) => setDetailCourse(id)} />}
        {activeTab === 'settings' && <SettingsScreen onNavigateToCourses={() => setActiveTab('learn')} />}
      </View>

      <Animated.View
        entering={FadeIn.duration(300)}
        style={[rootStyles.tabBar, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: insets.bottom + 2 }]}
      >
        {TABS.map((tab) => (
          <TabItem
            key={tab.id} tab={tab} active={activeTab === tab.id}
            onPress={() => { if (activeTab !== tab.id) { Haptics.selectionAsync(); setActiveTab(tab.id); } }}
            C={C} F={F}
          />
        ))}
      </Animated.View>

      <AuthModal
        visible={showAuthModal}
        onDismiss={() => setShowAuthModal(false)}
        onAuthSuccess={() => { setShowAuthModal(false); setShowUpload(true); }}
      />
    </View>
  );
}

const rootStyles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  networkBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 7 },
});

// ── Shared styles ─────────────────────────────────────────────────────────────

function makeSharedStyles(_C: AppColors) {
  return StyleSheet.create({
    skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
    skeletonIcon: { width: 50, height: 50, borderRadius: 14 },
    skeletonLine: { height: 11, borderRadius: 6 },
    empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyIcon: { width: 72, height: 72, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: {},
    emptySub: { textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.md },
    uploadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
    uploadIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    arrowBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    courseRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, gap: 12 },
    courseIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    courseInfo: { flex: 1, gap: 5 },
  });
}
