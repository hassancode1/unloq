import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import Glim from '../components/mascot/Glim';
import { paletteForInterests } from '../components/mascot/palettes';
import { useAppStore } from '../store/useAppStore';

type Props = { onRetry: () => void };

export default function OfflineScreen({ onRetry }: Props) {
  const { C, F, fs } = useTheme();
  const glimProfile = useAppStore((st) => st.glim);
  const insets = useSafeAreaInsets();

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  };

  return (
    <View style={[S.root, { backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={S.iconWrap}>
        <Glim size={130} stage={glimProfile.stage} palette={paletteForInterests(glimProfile.interests)} mood="sleepy" droop={0.3} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400)} style={S.content}>
        <Text style={[S.title, { fontFamily: F.extraBold, fontSize: fs(26), color: C.text }]}>
          You’re offline
        </Text>
        <Text style={[S.sub, { fontFamily: F.regular, fontSize: fs(15), color: C.sub }]}>
          {glimProfile.name} can’t reach your notes right now. Reconnect and try again.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(400)}
        style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
      >
        <TouchableOpacity
          style={[S.btn, { backgroundColor: C.text }]}
          activeOpacity={0.85}
          onPress={handleRetry}
        >
          <Ionicons name="refresh-outline" size={18} color={C.bg} />
          <Text style={[S.btnTxt, { fontFamily: F.bold, fontSize: fs(16), color: C.bg }]}>
            Try again
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
