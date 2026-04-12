import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState, useCallback, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  ActivityIndicator,
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
import {
  getAuthorizationStatus,
  requestAuthorization,
  presentActivityPicker,
  hasSelection,
  getBlockedCount,
} from '../lib/familyControls';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];

type GoalFrequency = 'daily' | 'weekdays' | 'custom';
type Step          = 'frequency' | 'session' | 'apps';

const LESSON_OPTIONS = [
  { count: 1, label: 'Light',   desc: '1 lesson/day',  emoji: '🌱' },
  { count: 3, label: 'Focused', desc: '3 lessons/day', emoji: '🔥' },
  { count: 5, label: 'Intense', desc: '5 lessons/day', emoji: '⚡' },
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

function makeStyles(C: AppColors) {
  const P = C.primary;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: Spacing.lg },
    scrollContent: { paddingTop: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg },

    // Header
    header: { gap: Spacing.sm },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      backgroundColor: `${P}12`, borderRadius: 20, paddingHorizontal: 12,
      paddingVertical: 6, borderWidth: 1.5, borderColor: `${P}35`,
    },
    badgeEmoji: { fontSize: 13 },
    badgeText: { fontSize: 12, fontFamily: 'Inter-Bold', color: P, letterSpacing: 0.3 },
    title: { fontSize: 30, fontFamily: 'Inter-ExtraBold', color: C.text, lineHeight: 38 },
    subtitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 22 },

    // Frequency chips
    chipRow: { flexDirection: 'row', gap: Spacing.sm },
    chip: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: C.border, backgroundColor: C.surfaceAlt, alignItems: 'center',
    },
    chipActive: { backgroundColor: P, borderColor: P },
    chipText: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.sub },
    chipTextActive: { color: '#fff' },

    // Description card
    descCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      backgroundColor: C.surfaceAlt, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, padding: Spacing.md,
    },
    descText: { flex: 1, fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 20 },

    // Day picker
    dayPickerCard: {
      backgroundColor: C.surfaceAlt, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, padding: Spacing.md, gap: 12, alignItems: 'center',
    },
    dayPickerLabel: { fontSize: 11, fontFamily: 'Inter-ExtraBold', color: C.sub, letterSpacing: 1.2, textTransform: 'uppercase' },
    dayRow: { flexDirection: 'row', gap: 8 },
    dayBtn: {
      width: 38, height: 38, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center',
    },
    dayBtnActive: { backgroundColor: P, borderColor: P },
    dayBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.sub },
    dayBtnTextActive: { color: '#fff' },
    dayPickerSub: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: P },

    // Session — lesson tiles
    sectionHeader: { gap: 4 },
    sectionLabel: { fontSize: 11, fontFamily: 'Inter-ExtraBold', color: C.sub, letterSpacing: 1.2, textTransform: 'uppercase' },
    sectionSub: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.sub, lineHeight: 19 },
    tileRow: { flexDirection: 'row', gap: Spacing.sm },
    tile: {
      flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14,
      borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, backgroundColor: C.primaryBg,
    },
    tileActive: { backgroundColor: `${P}12`, borderColor: P },
    tileEmoji: { fontSize: 22 },
    tileLabel: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.text },
    tileLabelActive: { color: P },
    tileDesc: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.sub },
    tileDescActive: { color: `${P}BB` },

    // Time picker
    pickerCard: {
      backgroundColor: C.surfaceAlt, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, overflow: 'hidden', alignItems: 'center',
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingTop: Spacing.md, paddingHorizontal: Spacing.md,
    },
    pickerIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    pickerTime: { fontSize: 22 },
    picker: { width: '100%', height: 150 },

    // Native picker card
    pickerInfoCard: {
      backgroundColor: C.surfaceAlt, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border, padding: Spacing.md, gap: Spacing.md,
    },
    pickerInfoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    pickerInfoIcon: {
      width: 52, height: 52, borderRadius: 14, borderWidth: 1.5,
      justifyContent: 'center', alignItems: 'center',
    },
    pickerInfoTitle: { fontSize: 14 },
    pickerInfoSub: { fontSize: 12, lineHeight: 17 },
    checkBadge: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    openPickerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12,
    },
    openPickerBtnText: { fontSize: 14 },

    // Info card
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: `${P}08`, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${P}25`, padding: Spacing.sm,
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

type Props = { onComplete: () => void };

export default function GoalSetupScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const setGoalConfig = useAppStore((s) => s.setGoalConfig);
  const { C, fs, F } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [step, setStep]               = useState<Step>('frequency');
  const [frequency, setFrequency]     = useState<GoalFrequency>('daily');
  const [customDays, setCustomDays]   = useState<number[]>([1, 3, 5]);
  const [lessonTarget, setLessonTarget] = useState(1);
  const defaultTime = new Date(); defaultTime.setHours(9, 0, 0, 0);
  const [lockDate, setLockDate]       = useState(defaultTime);
  const [appsSelected, setAppsSelected] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);

  const totalSteps = 3;
  const stepIndex  = step === 'frequency' ? 0 : step === 'session' ? 1 : 2;

  const toggleCustomDay = useCallback((day: number) => {
    Haptics.selectionAsync();
    setCustomDays((prev) =>
      prev.includes(day)
        ? prev.length > 1 ? prev.filter((d) => d !== day) : prev
        : [...prev, day],
    );
  }, []);

  // Pre-load existing selection when entering the apps step
  const loadSelectionInfo = useCallback(async () => {
    const [sel, count] = await Promise.all([hasSelection(), getBlockedCount()]);
    setAppsSelected(sel);
    setBlockedCount(count);
  }, []);

  const handleOpenPicker = useCallback(async () => {
    setPickerLoading(true);
    try {
      let status = await getAuthorizationStatus();

      if (status === 'notDetermined') {
        await requestAuthorization();
        status = await getAuthorizationStatus();
      }

      if (status === 'denied') {
        Alert.alert(
          'Screen Time Access Required',
          'Please go to Settings → Screen Time → Loq Learn and allow access.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (status !== 'approved') {
        Alert.alert('Permission Required', `Screen Time status: ${status}. Please try again.`);
        return;
      }

      const count = await presentActivityPicker();
      setBlockedCount(count);
      setAppsSelected(count > 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') {
        const { NativeModules } = require('react-native');
        const moduleKeys = Object.keys(NativeModules).filter(k => k.toLowerCase().includes('family') || k.toLowerCase().includes('screen') || k.toLowerCase().includes('managed'));
        const debug = moduleKeys.length ? `\n\nLoaded: ${moduleKeys.join(', ')}` : `\n\nNo Family/Screen modules found in NativeModules`;
        Alert.alert('Error', (e?.message ?? 'Something went wrong') + debug);
      }
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const cfg = {
      frequency,
      customDays,
      lessonTarget,
      lockTime: toTimeString(lockDate),
      examDate: null,
    };
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
    const freqDesc = {
      daily:    'Apps are blocked every day until your lessons are done.',
      weekdays: 'Apps are blocked Mon–Fri. Weekends are free — no pressure.',
      custom:   'Apps are only blocked on the days you choose.',
    };
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>📅</Text>
              <Text style={styles.badgeText}>Learning Goal</Text>
            </View>
            <Text style={styles.title}>How often do you{'\n'}want to learn?</Text>
            <Text style={styles.subtitle}>
              Apps are only blocked on your goal days.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.chipRow}>
            {(['daily', 'weekdays', 'custom'] as GoalFrequency[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, frequency === f && styles.chipActive]}
                onPress={() => { Haptics.selectionAsync(); setFrequency(f); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>
                  {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.descCard}>
            <Ionicons name={frequency === 'daily' ? 'sunny-outline' : frequency === 'weekdays' ? 'briefcase-outline' : 'calendar-outline'} size={20} color={C.primary} />
            <Text style={styles.descText}>{freqDesc[frequency]}</Text>
          </Animated.View>

          {frequency === 'weekdays' && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.dayPickerCard}>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, day) => {
                  const active = WEEKDAY_DAYS.includes(day);
                  return (
                    <View key={day} style={[styles.dayBtn, active && styles.dayBtnActive]}>
                      <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

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
                      <Text style={[styles.dayBtnText, selected && styles.dayBtnTextActive]}>{label}</Text>
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
            <DuoButton label="Next →" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('session'); }} />
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
            <Text style={styles.title}>How many lessons{'\n'}to unlock apps?</Text>
            <Text style={styles.subtitle}>Apps unlock as soon as you hit your target.</Text>
          </Animated.View>

          {/* Lesson count */}
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

          {/* Reminder / lock time */}
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <View style={[styles.sectionHeader, { marginBottom: 10 }]}>
              <Text style={styles.sectionLabel}>REMINDER TIME</Text>
              <Text style={styles.sectionSub}>We'll remind you at this time on your goal days.</Text>
            </View>
            <View style={styles.pickerCard}>
              <View style={styles.pickerRow}>
                <View style={[styles.pickerIcon, { backgroundColor: `${C.primary}14` }]}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <Text style={[styles.pickerTime, { fontFamily: F.bold, color: C.text }]}>{fmtTime(lockDate)}</Text>
              </View>
              <DateTimePicker
                value={lockDate}
                mode="time"
                display="spinner"
                onChange={(_, selected) => { if (selected) { Haptics.selectionAsync(); setLockDate(selected); } }}
                style={styles.picker}
                textColor={C.text}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: Spacing.sm }}>
            <StepDots />
            <DuoButton label="Next: Choose apps →" onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStep('apps');
              loadSelectionInfo();
            }} />
            <TouchableOpacity onPress={() => setStep('frequency')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 3: App blocker ───────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>📱</Text>
            <Text style={styles.badgeText}>Screen Time</Text>
          </View>
          <Text style={styles.title}>Which apps steal{'\n'}your time?</Text>
          <Text style={styles.subtitle}>
            These apps will be blocked on your goal days until your lessons are done.
          </Text>
        </Animated.View>

        {/* Native picker card */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.pickerInfoCard}>
          <View style={styles.pickerInfoRow}>
            <View style={[styles.pickerInfoIcon, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}28` }]}>
              <Text style={{ fontSize: 28 }}>📱</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.pickerInfoTitle, { fontFamily: F.bold, color: C.text }]}>
                {appsSelected ? `${blockedCount} app${blockedCount !== 1 ? 's' : ''} selected` : 'No apps selected yet'}
              </Text>
              <Text style={[styles.pickerInfoSub, { fontFamily: F.regular, color: C.sub }]}>
                {appsSelected ? 'Tap to change your selection' : 'iOS shows your real installed apps'}
              </Text>
            </View>
            {appsSelected && (
              <View style={[styles.checkBadge, { backgroundColor: C.primary }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.openPickerBtn, { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}40` }, pickerLoading && { opacity: 0.5 }]}
            onPress={handleOpenPicker}
            disabled={pickerLoading}
            activeOpacity={0.75}
          >
            {pickerLoading ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <>
                <Ionicons name="apps-outline" size={17} color={C.primary} />
                <Text style={[styles.openPickerBtnText, { fontFamily: F.bold, color: C.primary }]}>
                  {appsSelected ? 'Change Selection' : 'Select Apps to Block →'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} />
          <Text style={styles.infoCardText}>
            Uses iOS Screen Time — Apple's built-in system. No third-party access to your app data.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: Spacing.sm }}>
          <StepDots />
          <DuoButton label="Start Unloqing 🔓" onPress={handleSave} />
          <TouchableOpacity onPress={() => setStep('session')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
