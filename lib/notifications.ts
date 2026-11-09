import { useEffect, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { GoalConfig, useAppStore } from '../store/useAppStore';
import { currentStreak, dayKey } from './quests';
import { planNudges } from './nudgePlan';

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
        title: 'Your quest is ready',
        body: 'A new topic is waiting. Explain it and help your Glim grow.',
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
    'To receive study reminders, enable notifications for Unloq in Settings.',
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

// ── Daily nudge ──────────────────────────────────────────────────────────────
// One gentle notification a day at most, at the time the person scrolls (their
// onboarding answer), and only when it's useful:
//   • never if they've already learned today (each nudge is a one-off date, and
//     the plan is rebuilt after every quest);
//   • it backs off when ignored: after their last quest we nudge on days
//     +1, +2, +3, then +5 and +7, then stay silent until they come back;
//   • never before 08:00 or after 22:00;
//   • local notifications only — no server, no cost.
// Rebuilt on app start, on return to the app, after each quest, and when the
// reminder time changes (see useReminderSync in app/home.tsx).

/** The plan stays in step with the app: rebuilt whenever it could have changed. */
export function useReminderSync() {
  const questLog = useAppStore((s) => s.questLog);
  const extras = useAppStore((s) => s.extras);
  const reminderTime = useAppStore((s) => s.glim.reminderTime);
  const name = useAppStore((s) => s.glim.name);
  useEffect(() => { syncReminders(); }, [questLog, extras, reminderTime, name]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncReminders(); });
    return () => sub.remove();
  }, []);
}

/** The current notification permission, refreshed whenever the app comes back to the front
 * (so it updates right after someone turns notifications on in iPhone Settings). */
export function useNotificationStatus() {
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>('unknown');
  useEffect(() => {
    let alive = true;
    const read = () => getNotificationPermissionStatus().then((s) => { if (alive) setStatus(s); });
    read();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') read(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  return { status, refresh: () => getNotificationPermissionStatus().then(setStatus) };
}

/**
 * "Turn on reminders". iOS asks only once: if they never decided, show the system prompt;
 * if they said no, the only way back is iPhone Settings, so open it.
 * Returns true when it opened Settings (the status refreshes when they come back).
 */
export async function turnOnReminders(): Promise<'granted' | 'settings' | 'declined'> {
  const status = await getNotificationPermissionStatus();
  if (status === 'granted') { syncReminders(); return 'granted'; }
  if (status === 'undetermined') {
    const ok = await requestNotificationPermission();
    if (ok) syncReminders();
    return ok ? 'granted' : 'declined';
  }
  await Linking.openSettings();
  return 'settings';
}

/**
 * People who tapped "Not now" in onboarding get ONE friendly second chance,
 * right after their first quest. iOS shows its own prompt only once, so this
 * asks in our words first; if they decline, Settings is the only place left.
 */
export async function offerRemindersOnce(petName: string): Promise<void> {
  const st = useAppStore.getState();
  if (st.reminderAsked) return;
  if ((await getNotificationPermissionStatus()) !== 'undetermined') { st.setReminderAsked(true); return; }
  st.setReminderAsked(true);
  Alert.alert(
    `Want ${petName} to remind you?`,
    'One gentle reminder a day, and none on days you’ve already learned.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Yes, remind me', onPress: async () => { if (await requestNotificationPermission()) syncReminders(); } },
    ],
  );
}
/** Rebuild the nudge plan. Safe to call any time; always replaces the old plan. */
export async function syncReminders(): Promise<void> {
  try {
    await cancelStudyReminders(); // also clears the old repeating weekly ones
    if ((await getNotificationPermissionStatus()) !== 'granted') return;

    const st = useAppStore.getState();
    // Day of the last quest (daily or extra); with none yet, count from today.
    const days = [...Object.keys(st.questLog), ...Object.keys(st.extras ?? {})].sort();
    const last = days.length ? new Date(`${days[days.length - 1]}T12:00:00`) : new Date();
    const plan = planNudges({
      last, now: new Date(), hhmm: st.glim.reminderTime || '20:00', name: st.glim.name || 'Glim',
      streak: days.length ? currentStreak(st.questLog, last) : 0,
    });
    for (const n of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDENTIFIER_PREFIX}${dayKey(n.at)}`,
        content: { title: n.title, body: n.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at },
      });
    }
    if (__DEV__) console.log(`[nudge] scheduled ${plan.length}, last quest ${days[days.length - 1] ?? 'none'}`);
  } catch {}
}
