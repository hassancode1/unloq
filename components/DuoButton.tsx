import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { AppColors } from '../constants/Colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    shadow: {
      borderRadius: 16,
      marginBottom: 4,
    },
    shadowPrimary: {
      backgroundColor: C.primaryRing,
    },
    shadowOutline: {
      backgroundColor: C.border,
    },
    btn: {
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: {
      backgroundColor: C.primary,
      transform: [{ translateY: -4 }],
    },
    btnOutline: {
      backgroundColor: C.surface,
      borderWidth: 2,
      borderColor: C.border,
      transform: [{ translateY: -4 }],
    },
    btnDisabled: {
      backgroundColor: C.muted,
    },
    label: {
      fontSize: 16,
      fontFamily: 'Nunito-Bold',
    },
    labelPrimary: {
      color: '#ffffff',
    },
    labelOutline: {
      color: C.text,
    },
    labelDisabled: {
      color: '#ffffff',
    },
  });
}

export default function DuoButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(translateY, {
      toValue: 4,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.shadow, isPrimary ? styles.shadowPrimary : styles.shadowOutline, style]}
    >
      <Animated.View
        style={[
          styles.btn,
          isPrimary && styles.btnPrimary,
          isOutline && styles.btnOutline,
          disabled && styles.btnDisabled,
          { transform: [{ translateY }] },
        ]}
      >
        <Text
          style={[
            styles.label,
            isPrimary && styles.labelPrimary,
            isOutline && styles.labelOutline,
            disabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
