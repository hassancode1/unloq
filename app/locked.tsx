import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';
import { hasSelection } from '../lib/familyControls';


export default function LockedScreen() {
  const { C, F, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const { setFlow, goalConfig, dailyProgress } = useAppStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayStr ? dailyProgress.count : 0;
  const target = goalConfig?.lessonTarget ?? 1;
  const remaining = Math.max(0, target - todayDone);

  const [appsSelected, setAppsSelected] = useState(true);
  useEffect(() => {
    hasSelection().then(setAppsSelected).catch(() => setAppsSelected(true));
  }, []);

  const handleStudyNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlow('home');
  };

  const handleAddApps = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlow('goalsetup');
  };

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={S.iconWrap}>
        <View style={[S.lockCircle, { backgroundColor: `${appsSelected ? C.primary : C.muted}14`, borderColor: `${appsSelected ? C.primary : C.muted}28` }]}>
          <Text style={S.lockEmoji}>{appsSelected ? '🔒' : '📱'}</Text>
        </View>
      </Animated.View>

      {appsSelected ? (
        <>
          <Animated.View entering={FadeInDown.duration(400)} style={S.content}>
            <Text style={[S.title, { fontFamily: F.extraBold, fontSize: fs(28), color: C.text }]}>
              Apps are locked
            </Text>
            <Text style={[S.sub, { fontFamily: F.regular, fontSize: fs(15), color: C.sub }]}>
              Complete{' '}
              <Text style={{ fontFamily: F.bold, color: C.primary }}>
                {remaining} more lesson{remaining !== 1 ? 's' : ''}
              </Text>
              {' '}to unlock your day
            </Text>

            {target > 0 && (
              <View style={S.pipRow}>
                {Array.from({ length: target }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      S.pip,
                      { backgroundColor: `${C.primary}28`, borderColor: `${C.primary}45` },
                      i < todayDone && { backgroundColor: C.primary, borderColor: C.primary },
                    ]}
                  />
                ))}
              </View>
            )}

            <Text style={[S.progress, { fontFamily: F.semiBold, fontSize: fs(13), color: C.muted }]}>
              {todayDone} / {target} lessons done today
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <TouchableOpacity
              style={[S.btn, { backgroundColor: C.primary }]}
              activeOpacity={0.85}
              onPress={handleStudyNow}
            >
              <Text style={[S.btnTxt, { fontFamily: F.bold, fontSize: fs(16) }]}>
                Study Now
              </Text>
              <Text style={[S.btnArrow, { fontSize: fs(16) }]}>→</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(400)} style={S.content}>
            <Text style={[S.title, { fontFamily: F.extraBold, fontSize: fs(28), color: C.text }]}>
              No Apps Blocked Yet
            </Text>
            <Text style={[S.sub, { fontFamily: F.regular, fontSize: fs(15), color: C.sub }]}>
              Pick apps to block until you complete your lessons each day.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl), gap: Spacing.sm }]}>
            <TouchableOpacity
              style={[S.btn, { backgroundColor: C.primary }]}
              activeOpacity={0.85}
              onPress={handleAddApps}
            >
              <Text style={[S.btnTxt, { fontFamily: F.bold, fontSize: fs(16) }]}>
                Add Apps to Block
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btn, { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border }]}
              activeOpacity={0.85}
              onPress={handleStudyNow}
            >
              <Text style={[S.btnTxt, { fontFamily: F.semiBold, fontSize: fs(16), color: C.sub }]}>
                Study Now
              </Text>
              <Text style={[S.btnArrow, { fontSize: fs(16), color: C.sub }]}>→</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: Spacing.xl,
  },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockEmoji: {
    fontSize: 44,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  title: {
    textAlign: 'center',
  },
  sub: {
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  pipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.md,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  progress: {
    marginTop: Spacing.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: 16,
    paddingVertical: Spacing.md,
  },
  btnTxt: {
    color: '#fff',
  },
  btnArrow: {
    color: '#fff',
  },
});
