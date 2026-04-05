import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DuoButton from '../components/DuoButton';
import { Spacing } from '../constants/spacing';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { scheduleStudyReminders, requestNotificationPermission } from '../lib/notifications';
import type { AppColors } from '../constants/Colors';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];

type GoalFrequency = 'daily' | 'weekdays' | 'custom';
type Step = 'frequency' | 'session' | 'apps';

const LESSON_OPTIONS = [
  { count: 1, label: 'Light', desc: '~5 min/day', emoji: '🌱' },
  { count: 3, label: 'Focused', desc: '~15 min/day', emoji: '🔥' },
  { count: 5, label: 'Intense', desc: '~25 min/day', emoji: '⚡' },
];

function toTimeString(date: Date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function fmtTime(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

type Props = { onComplete: () => void };

function makeStyles(C: AppColors) {
  const P = C.primary;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: Spacing.lg },
    scrollContent: {
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxl,
      gap: Spacing.lg,
    },

    // Header
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
    badgeText: { fontSize: 12, fontFamily: 'Inter-Bold', color: P, letterSpacing: 0.3 },
    title: { fontSize: 30, fontFamily: 'Inter-ExtraBold', color: C.text, lineHeight: 38 },
    subtitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 22 },

    // Frequency chips
    chipRow: { flexDirection: 'row', gap: Spacing.sm },
    chip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.surfaceAlt,
      alignItems: 'center',
    },
    chipActive: { backgroundColor: P, borderColor: P },
    chipText: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.sub },
    chipTextActive: { color: '#ffffff' },

    // Description card
    descCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: C.surfaceAlt,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
    },
    descText: { flex: 1, fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 20 },

    // Day picker
    dayPickerCard: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
      gap: 12,
      alignItems: 'center',
    },
    dayPickerLabel: { fontSize: 11, fontFamily: 'Inter-ExtraBold', color: C.sub, letterSpacing: 1.2, textTransform: 'uppercase' },
    dayRow: { flexDirection: 'row', gap: 8 },
    dayBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayBtnActive: { backgroundColor: P, borderColor: P },
    dayBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.sub },
    dayBtnTextActive: { color: '#ffffff' },
    dayPickerSub: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: P },

    // Option cards
    optionList: { gap: Spacing.sm },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: C.primaryBg,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
    },
    optionCardCompact: { paddingVertical: 12 },
    optionCardActive: { backgroundColor: `${P}12`, borderColor: P },
    optionEmoji: { fontSize: 26 },
    optionText: { flex: 1, gap: 3 },
    optionLabel: { fontSize: 15, fontFamily: 'Inter-Bold', color: C.text },
    optionLabelActive: { color: P },
    optionDesc: { fontSize: 13, fontFamily: 'Inter-Regular', color: C.sub },
    optionDescActive: { color: `${P}CC` },
    optionRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionRadioActive: { borderColor: P },
    optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: P },

    // Section label
    sectionHeader: { gap: 4 },
    sectionLabel: { fontSize: 11, fontFamily: 'Inter-ExtraBold', color: C.sub, letterSpacing: 1.2, textTransform: 'uppercase' },
    sectionSub: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 19 },

    // Lesson tiles (3-col grid)
    tileRow: { flexDirection: 'row', gap: Spacing.sm },
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.primaryBg,
    },
    tileActive: { backgroundColor: `${P}12`, borderColor: P },
    tileEmoji: { fontSize: 22 },
    tileLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.text },
    tileLabelActive: { color: P },
    tileDesc: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.sub },
    tileDescActive: { color: `${P}BB` },

    // Time picker
    pickerCard: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      overflow: 'hidden',
      alignItems: 'center',
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    pickerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerTime: { fontSize: 22 },
    picker: { width: '100%', height: 150 },

    // How it works card
    howCard: {
      backgroundColor: C.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: Spacing.md,
      overflow: 'hidden',
    },
    howRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14 },
    howRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    howIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: `${P}12`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    howText: { flex: 1, fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 19 },

    // Summary card
    summaryCard: {
      backgroundColor: C.primaryBg,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: Spacing.md,
      gap: 10,
    },
    summaryTitle: { fontSize: 11, fontFamily: 'Inter-ExtraBold', color: C.sub, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryKey: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub },
    summaryVal: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.text },

    // Info card
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: `${P}08`,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${P}25`,
      padding: Spacing.sm,
    },
    infoCardText: { flex: 1, fontSize: 12, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 18 },

    // Navigation
    stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
    stepDotActive: { backgroundColor: P, width: 22 },
    backBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
    backBtnText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: C.sub },
  });
}

export default function GoalSetupScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const setGoalConfig = useAppStore((s) => s.setGoalConfig);
  const { C, fs, F } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [step, setStep] = useState<Step>('frequency');

  const [frequency, setFrequency] = useState<GoalFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);
  const [lessonTarget, setLessonTarget] = useState(1);
  const defaultTime = new Date();
  defaultTime.setHours(8, 0, 0, 0);
  const [lockDate, setLockDate] = useState(defaultTime);

  const totalSteps = 3;
  const stepIndex = step === 'frequency' ? 0 : step === 'session' ? 1 : 2;

  const toggleCustomDay = useCallback((day: number) => {
    Haptics.selectionAsync();
    setCustomDays((prev) =>
      prev.includes(day)
        ? prev.length > 1 ? prev.filter((d) => d !== day) : prev
        : [...prev, day],
    );
  }, []);

  const goToSession = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('session');
  }, []);

  const goToApps = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('apps');
  }, []);

  const handleStart = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const cfg = { frequency, customDays, lessonTarget, lockTime: toTimeString(lockDate), examDate: null };
    setGoalConfig(cfg);
    await requestNotificationPermission();
    await scheduleStudyReminders(cfg);
    onComplete();
  }, [frequency, customDays, lessonTarget, lockDate, setGoalConfig, onComplete]);

  const StepDots = () => (
    <View style={styles.stepDots}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View key={i} style={[styles.stepDot, i === stepIndex && styles.stepDotActive]} />
      ))}
    </View>
  );

  // ── Step 1: Frequency ──────────────────────────────────────────────────────
  if (step === 'frequency') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>🎯</Text>
              <Text style={styles.badgeText}>Learning Goal</Text>
            </View>
            <Text style={styles.title}>How often do you{'\n'}want to learn?</Text>
            <Text style={styles.subtitle}>
              You'll get a reminder on your goal days — choose what you can commit to.
            </Text>
          </Animated.View>

          {/* Frequency chips */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.chipRow}>
            {(['daily', 'weekdays', 'custom'] as GoalFrequency[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, frequency === f && styles.chipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFrequency(f);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>
                  {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Description card */}
          <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.descCard}>
            <Ionicons
              name={
                frequency === 'daily'
                  ? 'sunny-outline'
                  : frequency === 'weekdays'
                  ? 'briefcase-outline'
                  : 'calendar-outline'
              }
              size={20}
              color={C.primary}
            />
            <Text style={styles.descText}>
              {frequency === 'daily'
                ? "You'll get a daily reminder at your chosen time to complete your lesson."
                : frequency === 'weekdays'
                ? "Reminders Mon–Fri. Weekends are free — no pressure."
                : 'Pick the specific days you want to commit to learning.'}
            </Text>
          </Animated.View>

          {/* Weekdays preview */}
          {frequency === 'weekdays' && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.dayPickerCard}>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, day) => {
                  const active = WEEKDAY_DAYS.includes(day);
                  return (
                    <View key={day} style={[styles.dayBtn, active && styles.dayBtnActive]}>
                      <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Custom day picker */}
          {frequency === 'custom' && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.dayPickerCard}>
              <Text style={styles.dayPickerLabel}>Select your learning days</Text>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, day) => {
                  const selected = customDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayBtn, selected && styles.dayBtnActive]}
                      onPress={() => toggleCustomDay(day)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.dayBtnText, selected && styles.dayBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.dayPickerSub}>
                {[...customDays].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(' · ')}
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ gap: Spacing.sm }}>
            <StepDots />
            <DuoButton label="Next: Set your goal →" onPress={goToSession} />
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Session ────────────────────────────────────────────────────────
  if (step === 'session') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>📚</Text>
              <Text style={styles.badgeText}>Daily Goal</Text>
            </View>
            <Text style={styles.title}>Set your{'\n'}daily session</Text>
            <Text style={styles.subtitle}>
              Apps unlock once you hit your target.
            </Text>
          </Animated.View>

          {/* Lesson count — 3 column tiles */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Text style={styles.sectionLabel}>LESSONS PER DAY</Text>
            <View style={[styles.tileRow, { marginTop: 10 }]}>
              {LESSON_OPTIONS.map((opt) => {
                const selected = lessonTarget === opt.count;
                return (
                  <TouchableOpacity
                    key={opt.count}
                    style={[styles.tile, selected && styles.tileActive]}
                    onPress={() => { Haptics.selectionAsync(); setLessonTarget(opt.count); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.tileEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.tileLabel, selected && styles.tileLabelActive]}>{opt.label}</Text>
                    <Text style={[styles.tileDesc, selected && styles.tileDescActive]}>{opt.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Reminder time — custom time picker */}
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>REMINDER TIME</Text>
              <Text style={styles.sectionSub}>You'll get a notification at this time on your goal days.</Text>
            </View>
            <View style={[styles.pickerCard, { marginTop: 10 }]}>
              <View style={styles.pickerRow}>
                <View style={[styles.pickerIcon, { backgroundColor: `${C.primary}14` }]}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <Text style={[styles.pickerTime, { fontFamily: F.bold, color: C.text }]}>
                  {fmtTime(lockDate)}
                </Text>
              </View>
              <DateTimePicker
                value={lockDate}
                mode="time"
                display="spinner"
                onChange={(_, selected) => {
                  if (selected) {
                    Haptics.selectionAsync();
                    setLockDate(selected);
                  }
                }}
                style={styles.picker}
                textColor={C.text}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: Spacing.sm }}>
            <StepDots />
            <DuoButton label="Next: Choose apps →" onPress={goToApps} />
            <TouchableOpacity onPress={() => setStep('frequency')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 3: App blocker ────────────────────────────────────────────────────
  const selectedOption = LESSON_OPTIONS.find((o) => o.count === lessonTarget)!;
  const activeDays =
    frequency === 'daily'
      ? 'Every day'
      : frequency === 'weekdays'
      ? 'Mon – Fri'
      : [...customDays].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(', ');

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>🔔</Text>
            <Text style={styles.badgeText}>Reminders</Text>
          </View>
          <Text style={styles.title}>Stay on track{'\n'}with reminders</Text>
          <Text style={styles.subtitle}>
            We'll send you a nudge at your chosen time on your goal days.
          </Text>
        </Animated.View>

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.howCard}>
          {[
            { icon: 'notifications-outline' as const, text: "Get a reminder at your set time on goal days" },
            { icon: 'book-outline' as const, text: 'Complete your lesson to stay on streak' },
            { icon: 'school-outline' as const, text: 'Exam Mode (coming soon) — locks apps until lessons are done' },
          ].map((item, i) => (
            <View key={i} style={[styles.howRow, i > 0 && styles.howRowBorder]}>
              <View style={styles.howIcon}>
                <Ionicons name={item.icon} size={17} color={C.primary} />
              </View>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Summary */}
        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your setup</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Schedule</Text>
            <Text style={styles.summaryVal}>{activeDays}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Daily lessons</Text>
            <Text style={styles.summaryVal}>
              {selectedOption.emoji} {lessonTarget} · {selectedOption.desc}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Reminder time</Text>
            <Text style={styles.summaryVal}>🔔 {fmtTime(lockDate)}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(300)} style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={C.primary} />
          <Text style={styles.infoCardText}>
            We'll ask for notification permission so we can remind you to complete your lessons.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(300)} style={{ gap: Spacing.sm }}>
          <StepDots />
          <DuoButton label="Start Unloqing 🔓" onPress={() => { handleStart(); }} />
          <TouchableOpacity onPress={() => setStep('session')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
