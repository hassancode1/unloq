// A quiet nudge on Today for people who have notifications off: one tap to turn
// them on (the system prompt if they never decided, otherwise iPhone Settings,
// since iOS only asks once). Hides itself once granted; "x" hides it for 14 days.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { AppColors } from '../../constants/Colors';
import { turnOnReminders, useNotificationStatus } from '../../lib/notifications';
import { useAppStore } from '../../store/useAppStore';

const HIDE_DAYS = 14;

/** Whether the card should show (Today also uses this to give Glim's area a bit less height). */
export function useReminderCardVisible() {
  const { status } = useNotificationStatus();
  const hasLearned = useAppStore((s) => Object.keys(s.questLog).length > 0);
  const asked = useAppStore((s) => s.reminderAsked);
  const dismissedAt = useAppStore((s) => s.reminderCardDismissedAt);
  // denied: iOS won't ask again. undetermined: only once our own offer was declined.
  const off = status === 'denied' || (status === 'undetermined' && asked);
  const hidden = dismissedAt != null && Date.now() - dismissedAt < HIDE_DAYS * 86_400_000;
  return hasLearned && off && !hidden;
}

export default function ReminderCard({ C, F, fs }: { C: AppColors; F: any; fs: (n: number) => number }) {
  const { refresh } = useNotificationStatus();
  const name = useAppStore((s) => s.glim.name);
  const dismiss = useAppStore((s) => s.dismissReminderCard);

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(360)} style={{ marginTop: 10 }}>
      <Pressable
        onPress={async () => { Haptics.selectionAsync().catch(() => {}); await turnOnReminders(); refresh(); }}
        accessibilityRole="button"
        accessibilityLabel="Turn on reminders"
        style={({ pressed }) => [st.row, { backgroundColor: C.surface, borderColor: C.border, opacity: pressed ? 0.88 : 1 }]}
      >
        <Ionicons name="notifications-off-outline" size={20} color={C.sub} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: fs(15) }}>Reminders are off</Text>
          <Text style={{ color: C.muted, fontFamily: F.semiBold, fontSize: fs(12) }}>
            {name} can nudge you once a day. Never spam.
          </Text>
        </View>
        <View style={[st.pill, { backgroundColor: C.text }]}>
          <Text style={{ color: C.bg, fontFamily: F.bold, fontSize: fs(13) }}>Turn on</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Hide this" style={st.x}>
          <Ionicons name="close" size={16} color={C.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 20, paddingVertical: 11, paddingLeft: 16, paddingRight: 10 },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  x: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
