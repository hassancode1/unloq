// Loading screen: Glim rises out of the dark, the wordmark settles in under it,
// and a thin light slides along a track while the app boots.
// Shown before fonts load, so it uses the system font only.
import * as NativeSplash from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Glim from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';
import { O } from '../components/onboarding/ui';
import { useAppStore } from '../store/useAppStore';

// The splash mounts more than once during boot (fonts, then auth/RevenueCat).
// Play the intro only the first time so it never re-fades mid-launch.
let introPlayed = false;

const TRACK = 56;
const THUMB = 18;
const ease = Easing.out(Easing.cubic);

export default function SplashScreen() {
  const interests = useAppStore((s) => s.glim.interests);
  const skip = introPlayed;

  const glim = useSharedValue(skip ? 1 : 0);
  const word = useSharedValue(skip ? 1 : 0);
  const slide = useSharedValue(0);

  useEffect(() => {
    introPlayed = true;
    if (!skip) {
      glim.value = withDelay(120, withTiming(1, { duration: 900, easing: ease }));
      word.value = withDelay(550, withTiming(1, { duration: 700, easing: ease }));
    }
    slide.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, []);

  const glimStyle = useAnimatedStyle(() => ({
    opacity: glim.value,
    transform: [{ translateY: (1 - glim.value) * 16 }, { scale: 0.94 + glim.value * 0.06 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 6 }],
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * Math.sin(slide.value * Math.PI),
    transform: [{ translateX: -THUMB + slide.value * (TRACK + THUMB) }],
  }));

  return (
    // Hand over from the native splash only once this view is drawn, so the
    // intro is actually seen (dark → dark, no flash).
    <View style={s.root} onLayout={() => NativeSplash.hideAsync().catch(() => {})}>
      <Animated.View style={glimStyle}>
        <Glim
          size={132}
          stage={4}
          palette={paletteForInterests(interests)}
          mood="idle"
          interactive={false}
          wander={false}
        />
      </Animated.View>
      <Animated.View style={[s.below, wordStyle]}>
        <Text style={s.word}>Unloq</Text>
        <View style={s.track}>
          <Animated.View style={[s.thumb, thumbStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: O.bg, paddingBottom: 40 },
  below: { alignItems: 'center', marginTop: 36 },
  word: { color: O.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  track: {
    marginTop: 18,
    width: TRACK,
    height: 2,
    borderRadius: 1,
    backgroundColor: O.faint,
    overflow: 'hidden',
  },
  thumb: { width: THUMB, height: 2, borderRadius: 1, backgroundColor: '#A9CBFF' },
});
