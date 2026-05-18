import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import React, { useState, useMemo } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { CardGradients } from '../constants/Colors';
import UploadScreen from './upload';
import SettingsScreen from './settings';
import LessonPlayer from './lesson-player';
import CourseDetailScreen from './course-detail';
import PdfViewerScreen from './pdf-viewer';
import AuthModal from './auth-modal';
import BottomTabBar, { type HomeTab } from '../components/BottomTabBar';
import GradientCard from '../components/GradientCard';
import CreateModal, { type CreateOptionKey } from '../components/CreateModal';

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


// ── No apps blocked banner ────────────────────────────────────────────────────

function NoAppsBlockedBanner({ width, isDark, onSetup }: {
  width: number; isDark: boolean; onSetup: () => void;
}) {
  return (
    <GradientCard
      width={width}
      title="No apps blocked yet"
      subtitle="Set up your goal to start locking distractions"
      gradientColors={CardGradients.indigo}
      onPress={onSetup}
      actionLabel="Set up Goal"
      isDark={isDark}
      imageSource={require('../assets/lock-banner.png')}
    />
  );
}

// ── Daily mission card ────────────────────────────────────────────────────────

function MissionCard({ goalConfig, todayDone, C, fs, F }: {
  goalConfig: GoalConfig; todayDone: number; C: AppColors; fs: (n: number) => number; F: any;
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

// ── Home tab ─────────────────────────────────────────────────────────────────

function HomeTabContent({ onUpload, onCourseSelect, onSeeAll, onGoalSetup, C, fs, F, isDark }: {
  onUpload: () => void; onCourseSelect: (id: Id<'courses'>) => void; onSeeAll: () => void; onGoalSetup: () => void;
  C: AppColors; fs: (n: number) => number; F: any; isDark: boolean;
}) {
  const styles = React.useMemo(() => makeSharedStyles(C), [C]);
  const { goalConfig, dailyProgress, onboardingRole } = useAppStore();
  const { isPremium } = useEntitlement();
  const viewer = useQuery(api.users.currentUser);
  const rawCourses = useQuery(api.courses.listMine);
  const isCoursesLoading = rawCourses === undefined;
  const personalCourses = (rawCourses ?? []) as any[];
  const [appsSelected, setAppsSelected] = useState(true);

  React.useEffect(() => {
    hasSelection().then(setAppsSelected).catch(() => setAppsSelected(true));
  }, []);

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const lessonTarget = goalConfig?.lessonTarget ?? 1;
  const goalMet = todayDone >= lessonTarget;
  const firstName = viewer?.name?.split(' ')[0] ?? 'Learner';

  const cardWidth = Dimensions.get('window').width - Spacing.lg * 2;
  const recentCourses = personalCourses.slice(0, 3);
  const continueCourse = personalCourses.find((c: any) => c.status === 'ready');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
      {/* ── Header ── */}
      <View style={[headerStyles.bar, { borderBottomColor: C.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[headerStyles.greeting, { fontSize: fs(12), fontFamily: F.regular, color: C.muted }]}>
            {greeting}
          </Text>
          <Text style={[headerStyles.title, { fontSize: fs(22), fontFamily: F.bold, color: C.text }]} numberOfLines={1}>
            Hi, {firstName}!
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

      {/* ── Gradient cards ── */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: 12 }}>
        <GradientCard
          width={cardWidth}
          title="Create a note"
          subtitle="Upload a PDF and AI generates your lessons"
          gradientColors={CardGradients.salmon}
          onPress={onUpload}
          actionLabel="Get started"
          isDark={isDark}
          imageSource={require('../assets/create-note-mascot.png')}
        />
        {!appsSelected
          ? <NoAppsBlockedBanner width={cardWidth} isDark={isDark} onSetup={onGoalSetup} />
          : goalConfig && <MissionCard goalConfig={goalConfig} todayDone={todayDone} C={C} fs={fs} F={F} />
        }
      </View>

      {/* ── My Courses loading skeleton ── */}
      {isCoursesLoading && (
        <Animated.View entering={FadeInDown.delay(80).duration(260)} style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: 10 }}>
          <View style={{ height: 24, width: 130, borderRadius: 8, backgroundColor: C.borderStrong, marginBottom: 4 }} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.borderStrong }} />
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.borderStrong }} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ height: 13, width: '60%', borderRadius: 6, backgroundColor: C.borderStrong }} />
                <View style={{ height: 11, width: '35%', borderRadius: 6, backgroundColor: C.borderStrong }} />
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── Continue Learning (most recent course only) ── */}
      {!isCoursesLoading && continueCourse && (
        <Animated.View entering={FadeInDown.delay(80).duration(260)} style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
          <Text style={[{ fontFamily: F.extraBold, fontSize: fs(20), color: C.text, letterSpacing: -0.3, marginBottom: 10 }]}>
            Continue Learning
          </Text>
          {(() => {
            const { emoji, color } = topicColor(continueCourse.title);
            const isGenerating = continueCourse.status === 'generating';
            return (
              <TouchableOpacity
                style={[{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  padding: 14, borderRadius: 16,
                  backgroundColor: C.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: C.border,
                }]}
                activeOpacity={0.7}
                onPress={() => { Haptics.selectionAsync(); onCourseSelect(continueCourse._id as Id<'courses'>); }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: `${color}18`, borderWidth: 1, borderColor: `${color}30`,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 22 }}>{isGenerating ? '⏳' : emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[{ fontFamily: F.bold, fontSize: fs(14), color: C.text, lineHeight: 19 }]} numberOfLines={1}>
                    {continueCourse.title}
                  </Text>
                  <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                    {isGenerating ? 'Generating…' : `${continueCourse.totalLessons ?? 0} lessons`}
                  </Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}14`, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="arrow-forward" size={15} color={color} />
                </View>
              </TouchableOpacity>
            );
          })()}
        </Animated.View>
      )}

      {/* Empty state */}
      {!isCoursesLoading && personalCourses.length === 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(260)} style={[styles.empty, { marginTop: Spacing.lg }]}>
          <View style={[styles.emptyIcon, { backgroundColor: C.primaryBg, borderColor: C.border }]}>
            <Text style={{ fontSize: 34 }}>📄</Text>
          </View>
          <Text style={[styles.emptyTitle, { fontSize: fs(17), fontFamily: F.semiBold, color: C.text }]}>
            No courses yet
          </Text>
          <Text style={[styles.emptySub, { fontSize: fs(13), fontFamily: F.regular, color: C.sub }]}>
            Tap + to upload a PDF and AI will generate lessons for you.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ── Create folder sheet ───────────────────────────────────────────────────────

function CreateFolderSheet({ visible, onDismiss, onCreated, C, fs, F }: {
  visible: boolean; onDismiss: () => void; onCreated: (folderId: string) => void;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const [name, setName] = useState('');
  const createFolder = useMutation(api.courses.createFolder);
  const MAX = 25;

  const handleCreate = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const folderId = await createFolder({ name: name.trim() });
    setName('');
    onCreated(folderId as string);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md }}>
          <TouchableOpacity onPress={() => { setName(''); onDismiss(); }} style={{ position: 'absolute', left: Spacing.lg }}>
            <Text style={{ fontFamily: F.regular, fontSize: fs(16), color: C.text }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: F.bold, fontSize: fs(17), color: C.text }}>Create Folder</Text>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
          <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="folder" size={44} color="#7C6FF7" />
          </View>
        </View>

        <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
          <Text style={{ fontFamily: F.bold, fontSize: fs(17), color: C.text }}>Folder Name</Text>
          <TextInput
            style={{
              borderRadius: 12, borderWidth: 1, borderColor: C.border,
              backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 14,
              fontFamily: F.regular, fontSize: fs(15), color: C.text,
            }}
            placeholder="Enter folder name"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={t => setName(t.slice(0, MAX))}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted, textAlign: 'right' }}>{name.length}/{MAX}</Text>
        </View>

        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!name.trim()}
            activeOpacity={0.8}
            style={{
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              backgroundColor: name.trim() ? C.text : C.borderStrong,
            }}
          >
            <Ionicons name="folder-open" size={18} color={name.trim() ? C.bg : C.muted} />
            <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: name.trim() ? C.bg : C.muted }}>Create Folder</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Folder picker sheet ───────────────────────────────────────────────────────

function FolderPickerSheet({ visible, folders, activeFolderId, onSelect, onDismiss, onCreateFolder, C, fs, F }: {
  visible: boolean; folders: any[]; activeFolderId: string | null;
  onSelect: (id: string | null) => void; onDismiss: () => void; onCreateFolder: () => void;
  C: AppColors; fs: (n: number) => number; F: any;
}) {
  const deleteFolder = useMutation(api.courses.deleteFolder);
  const [folderContextMenu, setFolderContextMenu] = useState<any>(null);

  const handleDelete = (folder: any) => {
    Alert.alert(`Delete "${folder.name}"?`, 'Courses in this folder will move to All Notes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteFolder({ folderId: folder._id });
          if (activeFolderId === folder._id) onSelect(null);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (folderContextMenu) { setFolderContextMenu(null); } else { onDismiss(); }
      }}
    >
      {folderContextMenu ? (
        /* ── Context menu state: dark overlay + action sheet ── */
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFolderContextMenu(null)} />
          <Animated.View
            entering={FadeInDown.duration(220)}
            style={{ marginHorizontal: 14, marginBottom: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(124,111,247,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="folder" size={22} color="#7C6FF7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>{folderContextMenu.name}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }}>Folder</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 }}
              onPress={() => {
                const folder = folderContextMenu;
                setFolderContextMenu(null);
                setTimeout(() => handleDelete(folder), 300);
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </View>
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(16), color: '#EF4444' }}>Delete Folder</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={{ marginHorizontal: 14, marginBottom: 36, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: C.surface }}
            activeOpacity={0.75}
            onPress={() => setFolderContextMenu(null)}
          >
            <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: C.text }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Normal picker state ── */
        <>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onDismiss} />
          <View style={[libStyles.pickerSheet, { backgroundColor: C.surface }]}>
            <View style={[libStyles.pickerHandle, { backgroundColor: C.borderStrong }]} />
            {/* All Notes row */}
            <TouchableOpacity
              style={[libStyles.pickerRow, { borderBottomColor: C.border }]}
              onPress={() => { onSelect(null); onDismiss(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="albums-outline" size={20} color={C.text} />
              <Text style={[libStyles.pickerRowTxt, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]}>All Notes</Text>
              {!activeFolderId && <Ionicons name="checkmark" size={18} color={C.text} />}
            </TouchableOpacity>
            {/* Folder rows — three-dot is a sibling touchable, not nested */}
            {folders.map((f: any) => (
              <View key={f._id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 15 }}
                  onPress={() => { onSelect(f._id); onDismiss(); }}
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFolderContextMenu(f); }}
                  delayLongPress={400}
                  activeOpacity={0.7}
                >
                  <Ionicons name="folder" size={20} color="#7C6FF7" />
                  <Text style={[libStyles.pickerRowTxt, { fontFamily: F.semiBold, fontSize: fs(15), color: C.text }]} numberOfLines={1}>{f.name}</Text>
                  {activeFolderId === f._id && <Ionicons name="checkmark" size={18} color={C.text} />}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setFolderContextMenu(f); }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ paddingHorizontal: Spacing.lg, paddingVertical: 15 }}
                >
                  <Ionicons name="ellipsis-vertical" size={17} color={C.muted} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[libStyles.pickerNewFolder, { borderTopColor: C.border }]}
              onPress={() => { onDismiss(); onCreateFolder(); }}
              activeOpacity={0.7}
            >
              <View style={[libStyles.pickerAddIcon, { backgroundColor: C.surfaceAlt }]}>
                <Ionicons name="add" size={18} color={C.text} />
              </View>
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }}>New Folder</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Modal>
  );
}

// ── Library tab ───────────────────────────────────────────────────────────────

function LibraryTab({ onCourseSelect, onUpload, C, fs, F }: {
  onCourseSelect: (id: Id<'courses'>) => void; onUpload: () => void; C: AppColors; fs: (n: number) => number; F: any;
}) {
  const [query, setQuery] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [contextMenuCourse, setContextMenuCourse] = useState<any>(null);
  const removeCourse = useMutation(api.courses.remove);
  const rawLibCourses = useQuery(api.courses.listMine);
  const isLibLoading = rawLibCourses === undefined;
  const personalCourses = (rawLibCourses ?? []) as any[];
  const folders = (useQuery(api.courses.listFolders) ?? []) as any[];

  const activeFolderName = (folders as any[]).find((f: any) => f._id === activeFolderId)?.name ?? null;

  const filtered = useMemo(() => {
    let list = personalCourses;
    if (activeFolderId) list = list.filter((c: any) => c.folderId === activeFolderId);
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((c: any) => c.title?.toLowerCase().includes(q)); }
    return list;
  }, [personalCourses, query, activeFolderId]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[headerStyles.bar, { borderBottomColor: C.border }]}>
        <Text style={[{ fontFamily: F.bold, fontSize: fs(24), color: C.text }]}>My Library</Text>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setShowFolderPicker(true); }}
          activeOpacity={0.75}
          style={[libStyles.folderChip, { backgroundColor: C.surface, borderColor: C.border }]}
        >
          <Ionicons name="folder" size={15} color="#7C6FF7" />
          <Text style={[libStyles.folderChipTxt, { color: C.text, maxWidth: 90 }]} numberOfLines={1}>
            {activeFolderName ?? 'All Notes'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={C.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
        <View style={[libStyles.searchBar, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search-outline" size={16} color={C.muted} />
          <TextInput
            style={[libStyles.searchInput, { fontFamily: F.regular, fontSize: fs(14), color: C.text }]}
            placeholder="Search your notes..."
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: 8 }}
      >
        {isLibLoading && [1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md, backgroundColor: C.surface, borderColor: C.border }}>
            <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.borderStrong }} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ height: 11, borderRadius: 6, width: '55%', backgroundColor: C.borderStrong }} />
              <View style={{ height: 11, borderRadius: 6, width: '35%', backgroundColor: C.borderStrong }} />
            </View>
          </View>
        ))}
        {!isLibLoading && filtered.map((course: any) => {
          const { emoji, color } = topicColor(course.title);
          const date = new Date(course._creationTime).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
          });
          const isGenerating = course.status === 'generating';
          return (
            <View key={course._id} style={{ marginBottom: 3, opacity: isGenerating ? 0.6 : 1 }}>
              {/* Duo shadow */}
              <View style={{
                position: 'absolute', bottom: -3, left: 0, right: 0, top: 0,
                borderRadius: 16, backgroundColor: C.text,
              }} />
              {/* Card */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: C.surface,
                borderWidth: 2, borderColor: C.text,
                borderRadius: 16,
                transform: [{ translateY: -3 }],
              }}>
                {/* Main tap area */}
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 }}
                  activeOpacity={0.85}
                  onPress={() => { Haptics.selectionAsync(); if (!isGenerating) onCourseSelect(course._id as Id<'courses'>); }}
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setContextMenuCourse(course); }}
                  delayLongPress={400}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: `${color}18`, borderWidth: 1.5, borderColor: `${color}35`,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 22 }}>{isGenerating ? '⏳' : emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[{ fontFamily: F.extraBold, fontSize: fs(14), color: C.text, lineHeight: 19 }]} numberOfLines={1}>
                      {course.title}
                    </Text>
                    <Text style={[{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }]}>
                      {isGenerating ? 'Generating…' : date}
                    </Text>
                  </View>
                </TouchableOpacity>
                {/* Three-dot button — sibling, not nested */}
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); setContextMenuCourse(course); }}
                  hitSlop={8}
                  style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!isLibLoading && filtered.length === 0 && (
          activeFolderId && !query.trim() ? (
            <TouchableOpacity
              onPress={onUpload}
              activeOpacity={0.75}
              style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, borderRadius: 16, paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md }}
            >
              <Ionicons name="document-text-outline" size={36} color={C.muted} />
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(14), color: C.muted }}>Create your first note</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View entering={FadeInDown.duration(260)} style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.primaryBg, borderColor: C.border }}>
                <Text style={{ fontSize: 34 }}>📚</Text>
              </View>
              <Text style={{ fontSize: fs(16), fontFamily: F.semiBold, color: C.text }}>
                {query.trim() ? 'No results found' : 'Your library is empty'}
              </Text>
              <Text style={{ fontSize: fs(13), fontFamily: F.regular, color: C.sub, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.md }}>
                {query.trim() ? 'Try a different search' : 'Tap + to add your first course'}
              </Text>
            </Animated.View>
          )
        )}
      </ScrollView>

      <FolderPickerSheet
        visible={showFolderPicker}
        folders={folders}
        activeFolderId={activeFolderId}
        onSelect={setActiveFolderId}
        onDismiss={() => setShowFolderPicker(false)}
        onCreateFolder={() => setShowCreateFolder(true)}
        C={C} fs={fs} F={F}
      />
      <CreateFolderSheet
        visible={showCreateFolder}
        onDismiss={() => setShowCreateFolder(false)}
        onCreated={(folderId) => { setActiveFolderId(folderId); setShowCreateFolder(false); }}
        C={C} fs={fs} F={F}
      />

      {/* ── Course context menu ── */}
      {contextMenuCourse && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setContextMenuCourse(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setContextMenuCourse(null)} />
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{ marginHorizontal: 14, marginBottom: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface }}
            >
              {/* Course header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
                {(() => { const { emoji, color } = topicColor(contextMenuCourse.title); return (
                  <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: `${color}18`, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 21 }}>{emoji}</Text>
                  </View>
                ); })()}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: fs(14), color: C.text }} numberOfLines={1}>{contextMenuCourse.title}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: fs(11), color: C.muted }}>{contextMenuCourse.totalLessons ?? 0} lessons</Text>
                </View>
              </View>
              {/* Delete action */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 }}
                onPress={() => {
                  const course = contextMenuCourse;
                  setContextMenuCourse(null);
                  setTimeout(() => {
                    Alert.alert('Delete Course', 'This will permanently delete the course and all its lessons.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive',
                        onPress: async () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          await removeCourse({ courseId: course._id as Id<'courses'> });
                        },
                      },
                    ]);
                  }, 250);
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </View>
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(16), color: '#EF4444' }}>Delete Course</Text>
              </TouchableOpacity>
            </Animated.View>
            {/* Cancel pill */}
            <TouchableOpacity
              style={{ marginHorizontal: 14, marginBottom: 36, borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: C.surface }}
              activeOpacity={0.75}
              onPress={() => setContextMenuCourse(null)}
            >
              <Text style={{ fontFamily: F.bold, fontSize: fs(16), color: C.text }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const libStyles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, paddingTop: 0 },
  folderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  folderChipTxt: { fontSize: 13, fontFamily: 'Nunito-SemiBold' },
  pickerSheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: 36,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowTxt: { flex: 1 },
  pickerNewFolder: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },
  pickerAddIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
});

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
  const { C, fs, F, isDark } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const { setFlow } = useAppStore();
  const { isConnected, networkLoading } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSourceTab, setCreateSourceTab] = useState<'pdf' | 'youtube' | 'text' | 'capture'>('pdf');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Id<'courses'> | null>(null);
  const [activeCourse, setActiveCourse] = useState<Id<'courses'> | null>(null);
  const [playerMode, setPlayerMode] = useState<'flashcards' | 'quiz' | 'diagram' | undefined>(undefined);
  const [pdfView, setPdfView] = useState<{ url: string; title: string } | null>(null);

  const handleCreateOption = (opt: CreateOptionKey) => {
    setShowCreateModal(false);
    const tab = opt === 'youtube' ? 'youtube' : opt === 'text' ? 'text' : opt === 'capture' ? 'capture' : 'pdf';
    setCreateSourceTab(tab);
    if (isAuthenticated) { setShowUpload(true); } else { setShowAuthModal(true); }
  };

  const handleCreatePress = () => {
    if (isAuthenticated) { setShowCreateModal(true); } else { setShowAuthModal(true); }
  };

  if (showUpload) return (
    <UploadScreen
      onBack={() => setShowUpload(false)}
      initialSourceTab={createSourceTab}
      onGenerated={(courseId) => {
        setShowUpload(false);
        setDetailCourse(courseId as Id<'courses'>);
      }}
    />
  );
  if (pdfView) return (
    <PdfViewerScreen url={pdfView.url} title={pdfView.title} onBack={() => setPdfView(null)} />
  );
  if (activeCourse) return (
    <LessonPlayer
      courseId={activeCourse}
      initialView={playerMode}
      onBack={() => { setActiveCourse(null); setPlayerMode(undefined); }}
    />
  );
  if (detailCourse) return (
    <CourseDetailScreen
      courseId={detailCourse}
      onBack={() => setDetailCourse(null)}
      onOpenFlashcards={() => { setPlayerMode('flashcards'); setActiveCourse(detailCourse); }}
      onOpenQuiz={() => { setPlayerMode('quiz'); setActiveCourse(detailCourse); }}
      onOpenDiagram={() => { setPlayerMode('diagram'); setActiveCourse(detailCourse); }}
      onOpenPdf={(url, title) => setPdfView({ url, title })}
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
        {activeTab === 'home' && (
          <HomeTabContent
            onUpload={() => { if (isAuthenticated) { setShowCreateModal(true); } else { setShowAuthModal(true); } }}
            onCourseSelect={setDetailCourse}
            onSeeAll={() => setActiveTab('library')}
            onGoalSetup={() => setFlow('goalsetup')}
            C={C} fs={fs} F={F} isDark={isDark}
          />
        )}
        {activeTab === 'library' && (
          <LibraryTab
            onCourseSelect={setDetailCourse}
            onUpload={() => { if (isAuthenticated) { setShowCreateModal(true); } else { setShowAuthModal(true); } }}
            C={C} fs={fs} F={F}
          />
        )}
        {activeTab === 'profile' && (
          <SettingsScreen onNavigateToCourses={() => setActiveTab('library')} />
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        onCreatePress={handleCreatePress}
        bottomInset={insets.bottom}
        C={C} F={F} fs={fs}
      />

      <CreateModal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        onSelectOption={handleCreateOption}
        C={C} F={F} fs={fs}
      />

      <AuthModal
        visible={showAuthModal}
        onDismiss={() => setShowAuthModal(false)}
        onAuthSuccess={() => { setShowAuthModal(false); setShowUpload(true); }}
      />
    </View>
  );
}

const rootStyles = StyleSheet.create({
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
