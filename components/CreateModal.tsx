import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateOptionColors } from '../constants/Colors';
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

interface OptionConfig {
  key: CreateOptionKey;
  label: string;
  desc: string;
  colorKey: string;
  icon: string;
}

const OPTIONS: OptionConfig[] = [
  { key: 'capture', label: 'Capture Text or Image',  desc: 'Photo or gallery image — AI reads and generates lessons', colorKey: 'capture', icon: 'camera' },
  { key: 'pdf',     label: 'PDF Document',           desc: 'Upload a PDF and AI generates your lessons',              colorKey: 'pdf',     icon: 'document-text' },
  { key: 'text',    label: 'Custom Text',            desc: 'Paste or type any text to generate a note',              colorKey: 'text',    icon: 'text' },
  { key: 'youtube', label: 'YouTube Video',          desc: 'Paste a YouTube link to generate a note',                colorKey: 'youtube', icon: 'logo-youtube' },
];

export default function CreateModal({ visible, onDismiss, onSelectOption, C, F, fs }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: C.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: C.text, fontFamily: F.extraBold, fontSize: fs(18) }]}>
            ✨ Create Note / Learning
          </Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={24} color={C.sub} />
          </TouchableOpacity>
        </View>

        {OPTIONS.map((opt) => {
          const accent = CreateOptionColors[opt.colorKey] ?? C.primary;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.row, { backgroundColor: `${accent}14`, borderColor: `${accent}30` }]}
              onPress={() => onSelectOption(opt.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${accent}22` }]}>
                <Ionicons name={opt.icon as any} size={22} color={accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: C.text, fontFamily: F.bold, fontSize: fs(15) }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.rowDesc, { color: C.sub, fontFamily: F.regular, fontSize: fs(12) }]}>
                  {opt.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0E0',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {},
  rowDesc: {},
});
