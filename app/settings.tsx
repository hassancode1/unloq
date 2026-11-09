// Profile tab — Glim first, then how you're doing, then settings.
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import Purchases from 'react-native-purchases';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../convex/_generated/api';
import { useTheme } from '../hooks/useTheme';
import { useEntitlement } from '../hooks/useEntitlement';
import { useAppStore, FONT_SCALE_MIN, FONT_SCALE_MAX } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';
import Glim, { GLIM_STAGES, type GlimHandle } from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';
import { INTERESTS, MINUTE_OPTIONS } from '../components/onboarding/content';
import { dayKey, stageProgress } from '../lib/quests';
import { allLearned, summarize } from '../lib/learningStats';
import StatsScreen from '../components/profile/StatsScreen';
import Sheet from '../components/profile/Sheet';
import { requestNotificationPermission, showNotificationPermissionAlert, turnOnReminders, useNotificationStatus } from '../lib/notifications';

const APP_STORE_ID = '6761177417';
const SUPPORT = 'mailto:iamthewebdev@gmail.com';


function toDate(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 20, m ?? 0, 0, 0);
  return d;
}

function fmtTime(hhmm: string) {
  return toDate(hhmm).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function SettingsScreen(_props: { onNavigateToCourses?: () => void }) {
  const insets = useSafeAreaInsets();
  const { C, fs, fontScale, F } = useTheme();
  const glimRef = React.useRef<GlimHandle>(null);
  const glim = useAppStore((s) => s.glim);
  const questLog = useAppStore((s) => s.questLog);
  const updateGlim = useAppStore((s) => s.updateGlim);
  const increaseFontScale = useAppStore((s) => s.increaseFontScale);
  const decreaseFontScale = useAppStore((s) => s.decreaseFontScale);
  const viewer = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();
  const { isPremium } = useEntitlement();
  const st = useMemo(() => makeStyles(C), [C]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(glim.name);
  const [showTime, setShowTime] = useState(false);
  const { status: notifStatus, refresh: refreshNotif } = useNotificationStatus();

  const palette = useMemo(() => paletteForInterests(glim.interests), [glim.interests]);
  const accent = palette[1];
  const progress = stageProgress(glim.xp);

  const extras = useAppStore((s) => s.extras);
  const stats = useMemo(() => summarize(questLog, allLearned(questLog, extras)), [questLog, extras]);
  const [screen, setScreen] = useState<null | 'stats' | 'learning' | 'account' | 'about'>(null);
  const open = (k: NonNullable<typeof screen>) => { Haptics.selectionAsync().catch(() => {}); setScreen(k); };
  const close = () => setScreen(null);

  // ── actions ──
  const saveName = () => {
    const n = nameDraft.trim().slice(0, 16);
    if (n) updateGlim({ name: n });
    else setNameDraft(glim.name);
    setEditingName(false);
    glimRef.current?.happy(900);
  };

  const toggleInterest = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    const has = glim.interests.includes(id);
    if (has && glim.interests.length === 1) return; // keep at least one
    updateGlim({ interests: has ? glim.interests.filter((i) => i !== id) : [...glim.interests, id] });
    if (!has) glimRef.current?.absorb();
  };

  const setReminder = async (hhmm: string) => {
    updateGlim({ reminderTime: hhmm }); // useReminderSync (home) rebuilds the plan
    try {
      if (!(await requestNotificationPermission())) showNotificationPermissionAlert();
    } catch {}
  };

  const handleRateApp = async () => {
    if (await StoreReview.isAvailableAsync()) StoreReview.requestReview();
    else Linking.openURL(`https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`);
  };

  const handleShareApp = () => {
    Share.share({ message: `I'm growing ${glim.name} on Unloq — one small thing learned every day instead of doomscrolling. https://loqlearn.com` });
  };

  const handleRestorePurchases = async () => {
    Haptics.selectionAsync();
    try {
      const info = await Purchases.restorePurchases();
      const isActive = !!info.entitlements.active['premium'] || info.activeSubscriptions.length > 0;
      if (isActive) Alert.alert('Subscription restored', 'Your premium subscription has been restored.');
      else Alert.alert('No active subscription', 'No active subscription was found for this Apple ID. If you think this is wrong, contact us.', [
        { text: 'Contact support', onPress: () => Linking.openURL(`${SUPPORT}?subject=Subscription%20Restore%20Issue`) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Restore failed', 'Could not reach the App Store. Check your connection and try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  const studiedToday = !!questLog[dayKey()];

  return (
    <View style={st.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: insets.bottom + 40, gap: Spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: F.extraBold, fontSize: fs(30), color: C.text, letterSpacing: -0.8 }}>Profile</Text>

        {/* ── Glim card ── */}
        <Animated.View entering={FadeInDown.duration(320)}>
          <LinearGradient colors={['#100F18', '#07060B']} style={[st.glimCard, { borderColor: C.border }]}>
            <Pressable onPress={() => glimRef.current?.poke()} style={{ alignItems: 'center', marginTop: -70, marginBottom: 4 }}>
              <Glim ref={glimRef} size={140} stage={glim.stage} palette={palette} mood={studiedToday ? 'happy' : 'idle'} />
            </Pressable>
            <View style={{ alignItems: 'center', gap: 4 }}>
              {editingName ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  onBlur={saveName}
                  onSubmitEditing={saveName}
                  autoFocus
                  maxLength={16}
                  returnKeyType="done"
                  selectionColor={accent}
                  style={{ fontFamily: F.extraBold, fontSize: fs(24), color: C.text, textAlign: 'center', minWidth: 120, borderBottomWidth: 1, borderBottomColor: accent, paddingVertical: 2 }}
                />
              ) : (
                <Pressable onPress={() => { setNameDraft(glim.name); setEditingName(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: F.extraBold, fontSize: fs(24), color: C.text }}>{glim.name}</Text>
                  <Ionicons name="pencil" size={13} color={C.muted} />
                </Pressable>
              )}
              <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.sub }}>
                {GLIM_STAGES[progress.stage].name} · {glim.xp} XP
              </Text>
            </View>
            {/* stage ladder */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: Spacing.md }}>
              {GLIM_STAGES.map((s, i) => {
                const fill = i < progress.stage ? 1 : i === progress.stage ? progress.pct : 0;
                return (
                  <View key={s.name} style={{ flex: 1, gap: 6 }}>
                    <View style={st.ladderTrack}>
                      <View style={[st.ladderFill, { width: `${Math.max(fill * 100, i <= progress.stage ? 6 : 0)}%`, backgroundColor: accent }]} />
                    </View>
                    <Text style={{ fontFamily: F.semiBold, fontSize: fs(10), color: i <= progress.stage ? C.text : C.muted, textAlign: 'center' }}>{s.name}</Text>
                  </View>
                );
              })}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Highlights ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat C={C} F={F} fs={fs} icon="flame" tint={C.warning} value={stats.streak} label="Day streak" />
            <Stat C={C} F={F} fs={fs} icon="checkmark-done" tint={C.success} value={stats.learned} label="Learned" />
            <Stat C={C} F={F} fs={fs} icon="mic-outline" tint={C.text} value={stats.explained ? stats.score : 0} label="Avg score" />
          </View>
          <Pressable onPress={() => open('stats')} style={({ pressed }) => [st.card, st.rowCard, { opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name="stats-chart-outline" size={18} color={C.text} />
            <Text style={[st.rowLabel, { fontSize: fs(15) }]}>View all stats</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
        </Animated.View>

        {/* ── Settings, one tap away ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <View style={st.card}>
            <Row C={C} F={F} fs={fs} icon="options-outline" label="Learning settings" onPress={() => open('learning')} first />
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="person-circle-outline" label="Account & subscription" value={isPremium ? 'Pro' : undefined} onPress={() => open('account')} />
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="information-circle-outline" label="About Unloq" onPress={() => open('about')} />
          </View>
        </Animated.View>
      </ScrollView>

      <StatsScreen visible={screen === 'stats'} onClose={close} />
      <Sheet visible={screen === 'learning'} title="Learning" onClose={close}>

          <View style={[st.card, { gap: 18 }]}>
            <View style={{ gap: 10 }}>
              <Text style={st.label}>Daily time</Text>
              <Segmented
                C={C} F={F} fs={fs}
                options={MINUTE_OPTIONS.map((m) => ({ id: String(m.value), label: m.label }))}
                value={String(glim.dailyMinutes)}
                onChange={(v) => updateGlim({ dailyMinutes: Number(v) })}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={st.label}>Interests</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {INTERESTS.map((i) => {
                  const on = glim.interests.includes(i.id);
                  return (
                    <Pressable
                      key={i.id}
                      onPress={() => toggleInterest(i.id)}
                      style={[st.chip, on ? { backgroundColor: C.text, borderColor: C.text } : { borderColor: C.border }]}
                    >
                      <Ionicons name={i.icon} size={14} color={on ? C.bg : C.sub} />
                      <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: on ? C.bg : C.sub }}>{i.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={st.card}>
            {notifStatus === 'granted' || notifStatus === 'unknown' ? (
              <Row C={C} F={F} fs={fs} icon="notifications-outline" label="Daily reminder" value={fmtTime(glim.reminderTime)}
                onPress={() => { Haptics.selectionAsync(); setShowTime((v) => !v); }} chevron={showTime ? 'chevron-up' : 'chevron-down'} first />
            ) : (
              <Row C={C} F={F} fs={fs} icon="notifications-off-outline" label="Daily reminder" value="Off · Turn on"
                onPress={async () => { Haptics.selectionAsync(); await turnOnReminders(); refreshNotif(); }} first />
            )}
            {showTime && (
              <DateTimePicker
                value={toDate(glim.reminderTime)}
                mode="time"
                display="spinner"
                themeVariant="dark"
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowTime(false);
                  if (!d) return;
                  setReminder(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                }}
              />
            )}
            <Divider C={C} />
            <View style={st.row}>
              <Ionicons name="text-outline" size={18} color={C.sub} />
              <Text style={[st.rowLabel, { fontSize: fs(15) }]}>Text size</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StepBtn C={C} icon="remove" disabled={fontScale <= FONT_SCALE_MIN} onPress={decreaseFontScale} />
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.text, minWidth: 44, textAlign: 'center' }}>{Math.round(fontScale * 100)}%</Text>
                <StepBtn C={C} icon="add" disabled={fontScale >= FONT_SCALE_MAX} onPress={increaseFontScale} />
              </View>
            </View>
          </View>
              </Sheet>
      <Sheet visible={screen === 'account'} title="Account" onClose={close}>

          <View style={st.card}>
            <View style={[st.row, { paddingTop: 0 }]}>
              <View style={[st.avatar, { backgroundColor: C.surfaceAlt }]}>
                <Text style={{ fontFamily: F.extraBold, fontSize: fs(15), color: C.text }}>
                  {(viewer?.name?.[0] ?? viewer?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(15), color: C.text }} numberOfLines={1}>
                  {viewer?.name ?? (viewer ? 'Learner' : 'Not signed in')}
                </Text>
                {!!viewer?.email && <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.muted }} numberOfLines={1}>{viewer.email}</Text>}
              </View>
              <View style={[st.badge, isPremium ? { backgroundColor: C.goldBg, borderColor: `${C.gold}55` } : { borderColor: C.border }]}>
                <Text style={{ fontFamily: F.semiBold, fontSize: fs(11), color: isPremium ? C.gold : C.sub }}>{isPremium ? 'Premium' : 'Free'}</Text>
              </View>
            </View>
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="refresh-outline" label="Restore purchases" onPress={handleRestorePurchases} />
            {!!viewer && (
              <>
                <Divider C={C} />
                <Row C={C} F={F} fs={fs} icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
                <Divider C={C} />
                <Row C={C} F={F} fs={fs} icon="trash-outline" label="Delete account" danger
                  onPress={() => Linking.openURL(`${SUPPORT}?subject=Delete%20My%20Account`)} />
              </>
            )}
          </View>
              </Sheet>
      <Sheet visible={screen === 'about'} title="About" onClose={close}>

          <View style={st.card}>
            <Row C={C} F={F} fs={fs} icon="star-outline" label="Rate Unloq" onPress={handleRateApp} first />
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="share-outline" label="Share Unloq" onPress={handleShareApp} />
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="shield-checkmark-outline" label="Privacy policy"
              onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/privacy-policy.html')} />
            <Divider C={C} />
            <Row C={C} F={F} fs={fs} icon="document-text-outline" label="Terms of service"
              onPress={() => Linking.openURL('https://hassancode1.github.io/unloq/terms-of-service.html')} />
          </View>
          <Text style={{ textAlign: 'center', fontFamily: F.regular, fontSize: fs(12), color: C.muted, marginTop: Spacing.sm }}>
            Unloq 1.0.0
          </Text>
              </Sheet>
    </View>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

type P = { C: AppColors; F: any; fs: (n: number) => number };

function Stat({ C, F, fs, icon, tint, value, label }: P & { icon: any; tint: string; value: number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 14, gap: 6 }}>
      <Ionicons name={icon} size={16} color={value ? tint : C.muted} />
      <Text style={{ fontFamily: F.extraBold, fontSize: fs(24), color: C.text }}>{value}</Text>
      <Text style={{ fontFamily: F.regular, fontSize: fs(12), color: C.sub }}>{label}</Text>
    </View>
  );
}

function Skill({ C, F, fs, label, value, color }: P & { label: string; value: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: F.regular, fontSize: fs(13), color: C.sub }}>{label}</Text>
        <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: C.text }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${value}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function Segmented({ C, F, fs, options, value, onChange }: P & {
  options: { id: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(o.id); } }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: on ? C.borderStrong : 'transparent' }}
          >
            <Text style={{ fontFamily: F.semiBold, fontSize: fs(13), color: on ? C.text : C.sub }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ C, F, fs, icon, label, value, onPress, danger, chevron, first }: P & {
  icon: any; label: string; value?: string; onPress: () => void; danger?: boolean; chevron?: any; first?: boolean;
}) {
  const color = danger ? C.error : C.text;
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingTop: first ? 0 : 14 }}>
      <Ionicons name={icon} size={18} color={danger ? C.error : C.sub} />
      <Text style={{ flex: 1, fontFamily: F.medium, fontSize: fs(15), color }}>{label}</Text>
      {!!value && <Text style={{ fontFamily: F.semiBold, fontSize: fs(14), color: C.sub }}>{value}</Text>}
      {!danger && <Ionicons name={chevron ?? 'chevron-forward'} size={14} color={C.muted} />}
    </TouchableOpacity>
  );
}

function StepBtn({ C, icon, disabled, onPress }: { C: AppColors; icon: any; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Ionicons name={icon} size={16} color={C.text} />
    </TouchableOpacity>
  );
}

function Divider({ C }: { C: AppColors }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 32 }} />;
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    glimCard: { borderRadius: 28, borderWidth: 1, padding: Spacing.lg },
    ladderTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
    ladderFill: { height: 4, borderRadius: 2 },
    card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
    cap: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.sub, paddingHorizontal: 4 },
    label: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    rowCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    rowLabel: { flex: 1, fontFamily: 'Inter-Medium', color: C.text },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  });
}
