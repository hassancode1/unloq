// "Add notes" sheet. PDF is the hero (most students start there); the other
// sources sit beside it at a lower weight — not four equal rows.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColors } from '../constants/Colors';
import { FontFamily } from '../constants/theme';

export type CreateOptionKey = 'pdf' | 'youtube' | 'text' | 'capture';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSelectOption: (opt: CreateOptionKey) => void;
  C: AppColors;
  F: typeof FontFamily;
  fs: (n: number) => number;
}

const SMALL: { key: CreateOptionKey; label: string; icon: any }[] = [
  { key: 'capture', label: 'Photo',   icon: 'camera-outline' },
  { key: 'text',    label: 'Text',    icon: 'create-outline' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
];

export default function CreateModal({ visible, onDismiss, onSelectOption, C, F, fs }: Props) {
  const insets = useSafeAreaInsets();
  const pick = (k: CreateOptionKey) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectOption(k);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: C.surface, borderColor: C.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: C.borderStrong }]} />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontFamily: F.extraBold, fontSize: fs(22), letterSpacing: -0.4 }}>Add notes</Text>
            <Text style={{ color: C.sub, fontFamily: F.regular, fontSize: fs(13), marginTop: 2 }}>
              We’ll turn it into flashcards, quizzes and Feynman practice.
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={12} style={[styles.close, { backgroundColor: C.surfaceAlt }]}>
            <Ionicons name="close" size={18} color={C.sub} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => pick('pdf')}
          style={({ pressed }) => [styles.hero, { backgroundColor: C.text, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
            <Ionicons name="document-text" size={22} color={C.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.bg, fontFamily: F.extraBold, fontSize: fs(17) }}>Upload a PDF</Text>
            <Text style={{ color: C.bg, opacity: 0.6, fontFamily: F.regular, fontSize: fs(13) }}>Lecture slides, readings, notes</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={C.bg} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {SMALL.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => pick(o.key)}
              style={({ pressed }) => [styles.tile, { backgroundColor: C.surfaceAlt, borderColor: C.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name={o.icon} size={22} color={C.text} />
              <Text style={{ color: C.text, fontFamily: F.semiBold, fontSize: fs(13) }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 10, paddingHorizontal: 18, gap: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 20 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 18, borderWidth: 1 },
});
