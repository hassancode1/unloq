import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionTimerBanner() {
  const { blockingEnabled, dailyProgress, blockDurationHours, sessionCompletedDate, flow } =
    useAppStore();
  const [elapsed, setElapsed] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const start = dailyProgress.sessionStartMs;
    if (!start) return;
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dailyProgress.sessionStartMs]);

  const goalSecs = blockDurationHours * 3600;
  const todayDate = new Date().toLocaleDateString('en-CA');

  const visible =
    flow === 'home' &&
    blockingEnabled &&
    dailyProgress.sessionStartMs !== null &&
    sessionCompletedDate !== todayDate &&
    elapsed < goalSecs;

  if (!visible) return null;

  const remaining = Math.max(0, goalSecs - elapsed);

  return (
    <View
      style={[styles.pill, { top: insets.top + 10, right: 14 }]}
      pointerEvents="none"
    >
      <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.85)" style={styles.icon} />
      <Text style={styles.label}>{fmt(remaining)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,27,75,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    zIndex: 999,
  },
  icon: {
    marginTop: 0.5,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
