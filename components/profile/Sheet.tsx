// A full-height sheet with a title and a close button — the frame for the
// Profile sub-screens (Stats, Quest detail, Learning, Account, About).
import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F, O } from '../onboarding/ui';

export default function Sheet({ visible, title, onClose, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.top}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={s.close} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={O.sub} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A plain card section with an optional small label. */
export function Section({ label, children, style }: { label?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[s.card, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  title: { color: O.text, fontFamily: F.black, fontSize: 26, letterSpacing: -0.6 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: O.card },
  card: { backgroundColor: O.card, borderColor: O.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  label: { color: O.sub, fontFamily: F.semi, fontSize: 12 },
});
