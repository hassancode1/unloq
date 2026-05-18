import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store/useAppStore';
import { Spacing } from '../constants/spacing';

export default function LockedScreen() {
  const { C, F, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const { setFlow, blockDurationHours } = useAppStore();

  // Pulsing glow rings
  const outerScale = useSharedValue(1);
  const innerScale = useSharedValue(1);
  // Progress bar fill
  const barWidth = useSharedValue(0);
  // Button press scale
  const btnScale = useSharedValue(1);

  useEffect(() => {
    outerScale.value = withRepeat(
      withSequence(withTiming(1.18, { duration: 1600 }), withTiming(1, { duration: 1600 })),
      -1, true,
    );
    innerScale.value = withRepeat(
      withSequence(withTiming(1.10, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1, true,
    );
    barWidth.value = withTiming(0.65, { duration: 1800 });
  }, []);

  const outerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: 0.12 + (outerScale.value - 1) * 0.3,
  }));
  const innerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    opacity: 0.18 + (innerScale.value - 1) * 0.4,
  }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleStudyNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlow('home');
  };

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Glow rings + lock icon ── */}
      <Animated.View entering={FadeInUp.duration(500)} style={S.iconArea}>
        <Animated.View style={[S.outerGlow, { backgroundColor: C.primary }, outerGlowStyle]} />
        <Animated.View style={[S.innerGlow, { backgroundColor: C.primary }, innerGlowStyle]} />
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.lockGradient}
        >
          <Ionicons name="lock-closed" size={38} color="#fff" />
        </LinearGradient>
      </Animated.View>

      {/* ── Content card ── */}
      <Animated.View
        entering={FadeInDown.delay(60).duration(460)}
        style={[S.card, { backgroundColor: C.surface, borderColor: C.border }]}
      >
        <Text style={[S.title, { fontFamily: F.extraBold, fontSize: fs(26), color: C.text }]}>
          Your apps are locked
        </Text>
        <Text style={[S.sub, { fontFamily: F.regular, fontSize: fs(15), color: C.sub }]}>
          You committed to{' '}
          <Text style={{ fontFamily: F.bold, color: C.primary }}>
            {blockDurationHours === 0.5 ? '30 mins' : `${blockDurationHours}h`} of focused study
          </Text>
          {' '}today. Complete your session to unlock.
        </Text>

        {/* Progress bar */}
        <View style={[S.trackBg, { backgroundColor: `${C.primary}18` }]}>
          <Animated.View style={[S.trackFill, { backgroundColor: C.primary }, barStyle]} />
        </View>
        <Text style={[S.trackLabel, { fontFamily: F.semiBold, fontSize: fs(12), color: C.muted }]}>
          Session in progress
        </Text>
      </Animated.View>

      {/* ── CTA button ── */}
      <Animated.View
        entering={FadeInDown.delay(180).duration(460)}
        style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }, btnStyle]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() => { btnScale.value = withSpring(0.97, { damping: 12 }); }}
          onPressOut={() => { btnScale.value = withSpring(1, { damping: 12 }); }}
          onPress={handleStudyNow}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={S.btn}
          >
            <Text style={[S.btnTxt, { fontFamily: F.bold, fontSize: fs(16) }]}>
              Start Studying
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  // Glow rings
  iconArea: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  innerGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  lockGradient: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Content card
  card: {
    width: '88%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    textAlign: 'center',
    lineHeight: 32,
  },
  sub: {
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 2,
  },
  trackBg: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  trackLabel: {
    letterSpacing: 0.4,
  },
  // Button
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
    borderRadius: 18,
    paddingVertical: 18,
  },
  btnTxt: {
    color: '#fff',
  },
});
