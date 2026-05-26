import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';

interface Props {
  title: string;
  subtitle: string;
  gradientColors: readonly [string, string];
  onPress: () => void;
  badge?: string;
  isDark?: boolean;
  imageSource?: ImageSourcePropType;
  actionLabel?: string;
  width?: number;
}

function AnimatedMascot({ source }: { source: ImageSourcePropType }) {
  const float = useSharedValue(0);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,  { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.00, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: scale.value }, { rotate: '12deg' }],
  }));

  return (
    <Animated.Image
      source={source}
      style={[styles.mascot, animStyle]}
      resizeMode="contain"
    />
  );
}

export default function GradientCard({
  title, subtitle, gradientColors, onPress, badge, isDark,
  imageSource, actionLabel, width = 220,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.80}
      onPress={onPress}
      style={[styles.shadow, { width }]}
    >
      <View style={[styles.wrapper, { opacity: isDark ? 0.92 : 1 }]}>
        <LinearGradient
          colors={[...gradientColors] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Glass sheen highlight */}
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassSheen}
            pointerEvents="none"
          />

          {/* Decorative concentric arcs (top-right corner) */}
          <View style={styles.arc1} pointerEvents="none" />
          <View style={styles.arc2} pointerEvents="none" />
          <View style={styles.arc3} pointerEvents="none" />

          {/* Decorative dot cluster (bottom-left) */}
          <View style={styles.dotCluster} pointerEvents="none">
            {[0,1,2].map(row => (
              <View key={row} style={{ flexDirection: 'row', gap: 5 }}>
                {[0,1,2].map(col => (
                  <View
                    key={col}
                    style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.18)' }}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.contentCol}>
            {badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
            {actionLabel && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{actionLabel}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {imageSource && <AnimatedMascot source={imageSource} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 14,
  },
  wrapper: {
    height: 182,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  arc1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    top: -70,
    right: -40,
  },
  arc2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    top: -30,
    right: -5,
  },
  arc3: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    top: 5,
    right: 30,
  },
  dotCluster: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    gap: 5,
    opacity: 0.6,
  },
  contentCol: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 2,
    paddingRight: 138,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontFamily: 'Nunito-Bold',
    letterSpacing: 0.2,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: 'Nunito-ExtraBold',
    lineHeight: 28,
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    lineHeight: 17,
    marginTop: 3,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  pillText: {
    color: '#120824',
    fontSize: 12,
    fontFamily: 'Nunito-ExtraBold',
    letterSpacing: 0.1,
  },
  mascot: {
    position: 'absolute',
    right: -14,
    bottom: -8,
    width: 185,
    height: 225,
  },
});
