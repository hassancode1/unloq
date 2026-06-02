import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../constants/spacing';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { scheduleStudyReminders, showNotificationPermissionAlert } from '../lib/notifications';
import {
  getAuthorizationStatus,
  requestAuthorization,
  presentActivityPicker,
  hasSelection,
  getBlockedCount,
  startMonitoring,
} from '../lib/familyControls';

// ─── Design tokens (clay aesthetic) ──────────────────────────────────────────

const CLAY_BG       = '#EEF2FF';   // indigo-tinted lavender canvas
const CLAY_CARD     = '#FFFFFF';
const CLAY_SHADOW   = '#C7D2FE';   // indigo-100 — inactive shadow
const CLAY_SHADOW_ACTIVE = '#4338CA'; // deep indigo — active shadow
const CLAY_PRIMARY  = '#6366F1';
const CLAY_PRIMARY2 = '#8B5CF6';
const CLAY_TEXT     = '#1E1B4B';
const CLAY_MUTED    = '#6B7280';
const CLAY_SUB      = '#4B5563';
const CLAY_BORDER   = '#E0E7FF';

// ─── Clay helpers ─────────────────────────────────────────────────────────────

type ClayCardProps = {
  children: React.ReactNode;
  shadowColor?: string;
  depth?: number;
  radius?: number;
  style?: object;
  innerStyle?: object;
};

function ClayButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={{ position: 'relative', marginBottom: 6 }}>
      <View style={{
        position: 'absolute',
        bottom: -6, left: 0, right: 0, top: 0,
        borderRadius: 18,
        backgroundColor: disabled ? CLAY_SHADOW : CLAY_SHADOW_ACTIVE,
      }} />
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        activeOpacity={0.82}
        style={{
          borderRadius: 18,
          backgroundColor: disabled ? CLAY_MUTED : CLAY_PRIMARY,
          paddingVertical: 16,
          alignItems: 'center',
          transform: [{ translateY: -6 }],
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={{ fontFamily: 'Nunito-ExtraBold', fontSize: 17, color: '#fff' }}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ClayCard({
  children,
  shadowColor = CLAY_SHADOW,
  depth = 6,
  radius = 24,
  style,
  innerStyle,
}: ClayCardProps) {
  return (
    <View style={[{ position: 'relative', marginBottom: depth }, style]}>
      <View style={{
        position: 'absolute',
        bottom: -depth, left: 0, right: 0, top: 0,
        borderRadius: radius,
        backgroundColor: shadowColor,
      }} />
      <View style={[{
        borderRadius: radius,
        backgroundColor: CLAY_CARD,
        overflow: 'hidden',
      }, innerStyle]}>
        {children}
      </View>
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_DAYS = [1, 2, 3, 4, 5];

type GoalFrequency = 'daily' | 'weekdays' | 'custom';
type Step          = 'frequency' | 'session' | 'apps';

const BLOCK_DURATION_OPTIONS = [
  { hours: 0.5, label: '30 mins', emoji: '⚡', desc: 'Quick sprint' },
  { hours: 1,   label: '1 hour',  emoji: '⏱️', desc: 'Light session' },
  { hours: 2,   label: '2 hours', emoji: '🔒', desc: 'Steady focus' },
  { hours: 3,   label: '3 hours', emoji: '💪', desc: 'Deep focus' },
  { hours: -1,  label: 'Custom',  emoji: '✏️', desc: 'Set your own' },
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
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY_BG, paddingHorizontal: Spacing.lg },
  scroll: { paddingTop: Spacing.md, paddingBottom: 48, gap: Spacing.lg },

  // Header
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: `${CLAY_PRIMARY}18`,
    borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: `${CLAY_PRIMARY}35`,
  },
  badgeEmoji: { fontSize: 14 },
  badgeText: { fontSize: 12, fontFamily: 'Nunito-ExtraBold', color: CLAY_PRIMARY, letterSpacing: 0.5 },
  title: { fontSize: 34, fontFamily: 'Nunito-ExtraBold', color: CLAY_TEXT, lineHeight: 40, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: 'Nunito-SemiBold', color: CLAY_SUB, lineHeight: 22 },

  // Navigation
  cancelBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 2 },
  cancelTxt: { fontSize: 15, fontFamily: 'Nunito-SemiBold', color: CLAY_MUTED },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CLAY_BORDER },
  stepDotActive: { backgroundColor: CLAY_PRIMARY, width: 24 },
  backBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  backBtnText: { fontSize: 14, fontFamily: 'Nunito-SemiBold', color: CLAY_MUTED },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontFamily: 'Nunito-ExtraBold', color: CLAY_PRIMARY,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
  },
  sectionSub: { fontSize: 13, fontFamily: 'Nunito-SemiBold', color: CLAY_SUB, lineHeight: 19 },
});

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = { onComplete: () => void; onBack?: () => void };

export default function GoalSetupScreen({ onComplete, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const setGoalConfig           = useAppStore((s) => s.setGoalConfig);
  const existingGoalConfig      = useAppStore((s) => s.goalConfig);
  const setBlockDurationHoursStore = useAppStore((s) => s.setBlockDurationHours);
  const setBlockingEnabled      = useAppStore((s) => s.setBlockingEnabled);
  const { F } = useTheme();

  const [step, setStep]               = useState<Step>('frequency');
  const [frequency, setFrequency]     = useState<GoalFrequency>('daily');
  const [customDays, setCustomDays]   = useState<number[]>([1, 3, 5]);
  const defaultTime = new Date(); defaultTime.setHours(9, 0, 0, 0);
  const [lockDate, setLockDate]       = useState(defaultTime);
  const [blockDurationHours, setBlockDurationHours] = useState(2);
  const [customHoursInput, setCustomHoursInput] = useState('');
  const [appsSelected, setAppsSelected] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);

  const isCustomDuration = blockDurationHours === -1;
  const resolvedHours    = isCustomDuration ? (parseInt(customHoursInput, 10) || 0) : blockDurationHours;

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
        await requestAuthorization(); // resolves only on approval, rejects if denied
        status = 'approved';
      }
      if (status === 'denied') {
        Alert.alert(
          'Screen Time Access Required',
          'Please go to Settings → Screen Time → Loq Learn and allow access.',
          [{ text: 'OK' }],
        );
        return;
      }
      if (status !== 'approved') return;
      await presentActivityPicker();
      const [sel, count] = await Promise.all([hasSelection(), getBlockedCount()]);
      setAppsSelected(sel);
      setBlockedCount(count);
      if (sel) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') {
        Alert.alert(
          'Screen Time Unavailable',
          'Unable to access Screen Time on this device. App blocking won\'t be available.',
          [{ text: 'OK' }],
        );
      }
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const today = new Date().toLocaleDateString('en-CA');
    const cfg = {
      frequency,
      customDays,
      lessonTarget: 1,
      lockTime: toTimeString(lockDate),
      examDate: null,
      goalSetDate: existingGoalConfig?.goalSetDate ?? today,
    };
    setGoalConfig(cfg);
    setBlockDurationHoursStore(resolvedHours);
    try {
      const scheduled = await scheduleStudyReminders(cfg);
      if (!scheduled) showNotificationPermissionAlert();
    } catch (e) {
      if (__DEV__) console.error('[Notifications] Failed to schedule reminders:', e);
    }
    if (appsSelected) {
      setBlockingEnabled(true);
      const [lh, lm] = toTimeString(lockDate).split(':').map(Number);
      startMonitoring(lh ?? 8, lm ?? 0).catch(() => {});
    }
    onComplete();
  }, [frequency, customDays, resolvedHours, lockDate, existingGoalConfig, setGoalConfig, onComplete, appsSelected, setBlockingEnabled]);

  // ── Step dots ──────────────────────────────────────────────────────────────
  const StepDots = () => (
    <View style={S.stepDots}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View key={i} style={[S.stepDot, i === stepIndex && S.stepDotActive]} />
      ))}
    </View>
  );

  // ── FREQUENCY desc ─────────────────────────────────────────────────────────
  const freqMeta: Record<GoalFrequency, { icon: any; text: string }> = {
    daily:    { icon: 'sunny-outline',     text: 'You\'ll get a daily reminder to complete your study session.' },
    weekdays: { icon: 'briefcase-outline', text: 'Study reminders Mon–Fri. Weekends are free — no pressure.' },
    custom:   { icon: 'calendar-outline',  text: 'You\'ll get reminders on the days you choose.' },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Frequency
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'frequency') {
    return (
      <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={S.cancelBar} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={CLAY_MUTED} />
            <Text style={S.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.sm }}>
            <View style={S.badge}>
              <Text style={S.badgeEmoji}>📅</Text>
              <Text style={S.badgeText}>Learning Goal</Text>
            </View>
            <Text style={S.title}>How often do you{'\n'}want to learn?</Text>
            <Text style={S.subtitle}>Pick when you want to study each week.</Text>
          </Animated.View>

          {/* ── Frequency chips (clay blocks) ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)} style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {(['daily', 'weekdays', 'custom'] as GoalFrequency[]).map((f) => {
              const active = frequency === f;
              return (
                <View key={f} style={{ flex: 1, position: 'relative', marginBottom: 6 }}>
                  {/* clay shadow */}
                  <View style={{
                    position: 'absolute',
                    bottom: -6, left: 0, right: 0, top: 0,
                    borderRadius: 20,
                    backgroundColor: active ? CLAY_SHADOW_ACTIVE : CLAY_SHADOW,
                  }} />
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setFrequency(f); }}
                    activeOpacity={0.82}
                    style={{
                      paddingVertical: 16,
                      borderRadius: 20,
                      backgroundColor: active ? CLAY_PRIMARY : CLAY_CARD,
                      alignItems: 'center', gap: 4,
                      transform: [{ translateY: -6 }],
                      borderWidth: active ? 0 : 1.5,
                      borderColor: CLAY_BORDER,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>
                      {f === 'daily' ? '☀️' : f === 'weekdays' ? '💼' : '📆'}
                    </Text>
                    <Text style={{
                      fontSize: 12, fontFamily: 'Nunito-ExtraBold',
                      color: active ? '#fff' : CLAY_TEXT,
                    }}>
                      {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays' : 'Custom'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </Animated.View>

          {/* ── Description card ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(300)}>
            <ClayCard shadowColor={`${CLAY_PRIMARY}30`} depth={5} innerStyle={{ padding: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 12,
                  backgroundColor: `${CLAY_PRIMARY}18`,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name={freqMeta[frequency].icon} size={18} color={CLAY_PRIMARY} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito-SemiBold', color: CLAY_SUB, lineHeight: 21 }}>
                  {freqMeta[frequency].text}
                </Text>
              </View>
            </ClayCard>
          </Animated.View>

          {/* ── Weekday preview ── */}
          {frequency === 'weekdays' && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <ClayCard shadowColor={CLAY_SHADOW} depth={5} innerStyle={{ padding: Spacing.md, alignItems: 'center', gap: 12 }}>
                <Text style={S.sectionLabel}>Blocked days</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DAY_LABELS.map((label, day) => {
                    const active = WEEKDAY_DAYS.includes(day);
                    return (
                      <View key={day} style={{
                        width: 38, height: 38, borderRadius: 14,
                        backgroundColor: active ? CLAY_PRIMARY : `${CLAY_PRIMARY}12`,
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-ExtraBold', color: active ? '#fff' : `${CLAY_PRIMARY}60` }}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ClayCard>
            </Animated.View>
          )}

          {/* ── Custom day picker ── */}
          {frequency === 'custom' && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <ClayCard shadowColor={CLAY_SHADOW} depth={5} innerStyle={{ padding: Spacing.md, alignItems: 'center', gap: 12 }}>
                <Text style={S.sectionLabel}>Pick your days</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DAY_LABELS.map((label, day) => {
                    const selected = customDays.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => toggleCustomDay(day)}
                        activeOpacity={0.75}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={{
                          width: 38, height: 38, borderRadius: 14,
                          backgroundColor: selected ? CLAY_PRIMARY : `${CLAY_PRIMARY}12`,
                          justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-ExtraBold', color: selected ? '#fff' : CLAY_SUB }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: CLAY_PRIMARY }}>
                  {[...customDays].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(' · ')}
                </Text>
              </ClayCard>
            </Animated.View>
          )}

          {/* ── CTA ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ gap: Spacing.sm }}>
            <StepDots />
            <ClayButton
              label="Next →"
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep('session'); }}
            />
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Session
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'session') {
    return (
      <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={S.cancelBar} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={CLAY_MUTED} />
            <Text style={S.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.sm }}>
            <View style={S.badge}>
              <Text style={S.badgeEmoji}>⏰</Text>
              <Text style={S.badgeText}>Study Session</Text>
            </View>
            <Text style={S.title}>Plan your{'\n'}study session</Text>
            <Text style={S.subtitle}>Pick a session length and a daily reminder time.</Text>
          </Animated.View>

          {/* ── Duration tiles ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <Text style={S.sectionLabel}>Session Duration</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 8 }}>
              {BLOCK_DURATION_OPTIONS.map((opt, i) => {
                const selected = blockDurationHours === opt.hours;
                return (
                  <Animated.View
                    key={opt.hours}
                    entering={FadeInDown.delay(60 + i * 28).duration(250)}
                    style={{ width: '48%', position: 'relative', marginBottom: 6 }}
                  >
                    {/* clay shadow layer */}
                    <View style={{
                      position: 'absolute',
                      bottom: -6, left: 0, right: 0, top: 0,
                      borderRadius: 18,
                      backgroundColor: selected ? CLAY_SHADOW_ACTIVE : CLAY_SHADOW,
                    }} />
                    <TouchableOpacity
                      onPress={() => { Haptics.selectionAsync(); setBlockDurationHours(opt.hours); }}
                      activeOpacity={0.82}
                      style={{
                        borderRadius: 18,
                        backgroundColor: selected ? CLAY_PRIMARY : CLAY_CARD,
                        alignItems: 'center', gap: 3, paddingVertical: 13,
                        transform: [{ translateY: -6 }],
                        borderWidth: selected ? 0 : 1.5,
                        borderColor: CLAY_BORDER,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Nunito-ExtraBold', color: selected ? '#fff' : CLAY_TEXT }}>
                        {opt.label}
                      </Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Nunito-SemiBold', color: selected ? 'rgba(255,255,255,0.75)' : CLAY_MUTED }}>
                        {opt.desc}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Custom hours input ── */}
          {isCustomDuration && (
            <Animated.View entering={FadeInDown.duration(250)}>
              <ClayCard shadowColor={`${CLAY_PRIMARY}40`} depth={6} innerStyle={{ padding: Spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 16,
                    backgroundColor: `${CLAY_PRIMARY}14`,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 28 }}>✏️</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontFamily: 'Nunito-ExtraBold', fontSize: 14, color: CLAY_TEXT }}>
                      Custom duration
                    </Text>
                    <TextInput
                      style={{
                        fontFamily: F.regular, fontSize: 15, color: CLAY_TEXT,
                        borderWidth: 1.5,
                        borderColor: customHoursInput ? CLAY_PRIMARY : CLAY_BORDER,
                        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                        backgroundColor: customHoursInput ? `${CLAY_PRIMARY}08` : '#FAFAFA',
                      }}
                      placeholder="e.g. 5"
                      placeholderTextColor={CLAY_MUTED}
                      keyboardType="number-pad"
                      value={customHoursInput}
                      onChangeText={setCustomHoursInput}
                      maxLength={2}
                    />
                    <Text style={{ fontFamily: F.regular, fontSize: 12, color: CLAY_MUTED }}>
                      hours per day
                    </Text>
                  </View>
                </View>
              </ClayCard>
            </Animated.View>
          )}

          {/* ── Reminder time ── */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Text style={[S.sectionLabel, { marginBottom: 8 }]}>Reminder Time</Text>
            <Text style={[S.sectionSub, { marginBottom: 10 }]}>We'll remind you to study at this time.</Text>
            <ClayCard shadowColor={`${CLAY_PRIMARY}30`} depth={6} innerStyle={{}}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingTop: Spacing.md, paddingHorizontal: Spacing.md,
              }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 12,
                  backgroundColor: `${CLAY_PRIMARY}18`,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <Text style={{ fontSize: 22, fontFamily: 'Nunito-ExtraBold', color: CLAY_TEXT }}>
                  {fmtTime(lockDate)}
                </Text>
              </View>
              <DateTimePicker
                value={lockDate}
                mode="time"
                display="spinner"
                onChange={(_, selected) => { if (selected) { Haptics.selectionAsync(); setLockDate(selected); } }}
                style={{ width: '100%', height: 150 }}
                textColor={CLAY_TEXT}
              />
            </ClayCard>
          </Animated.View>

          {/* ── CTA ── */}
          <Animated.View entering={FadeInDown.delay(280).duration(300)} style={{ gap: Spacing.sm }}>
            <StepDots />
            <ClayButton
              label="Next: Choose apps →"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep('apps');
                loadSelectionInfo();
              }}
              disabled={isCustomDuration && resolvedHours < 1}
            />
            <TouchableOpacity onPress={() => setStep('frequency')} style={S.backBtn}>
              <Text style={S.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Apps
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={S.cancelBar} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={CLAY_MUTED} />
          <Text style={S.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.sm }}>
          <View style={S.badge}>
            <Text style={S.badgeEmoji}>📱</Text>
            <Text style={S.badgeText}>Select Apps</Text>
          </View>
          <Text style={S.title}>Which apps steal{'\n'}your focus?</Text>
          <Text style={S.subtitle}>
            They'll be blocked at {(() => { const h = lockDate.getHours(); const m = lockDate.getMinutes(); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`; })()} on your study days.
          </Text>
        </Animated.View>

        {/* ── App picker card ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <ClayCard
            shadowColor={appsSelected ? CLAY_SHADOW_ACTIVE : CLAY_SHADOW}
            depth={7}
            innerStyle={{ padding: Spacing.md, gap: Spacing.md }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{
                width: 56, height: 56, borderRadius: 18,
                backgroundColor: appsSelected ? `${CLAY_PRIMARY}18` : `${CLAY_SHADOW}60`,
                borderWidth: 2, borderColor: appsSelected ? `${CLAY_PRIMARY}35` : CLAY_BORDER,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 30 }}>📱</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-ExtraBold', color: CLAY_TEXT }}>
                  {appsSelected ? `${blockedCount} app${blockedCount !== 1 ? 's' : ''} selected` : 'No apps selected yet'}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: CLAY_MUTED }}>
                  {appsSelected ? 'Tap to change your selection' : 'iOS shows your real installed apps'}
                </Text>
              </View>
              {appsSelected && (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: CLAY_PRIMARY, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: CLAY_BORDER }} />

            <View style={{ position: 'relative', marginBottom: 4 }}>
              <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, top: 0, borderRadius: 16, backgroundColor: `${CLAY_PRIMARY}50` }} />
              <TouchableOpacity
                onPress={handleOpenPicker}
                disabled={pickerLoading}
                activeOpacity={0.82}
                style={{
                  borderRadius: 16, backgroundColor: CLAY_PRIMARY, paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, transform: [{ translateY: -4 }], opacity: pickerLoading ? 0.6 : 1,
                }}
              >
                {pickerLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="apps-outline" size={18} color="#fff" />
                    <Text style={{ fontFamily: 'Nunito-ExtraBold', fontSize: 15, color: '#fff' }}>
                      {appsSelected ? 'Change Selection' : 'Select Apps to Block →'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ClayCard>
        </Animated.View>

        {/* ── Privacy note ── */}
        <Animated.View entering={FadeInDown.delay(160).duration(300)}>
          <ClayCard shadowColor={`${CLAY_PRIMARY}20`} depth={4} innerStyle={{ padding: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: `${CLAY_PRIMARY}18`, justifyContent: 'center', alignItems: 'center', marginTop: 1 }}>
                <Ionicons name="shield-checkmark-outline" size={15} color={CLAY_PRIMARY} />
              </View>
              <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Nunito-SemiBold', color: CLAY_SUB, lineHeight: 18 }}>
                Uses iOS Screen Time — Apple's built-in system. No third-party access to your app data.
              </Text>
            </View>
          </ClayCard>
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ gap: Spacing.sm }}>
          <StepDots />
          <ClayButton label={appsSelected ? 'Save & Start Blocking 🔒' : 'Skip for now →'} onPress={handleSave} />
          <TouchableOpacity onPress={() => setStep('session')} style={S.backBtn}>
            <Text style={S.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
