// Floating dark pill tab bar. The active highlight is one object that slides
// between tabs (it stays mounted — motion has a cause, nothing pops).
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { AppColors } from '../constants/Colors';
import { FontFamily } from '../constants/theme';

export type HomeTab = 'home' | 'library' | 'profile';

interface Props {
  activeTab: HomeTab;
  onTabPress: (tab: HomeTab) => void;
  onCreatePress: () => void;
  C: AppColors;
  F: typeof FontFamily;
  fs: (n: number) => number;
  bottomInset: number;
}

const TAB_ITEMS: { id: HomeTab; label: string; icon: string; iconFilled: string }[] = [
  { id: 'home',    label: 'Today',   icon: 'sunny-outline',   iconFilled: 'sunny' },
  { id: 'library', label: 'Library', icon: 'albums-outline',  iconFilled: 'albums' },
  { id: 'profile', label: 'Profile', icon: 'person-outline',  iconFilled: 'person' },
];

const EASE = Easing.bezier(0.25, 0.8, 0.25, 1);
const PAD = 5;

export default function BottomTabBar({ activeTab, onTabPress, onCreatePress, C, F, fs, bottomInset }: Props) {
  const [tabsW, setTabsW] = useState(0);
  const idx = TAB_ITEMS.findIndex((t) => t.id === activeTab);
  const tabW = tabsW / TAB_ITEMS.length;

  const x = useSharedValue(0);
  useEffect(() => {
    if (tabW) x.value = withTiming(idx * tabW, { duration: 320, easing: EASE });
  }, [idx, tabW]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const press = (tab: HomeTab) => {
    if (tab !== activeTab) Haptics.selectionAsync().catch(() => {});
    onTabPress(tab);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <View style={[styles.bar, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={{ flex: 1, flexDirection: 'row' }} onLayout={(e: LayoutChangeEvent) => setTabsW(e.nativeEvent.layout.width)}>
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: tabW - PAD * 2, backgroundColor: C.surfaceAlt, borderColor: C.borderStrong }, pillStyle]}
            />
          )}
          {TAB_ITEMS.map((item) => {
            const on = item.id === activeTab;
            return (
              <Pressable key={item.id} onPress={() => press(item.id)} style={styles.tab} hitSlop={4}>
                <Ionicons name={(on ? item.iconFilled : item.icon) as any} size={19} color={on ? C.text : C.muted} />
                <Text style={{ color: on ? C.text : C.muted, fontFamily: F.semiBold, fontSize: fs(11), marginTop: 3 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onCreatePress(); }}
          style={({ pressed }) => [styles.create, { backgroundColor: C.text, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          accessibilityLabel="Learn something new"
        >
          <Ionicons name="add" size={24} color={C.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    padding: PAD,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: PAD,
    borderRadius: 24,
    borderWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  create: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
