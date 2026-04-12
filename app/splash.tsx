import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const PRIMARY   = '#6366F1';
const PRIMARY_DIM = '#818CF8';
const BG        = '#0F0F14';

export default function SplashScreen() {
  // Logo scale + fade
  const logoScale   = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);

  // Lock shackle open→close animation
  const shackleY = useSharedValue(-10);

  // Title slide up
  const titleY       = useSharedValue(18);
  const titleOpacity = useSharedValue(0);

  // Tagline
  const tagOpacity = useSharedValue(0);

  // Pulsing ring
  const ringScale   = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  // Dots
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Logo entrance
    logoScale.value   = withSpring(1,   { damping: 14, stiffness: 180 });
    logoOpacity.value = withTiming(1,   { duration: 400 });

    // Shackle closes
    shackleY.value = withDelay(300, withSpring(0, { damping: 10, stiffness: 200 }));

    // Pulse ring
    ringOpacity.value = withDelay(200, withTiming(0.35, { duration: 300 }));
    ringScale.value   = withDelay(200, withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1200, easing: Easing.out(Easing.ease) }),
        withTiming(1,    { duration: 1200, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      true,
    ));

    // Title
    titleOpacity.value = withDelay(420, withTiming(1, { duration: 380 }));
    titleY.value       = withDelay(420, withSpring(0, { damping: 16, stiffness: 160 }));

    // Tagline
    tagOpacity.value = withDelay(680, withTiming(1, { duration: 380 }));

    // Loading dots — staggered bounce
    const dotAnim = (sv: Animated.SharedValue<number>, delay: number) => {
      sv.value = withDelay(900 + delay, withRepeat(
        withSequence(
          withTiming(1,  { duration: 340, easing: Easing.out(Easing.quad) }),
          withTiming(0,  { duration: 340, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ));
    };
    dotAnim(dot1, 0);
    dotAnim(dot2, 160);
    dotAnim(dot3, 320);
  }, []);

  const logoStyle  = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const shackleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shackleY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity:   ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity:   titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({ opacity: tagOpacity.value }));

  const dotStyle = (sv: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity:   interpolate(sv.value, [0, 1], [0.3, 1]),
      transform: [{ translateY: interpolate(sv.value, [0, 1], [0, -6]) }],
    }));

  return (
    <View style={S.root}>
      {/* Background glow */}
      <Animated.View style={[S.glow, ringStyle]} />

      {/* Lock icon */}
      <Animated.View style={[S.logoWrap, logoStyle]}>
        {/* Lock body */}
        <View style={S.lockBody}>
          <View style={S.lockBodyInner} />
        </View>
        {/* Shackle */}
        <Animated.View style={[S.shackleWrap, shackleStyle]}>
          <View style={S.shackleLeft} />
          <View style={S.shackleTop} />
          <View style={S.shackleRight} />
        </Animated.View>
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[S.title, titleStyle]}>
        unloq
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[S.tag, tagStyle]}>
        exam prep that actually sticks
      </Animated.Text>

      {/* Dots */}
      <View style={S.dots}>
        <Animated.View style={[S.dot, dotStyle(dot1)]} />
        <Animated.View style={[S.dot, dotStyle(dot2)]} />
        <Animated.View style={[S.dot, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

const LOCK_W  = 52;
const LOCK_H  = 44;
const SHACKLE = 5;

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },

  glow: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    backgroundColor: PRIMARY,
    opacity: 0.08,
  },

  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: `${PRIMARY}22`,
    borderWidth: 1.5,
    borderColor: `${PRIMARY}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  // Lock body
  lockBody: {
    width: LOCK_W,
    height: LOCK_H,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  lockBodyInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },

  // Shackle (U shape drawn with 3 rectangles)
  shackleWrap: {
    position: 'absolute',
    top: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: LOCK_W - 16,
    height: 28,
  },
  shackleLeft: {
    width: SHACKLE,
    height: 22,
    borderRadius: 3,
    backgroundColor: PRIMARY_DIM,
  },
  shackleTop: {
    flex: 1,
    height: SHACKLE,
    borderRadius: 3,
    backgroundColor: PRIMARY_DIM,
    marginTop: 0,
    marginHorizontal: -1,
  },
  shackleRight: {
    width: SHACKLE,
    height: 22,
    borderRadius: 3,
    backgroundColor: PRIMARY_DIM,
  },

  title: {
    fontSize: 38,
    fontFamily: 'Inter-ExtraBold',
    color: '#fff',
    letterSpacing: -1,
  },

  tag: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: `${PRIMARY_DIM}CC`,
    letterSpacing: 0.3,
  },

  dots: {
    position: 'absolute',
    bottom: 72,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
});
