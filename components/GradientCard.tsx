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
        withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,  { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.00, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: scale.value }, { rotate: '15deg' }],
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
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.wrapper, { width, opacity: isDark ? 0.85 : 1 }]}
    >
      <LinearGradient
        colors={[...gradientColors] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 155,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  contentCol: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 4,
    paddingRight: 130,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Nunito-ExtraBold',
    lineHeight: 23,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  pillText: {
    color: '#1a1a2e',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
  },
  mascot: {
    position: 'absolute',
    right: -20,
    bottom: -10,
    width: 160,
    height: 200,
  },
});
