import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from 'convex/react';
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from '../convex/_generated/api';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAppStore, FONT_SCALE_MIN, FONT_SCALE_MAX, type GoalConfig } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import type { AppColors } from '../constants/Colors';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtLockTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtFrequency(g: GoalConfig): string {
  if (g.frequency === 'daily') return 'Every day';
  if (g.frequency === 'weekdays') return 'Mon – Fri';
  const days = [...g.customDays].sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(', ');
  return days || '—';
}

export default function SettingsScreen({ onNavigateToCourses }: { onNavigateToCourses?: () => void }) {
  const insets = useSafeAreaInsets();
  const { C, isDark, fs, fontScale, F } = useTheme();
  const { goalConfig, setFlow, toggleDarkMode, increaseFontScale, decreaseFontScale } = useAppStore();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const viewer = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text
          style={[
            styles.headerTitle,
            { fontSize: fs(26), fontFamily: F.bold, color: C.text },
          ]}
        >
          Profile
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <Animated.View
          entering={FadeInDown.duration(280)}
          style={styles.identity}
        >
          <View style={[styles.avatarRing, { borderColor: `${C.primary}40` }]}>
            {viewer?.image ? (
              <Image source={{ uri: viewer.image }} style={styles.avatarImg} />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: `${C.primary}18` }]}
              >
                {viewer?.name ? (
                  <Text
                    style={{
                      fontSize: fs(32),
                      fontFamily: F.bold,
                      color: C.primary,
                    }}
                  >
                    {viewer.name[0].toUpperCase()}
                  </Text>
                ) : (
                  <Text style={{ fontSize: fs(38) }}>🎓</Text>
                )}
              </View>
            )}
          </View>
          <Text
            style={[
              styles.identityName,
              { fontSize: fs(22), fontFamily: F.bold, color: C.text },
            ]}
          >
            {viewer?.name ?? "Learner"}
          </Text>
          <Text
            style={[
              styles.identitySub,
              { fontSize: fs(12), fontFamily: F.regular, color: C.muted },
            ]}
          >
            Seeker of Knowledge
          </Text>
        </Animated.View>

        {/* ── Appearance ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(280)}>
          <Text
            style={[
              styles.cap,
              { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted },
            ]}
          >
            Appearance
          </Text>
          <View style={styles.card}>
            {/* Dark mode row */}
            <View style={styles.row}>
              <View
                style={[styles.iconBox, { backgroundColor: `${C.primary}18` }]}
              >
                <Ionicons
                  name={isDark ? "moon" : "sunny-outline"}
                  size={16}
                  color={C.primary}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.text },
                ]}
              >
                {isDark ? "Dark Mode" : "Light Mode"}
              </Text>
              <Switch
                value={isDark}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  toggleDarkMode();
                }}
                trackColor={{ false: C.border, true: `${C.primary}70` }}
                thumbColor={isDark ? C.primary : C.muted}
                ios_backgroundColor={C.border}
              />
            </View>

            <View style={styles.separator} />

            {/* Font size row */}
            <View style={styles.row}>
              <View
                style={[styles.iconBox, { backgroundColor: `${C.primary}18` }]}
              >
                <Ionicons name="text-outline" size={16} color={C.primary} />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.text },
                ]}
              >
                Text Size
              </Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    { borderColor: C.border, backgroundColor: C.surfaceAlt },
                    fontScale <= FONT_SCALE_MIN && styles.stepBtnDisabled,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    decreaseFontScale();
                  }}
                  disabled={fontScale <= FONT_SCALE_MIN}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.stepBtnA,
                      {
                        color:
                          fontScale <= FONT_SCALE_MIN ? C.muted : C.primary,
                        fontFamily: F.bold,
                        fontSize: 15,
                      },
                    ]}
                  >
                    A
                  </Text>
                  <Ionicons
                    name="remove"
                    size={9}
                    color={fontScale <= FONT_SCALE_MIN ? C.muted : C.primary}
                  />
                </TouchableOpacity>

                <View
                  style={[
                    styles.stepDisplay,
                    { borderColor: C.border, backgroundColor: C.surfaceAlt },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepDisplayTxt,
                      {
                        fontSize: fs(12),
                        fontFamily: F.semiBold,
                        color: C.text,
                      },
                    ]}
                  >
                    {Math.round(fontScale * 100)}%
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    { borderColor: C.border, backgroundColor: C.surfaceAlt },
                    fontScale >= FONT_SCALE_MAX && styles.stepBtnDisabled,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    increaseFontScale();
                  }}
                  disabled={fontScale >= FONT_SCALE_MAX}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.stepBtnA,
                      {
                        color:
                          fontScale >= FONT_SCALE_MAX ? C.muted : C.primary,
                        fontFamily: F.bold,
                        fontSize: 20,
                      },
                    ]}
                  >
                    A
                  </Text>
                  <Ionicons
                    name="add"
                    size={9}
                    color={fontScale >= FONT_SCALE_MAX ? C.muted : C.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Learning Goal ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(280)}>
          <Text
            style={[
              styles.cap,
              { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted },
            ]}
          >
            Learning Goal
          </Text>
          <View style={styles.card}>
            {goalConfig ? (
              <>
                {[
                  {
                    icon: "calendar-outline",
                    label: "Frequency",
                    value: fmtFrequency(goalConfig),
                  },
                  {
                    icon: "book-outline",
                    label: "Daily lessons",
                    value: `${goalConfig.lessonTarget} lesson${goalConfig.lessonTarget !== 1 ? "s" : ""}`,
                  },
                  {
                    icon: "notifications-outline",
                    label: "Reminder time",
                    value: fmtLockTime(goalConfig.lockTime),
                  },
                ].map((item, i, arr) => (
                  <View key={item.label}>
                    <View style={styles.row}>
                      <View
                        style={[
                          styles.iconBox,
                          { backgroundColor: `${C.primary}12` },
                        ]}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={15}
                          color={C.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.rowLabel,
                          {
                            fontSize: fs(14),
                            fontFamily: F.medium,
                            color: C.sub,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          {
                            fontSize: fs(14),
                            fontFamily: F.semiBold,
                            color: C.text,
                          },
                        ]}
                      >
                        {item.value}
                      </Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.separator} />}
                  </View>
                ))}
                <View style={styles.separator} />
                <TouchableOpacity
                  style={styles.actionRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFlow("goalsetup");
                  }}
                >
                  <Ionicons name="create-outline" size={15} color={C.primary} />
                  <Text
                    style={[
                      styles.actionTxt,
                      {
                        fontSize: fs(14),
                        fontFamily: F.medium,
                        color: C.primary,
                      },
                    ]}
                  >
                    Edit goal
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={C.primary}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.actionRow}
                activeOpacity={0.7}
                onPress={() => setFlow("goalsetup")}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={15}
                  color={C.primary}
                />
                <Text
                  style={[
                    styles.actionTxt,
                    {
                      fontSize: fs(14),
                      fontFamily: F.medium,
                      color: C.primary,
                    },
                  ]}
                >
                  Set up your learning goal
                </Text>
                <Ionicons name="chevron-forward" size={14} color={C.primary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── My Courses ── */}
        <Animated.View entering={FadeInDown.delay(150).duration(280)}>
          <Text style={[styles.cap, { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted }]}>
            My Courses
          </Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync();
                onNavigateToCourses?.();
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: `${C.primary}12` }]}>
                <Ionicons name="book-outline" size={15} color={C.primary} />
              </View>
              <Text style={[styles.actionTxt, { fontSize: fs(14), fontFamily: F.medium, color: C.primary }]}>
                View my courses
              </Text>
              <Ionicons name="chevron-forward" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── App Info ── */}
        <Animated.View entering={FadeInDown.delay(210).duration(280)}>
          <Text
            style={[
              styles.cap,
              { fontSize: fs(10), fontFamily: F.extraBold, color: C.muted },
            ]}
          >
            About
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View
                style={[styles.iconBox, { backgroundColor: `${C.primary}12` }]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={15}
                  color={C.primary}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.sub },
                ]}
              >
                Version
              </Text>
              <Text
                style={[
                  styles.rowValue,
                  { fontSize: fs(14), fontFamily: F.semiBold, color: C.text },
                ]}
              >
                1.0.0
              </Text>
            </View>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() =>
                Linking.openURL(
                  "https://hassancode1.github.io/unloq/privacy-policy.html",
                )
              }
            >
              <View
                style={[styles.iconBox, { backgroundColor: `${C.primary}12` }]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={15}
                  color={C.primary}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.sub },
                ]}
              >
                Privacy Policy
              </Text>
              <Ionicons name="open-outline" size={14} color={C.muted} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() =>
                Linking.openURL(
                  "https://hassancode1.github.io/unloq/terms-of-service.html",
                )
              }
            >
              <View
                style={[styles.iconBox, { backgroundColor: `${C.primary}12` }]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color={C.primary}
                />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.sub },
                ]}
              >
                Terms of Service
              </Text>
              <Ionicons name="open-outline" size={14} color={C.muted} />
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleSignOut}
            >
              <View
                style={[styles.iconBox, { backgroundColor: `${C.error}18` }]}
              >
                <Ionicons name="log-out-outline" size={15} color={C.error} />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: C.error },
                ]}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() =>
                Linking.openURL(
                  "mailto:support@loqlearn.com?subject=Delete%20My%20Account",
                )
              }
            >
              <View style={[styles.iconBox, { backgroundColor: "#FEE2E218" }]}>
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { fontSize: fs(14), fontFamily: F.medium, color: "#EF4444" },
                ]}
              >
                Delete Account
              </Text>
              <Ionicons name="open-outline" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text
          style={[
            styles.footer,
            { fontSize: fs(12), fontFamily: F.regular, color: C.muted },
          ]}
        >
          Made with 💛 for seekers of knowledge
        </Text>
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

    content: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      gap: Spacing.lg,
    },

    identity: { alignItems: 'center', gap: 10, paddingBottom: Spacing.sm },
    avatarRing: { padding: 4, borderRadius: 50, borderWidth: 2 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImg: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    identityName: {},
    identitySub: { letterSpacing: 0.2 },

    cap: {
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      paddingHorizontal: 2,
      marginBottom: Spacing.sm,
    },

    card: {
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
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 56 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      gap: 12,
    },
    iconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    rowLabel: { flex: 1 },
    rowValue: {},

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      gap: 12,
    },
    actionTxt: { flex: 1 },

    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    stepBtnDisabled: { opacity: 0.35 },
    stepBtnA: { lineHeight: 22 },
    stepDisplay: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: 52,
      alignItems: 'center',
    },
    stepDisplayTxt: {},

    footer: { textAlign: 'center', paddingVertical: Spacing.md },
  });
}
