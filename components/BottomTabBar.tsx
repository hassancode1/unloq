import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

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
  { id: 'home',    label: 'Home',    icon: 'home-outline',    iconFilled: 'home-sharp' },
  { id: 'library', label: 'Library', icon: 'library-outline', iconFilled: 'library' },
  { id: 'profile', label: 'Profile', icon: 'person-outline',  iconFilled: 'person' },
];

function TabItem({
  item,
  isActive,
  onPress,
  C,
  F,
  fs,
}: {
  item: (typeof TAB_ITEMS)[number];
  isActive: boolean;
  onPress: () => void;
  C: AppColors;
  F: typeof FontFamily;
  fs: (n: number) => number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.tabItemInner, { transform: [{ scale }] }]}>
        <Ionicons
          name={(isActive ? item.iconFilled : item.icon) as any}
          size={24}
          color={isActive ? C.text : C.muted}
        />
        <Text style={[styles.tabLabel, { color: isActive ? C.text : C.muted, fontFamily: F.semiBold, fontSize: fs(11) }]}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CreateButton({ onPress, C }: { onPress: () => void; C: AppColors }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };

  return (
    <Pressable
      style={styles.createButtonWrapper}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.createButton, { backgroundColor: C.text, transform: [{ scale }] }]}>
        <Ionicons name="add" size={32} color={C.bg} />
      </Animated.View>
    </Pressable>
  );
}

export default function BottomTabBar({ activeTab, onTabPress, onCreatePress, C, F, fs, bottomInset }: Props) {
  const handleTabPress = (tab: HomeTab) => {
    Haptics.selectionAsync();
    onTabPress(tab);
  };

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreatePress();
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: bottomInset || 8 }]}>
      <TabItem item={TAB_ITEMS[0]} isActive={activeTab === 'home'}    onPress={() => handleTabPress('home')}    C={C} F={F} fs={fs} />
      <TabItem item={TAB_ITEMS[1]} isActive={activeTab === 'library'} onPress={() => handleTabPress('library')} C={C} F={F} fs={fs} />
      <CreateButton onPress={handleCreate} C={C} />
      <TabItem item={TAB_ITEMS[2]} isActive={activeTab === 'profile'} onPress={() => handleTabPress('profile')} C={C} F={F} fs={fs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabLabel: {
    marginTop: 2,
  },
  createButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
