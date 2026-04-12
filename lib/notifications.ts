import { Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GoalConfig } from '../store/useAppStore';

const NOTIFICATION_IDENTIFIER_PREFIX = 'unloq-study-reminder-';

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

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

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'undetermined';
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

/**
 * Schedules weekly study reminder notifications.
 * Returns true if notifications were scheduled, false if permission was denied.
 * Throws if scheduling fails for a reason other than permission.
 */
export async function scheduleStudyReminders(cfg: GoalConfig): Promise<boolean> {
  await cancelStudyReminders();

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const days = getDaysForConfig(cfg);
  if (days.length === 0) return true;

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

  return true;
}

export function showNotificationPermissionAlert() {
  Alert.alert(
    'Notifications disabled',
    'To receive study reminders, enable notifications for Loqlearn in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
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
