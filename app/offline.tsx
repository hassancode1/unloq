import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';

type Props = { onRetry: () => void };

export default function OfflineScreen({ onRetry }: Props) {
  const { C, F, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  };

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={S.iconWrap}>
        <View style={[S.iconCircle, { backgroundColor: `${C.muted}14`, borderColor: `${C.muted}28` }]}>
          <Ionicons name="wifi-outline" size={44} color={C.muted} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400)} style={S.content}>
        <Text style={[S.title, { fontFamily: F.extraBold, fontSize: fs(26), color: C.text }]}>
          No Internet Connection
        </Text>
        <Text style={[S.sub, { fontFamily: F.regular, fontSize: fs(15), color: C.sub }]}>
          Unloq needs an internet connection to load your lessons and sync progress.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(400)}
        style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
      >
        <TouchableOpacity
          style={[S.btn, { backgroundColor: C.primary }]}
          activeOpacity={0.85}
          onPress={handleRetry}
        >
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={[S.btnTxt, { fontFamily: F.bold, fontSize: fs(16) }]}>
            Try Again
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  root:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap:   { marginBottom: Spacing.xl },
  iconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  content:    { alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  title:      { textAlign: 'center' },
  sub:        { textAlign: 'center', lineHeight: 22, marginTop: Spacing.xs },
  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg },
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 16, paddingVertical: Spacing.md },
  btnTxt:     { color: '#fff' },
});
