import * as Notifications from 'expo-notifications';
import { GoalConfig } from '../store/useAppStore';

const NOTIFICATION_IDENTIFIER_PREFIX = 'unloq-study-reminder-';

// Set notification handler — silently no-ops in Expo Go (native module missing)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function getDaysForConfig(cfg: GoalConfig): number[] {
  switch (cfg.frequency) {
    case 'daily':    return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays': return [1, 2, 3, 4, 5];
    case 'custom':   return cfg.customDays;
    default:         return [];
  }
}

export async function scheduleStudyReminders(cfg: GoalConfig): Promise<void> {
  try {
    await cancelStudyReminders();
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const days = getDaysForConfig(cfg);
    if (days.length === 0) return;

    const [hourStr, minuteStr] = cfg.lockTime.split(':');
    const hour   = parseInt(hourStr,   10);
    const minute = parseInt(minuteStr, 10);

    for (const weekday of days) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDENTIFIER_PREFIX}${weekday}`,
        content: {
          title: 'Time to learn 📖',
          body: "Complete today's lesson to stay on track.",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1, // expo: 1=Sun … 7=Sat
          hour,
          minute,
        },
      });
    }
  } catch {
    // Silently ignore — notifications unavailable in Expo Go
  }
}

export async function cancelStudyReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) => n.identifier.startsWith(NOTIFICATION_IDENTIFIER_PREFIX));
    await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {}
}

export async function cancelTodayReminder(): Promise<void> {
  try {
    const today = new Date().getDay();
    await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_IDENTIFIER_PREFIX}${today}`);
  } catch {}
}
