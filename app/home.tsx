import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
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
import { useAppStore, type GoalConfig } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';
import UploadScreen from './upload';
import StatsScreen from './stats';
import SettingsScreen from './settings';
import LessonPlayer from './lesson-player';
import AuthModal from './auth-modal';

type Tab = 'learn' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string; iconFilled: string }[] = [
  { id: 'learn',    label: 'Learn',    icon: 'book-outline',     iconFilled: 'book' },
  { id: 'stats',    label: 'Progress', icon: 'bar-chart-outline', iconFilled: 'bar-chart' },
  { id: 'settings', label: 'Profile',  icon: 'person-outline',   iconFilled: 'person' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  if (t.includes('law') || t.includes('legal'))
    return { emoji: '⚖️', color: '#0EA5E9' };
  if (t.includes('finance') || t.includes('econ'))
    return { emoji: '📈', color: '#16A34A' };
  return { emoji: '📚', color: '#D97706' };
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

// ── Tab bar item ─────────────────────────────────────────────────────────────

function TabItem({
  tab,
  active,
  onPress,
  C,
  F,
}: {
  tab: typeof TABS[number];
  active: boolean;
  onPress: () => void;
  C: AppColors;
  F: any;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.84, { damping: 12, stiffness: 500 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    });
    onPress();
  };

  return (
    <TouchableOpacity style={tabStyles.item} onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[tabStyles.inner, anim]}>
        {active && <View style={[tabStyles.indicator, { backgroundColor: C.primary }]} />}
        <Ionicons
          name={(active ? tab.iconFilled : tab.icon) as any}
          size={22}
          color={active ? C.primary : C.muted}
        />
        <Text style={[
          tabStyles.label,
          { fontFamily: active ? F.semiBold : F.regular, color: active ? C.primary : C.muted },
        ]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const tabStyles = StyleSheet.create({
  item:      { flex: 1, alignItems: 'center' },
  inner:     { alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 14 },
  indicator: { position: 'absolute', top: -1, width: 28, height: 3, borderRadius: 2 },
  label:     { fontSize: 10 },
});

// ── Courses tab ──────────────────────────────────────────────────────────────

function CoursesTab({ onUpload, onCourseSelect, C, fs, F }: { onUpload: () => void; onCourseSelect: (id: Id<'courses'>) => void; C: AppColors; fs: (n: number) => number; F: any }) {
  const styles = React.useMemo(() => makeCourseStyles(C), [C]);
  const { goalConfig, dailyProgress } = useAppStore();
  const viewer = useQuery(api.users.currentUser);
  const { isPremium } = useEntitlement();
  const rawCourses = useQuery(api.courses.list);
  const isLoading = rawCourses === undefined;
  const courses = ((rawCourses ?? []) as any[]).filter((c: any) => c.status === 'ready');
  const atFreeLimit = !isPremium && ((rawCourses ?? []) as any[]).filter((c: any) => c.status !== 'error').length >= 1;
  const removeCourse = useMutation(api.courses.remove);

  const handleCoursePress = async (course: any) => {
    if (course.status === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await removeCourse({ courseId: course._id as Id<'courses'> });
      onUpload();
    } else if (course.status === 'ready') {
      Haptics.selectionAsync();
      onCourseSelect(course._id as Id<'courses'>);
    }
  };

  const handleCourseLongPress = (course: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      course.title,
      'What would you like to do?',
      [
        {
          text: 'Delete Course',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Course',
              'This will permanently delete the course and all its lessons.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    await removeCourse({ courseId: course._id as Id<'courses'> });
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const goalDay   = goalConfig ? isTodayGoalDay(goalConfig) : false;
  const goalMet   = goalConfig ? todayDone >= goalConfig.lessonTarget : false;

  return (
    <>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { fontSize: fs(11), fontFamily: F.regular }]}>Welcome back</Text>
          <Text style={[styles.screenTitle, { fontSize: fs(22), fontFamily: F.bold }]} numberOfLines={1}>
            {viewer?.name?.split(' ')[0] ?? 'Your Courses'}
          </Text>
        </View>
        <View style={styles.topBarRight}>
          {courses.length > 0 && (
            <View style={styles.countPill}>
              <Text style={[styles.countPillTxt, { fontSize: fs(11), fontFamily: F.semiBold }]}>
                {courses.length} course{courses.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {isPremium ? (
            <View style={[styles.proBadge, { backgroundColor: `${C.primary}18`, borderColor: `${C.primary}35` }]}>
              <Ionicons name="star" size={10} color={C.primary} />
              <Text style={[styles.proBadgeTxt, { fontFamily: F.extraBold, fontSize: fs(10), color: C.primary }]}>
                PRO
              </Text>
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
              style={[styles.proBadge, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}25` }]}
            >
              <Ionicons name="flash-outline" size={10} color={C.primary} />
              <Text style={[styles.proBadgeTxt, { fontFamily: F.bold, fontSize: fs(10), color: C.primary }]}>
                Upgrade
              </Text>
            </TouchableOpacity>
          )}
          {viewer?.image ? (
            <Image source={{ uri: viewer.image }} style={[styles.avatar, { borderColor: C.border }]} />
          ) : viewer?.name ? (
            <View style={[styles.avatarFallback, { backgroundColor: `${C.primary}20`, borderColor: C.border }]}>
              <Text style={[styles.avatarInitial, { color: C.primary, fontFamily: F.bold, fontSize: fs(14) }]}>
                {viewer.name[0].toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Goal banner */}
      {goalConfig && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={[
            styles.goalBanner,
            goalMet && { backgroundColor: `${C.success}12`, borderColor: `${C.success}35` },
            !goalDay && { backgroundColor: C.surfaceAlt, borderColor: C.border },
          ]}
        >
          <View style={styles.goalLeft}>
            <Text style={{ fontSize: fs(22) }}>
              {!goalDay ? '😌' : goalMet ? '🎯' : '📖'}
            </Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.goalTitle, { fontSize: fs(13), fontFamily: F.semiBold, color: goalMet ? C.success : !goalDay ? C.sub : C.primary }]}>
                {!goalDay ? 'Rest day' : goalMet ? 'Goal complete!' : `Today's goal`}
              </Text>
              <Text style={[styles.goalSub, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]}>
                {!goalDay
                  ? 'No lesson required today'
                  : goalMet
                  ? 'Apps are unlocked'
                  : `${todayDone}/${goalConfig.lessonTarget} lessons · locks at ${fmtLockTime(goalConfig.lockTime)}`}
              </Text>
            </View>
          </View>
          {goalDay && (
            <View style={styles.pipRow}>
              {Array.from({ length: goalConfig.lessonTarget }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    { backgroundColor: `${C.primary}28`, borderColor: `${C.primary}45` },
                    i < todayDone && { backgroundColor: C.primary, borderColor: C.primary },
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload CTA */}
        <Animated.View entering={FadeInDown.duration(260)}>
          <TouchableOpacity
            style={styles.uploadCard}
            activeOpacity={0.8}
            onPress={onUpload}
          >
            <View style={[styles.uploadIcon, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}28` }]}>
              <Text style={{ fontSize: 24 }}>📄</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.uploadTitle, { fontSize: fs(15), fontFamily: F.semiBold, color: C.text }]}>
                Upload a document
              </Text>
              <Text style={[styles.uploadSub, { fontSize: fs(12), fontFamily: F.regular, color: C.sub }]}>
                {atFreeLimit ? 'Upgrade to add more courses' : 'PDF · AI generates flashcards + quiz'}
              </Text>
            </View>
            <View style={[styles.arrowBtn, { backgroundColor: `${C.primary}18` }]}>
              <Ionicons name={atFreeLimit ? 'lock-closed-outline' : 'arrow-forward'} size={15} color={C.primary} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Course list or empty state */}
        {isLoading ? (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={{ gap: 10 }}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.skeletonCard, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
                <View style={[styles.skeletonIcon, { backgroundColor: C.border }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonLine, { width: '60%', backgroundColor: C.border }]} />
                  <View style={[styles.skeletonLine, { width: '40%', backgroundColor: C.border }]} />
                </View>
              </View>
            ))}
          </Animated.View>
        ) : courses.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: C.primaryBg, borderColor: C.border }]}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
            </View>
            <Text style={[styles.emptyTitle, { fontSize: fs(18), fontFamily: F.semiBold, color: C.text }]}>
              No courses yet
            </Text>
            <Text style={[styles.emptySub, { fontSize: fs(13), fontFamily: F.regular, color: C.sub }]}>
              Upload a document and Unloq turns it into flashcards and quizzes you must complete before using your apps.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.courseSection}>
            <Text style={[styles.sectionCap, { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted }]}>
              MY COURSES
            </Text>
            <View style={styles.courseGroup}>
              {courses.map((course: any, idx: number) => {
                const { emoji, color } = topicColor(course.title);
                return (
                  <TouchableOpacity
                    key={course._id}
                    style={[styles.courseRow, idx < courses.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                    activeOpacity={0.75}
                    onPress={() => handleCoursePress(course)}
                    onLongPress={() => handleCourseLongPress(course)}
                    delayLongPress={400}
                  >
                    <View style={[styles.courseIcon, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </View>
                    <View style={styles.courseInfo}>
                      <Text style={[styles.courseTitle, { fontSize: fs(14), fontFamily: F.semiBold, color: C.text }]} numberOfLines={2}>
                        {course.title}
                      </Text>
                      <View style={styles.courseTags}>
                        <View style={[styles.lessonBadge, { backgroundColor: `${color}18` }]}>
                          <Text style={[styles.lessonBadgeTxt, { fontSize: fs(10), fontFamily: F.semiBold, color }]}>
                            {course.totalLessons} lessons
                          </Text>
                        </View>
                        <Text style={[{ fontSize: 10, color: C.muted }]}>·</Text>
                        <Text style={[styles.docName, { fontSize: fs(11), fontFamily: F.regular, color: C.muted }]} numberOfLines={1}>
                          {course.docName}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.arrowBtn, { backgroundColor: `${color}18` }]}>
                      <Ionicons name="arrow-forward" size={14} color={color} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { C, fs, F } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const [activeTab, setActiveTab] = useState<Tab>('learn');
  const [showUpload, setShowUpload] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Id<'courses'> | null>(null);

  const handleUploadPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isAuthenticated) {
      setShowUpload(true);
    } else {
      setShowAuthModal(true);
    }
  };

  if (showUpload) return <UploadScreen onBack={() => setShowUpload(false)} />;
  if (activeCourse) return <LessonPlayer courseId={activeCourse} onBack={() => setActiveCourse(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Screen content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'learn'    && <CoursesTab onUpload={handleUploadPress} onCourseSelect={setActiveCourse} C={C} fs={fs} F={F} />}
        {activeTab === 'stats'    && <StatsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Tab bar */}
      <View style={[
        tabBarStyles.bar,
        { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: insets.bottom + 4 },
      ]}>
        {TABS.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            onPress={() => {
              if (activeTab !== tab.id) {
                Haptics.selectionAsync();
                setActiveTab(tab.id);
              }
            }}
            C={C}
            F={F}
          />
        ))}
      </View>

      {/* Auth modal — shown when unauthenticated user taps upload */}
      <AuthModal
        visible={showAuthModal}
        onDismiss={() => setShowAuthModal(false)}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          setShowUpload(true);
        }}
      />
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
});

function makeCourseStyles(C: AppColors) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
    avatarFallback: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: {},
    greeting: { color: C.muted, letterSpacing: 0.8, marginBottom: 1 },
    screenTitle: { color: C.text },
    countPill: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    countPillTxt: { color: C.sub },

    proBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: StyleSheet.hairlineWidth,
    },
    proBadgeTxt: {},

    goalBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: Spacing.lg,
      marginVertical: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      backgroundColor: `${C.primary}0E`,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${C.primary}30`,
    },
    goalLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    goalTitle: {},
    goalSub: {},
    pipRow: { flexDirection: 'row', gap: 5, marginLeft: 10 },
    pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },

    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.lg },

    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 1,
    },
    uploadIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    uploadTitle: {},
    uploadSub: {},
    arrowBtn: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

    skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
    skeletonIcon: { width: 48, height: 48, borderRadius: 14 },
    skeletonLine: { height: 12, borderRadius: 6 },

    empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyIcon: { width: 80, height: 80, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: {},
    emptySub: { textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing.md },

    courseSection: { gap: 8 },
    sectionCap: { letterSpacing: 1.5, paddingHorizontal: 2 },
    courseGroup: {
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
      paddingVertical: Spacing.md,
      gap: 12,
    },
    courseIcon: { width: 48, height: 48, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    courseInfo: { flex: 1, gap: 4 },
    courseTitle: { lineHeight: 20 },
    courseTags: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    lessonBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    lessonBadgeTxt: {},
    docName: { flex: 1 },
  });
}
