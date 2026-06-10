import { NativeModules, Platform } from 'react-native';

const { FamilyControlsModule } = NativeModules;

if (Platform.OS === 'ios' && !FamilyControlsModule) {
  console.warn(
    '[FamilyControls] Native module not found. ' +
    'This usually means the Family Controls capability is missing from the App ID in the Apple Developer portal. ' +
    'Available NativeModules: ' + Object.keys(NativeModules).join(', ')
  );
}

function noop(): Promise<any> {
  return Promise.reject(new Error(
    'FamilyControls native module unavailable — ensure the Family Controls capability is enabled for this App ID in the Apple Developer portal and rebuild.'
  ));
}

const mod = Platform.OS === 'ios' && FamilyControlsModule ? FamilyControlsModule : null;

/** Returns 'notDetermined' | 'denied' | 'approved' */
export function getAuthorizationStatus(): Promise<'notDetermined' | 'denied' | 'approved'> {
  return mod ? mod.getAuthorizationStatus() : noop();
}

/** Prompts the iOS Screen Time authorization dialog */
export function requestAuthorization(): Promise<'approved'> {
  return mod ? mod.requestAuthorization() : noop();
}

/**
 * Opens the native iOS FamilyActivityPicker — shows the user's real installed
 * apps and app categories. Resolves with the count of selected items, or
 * rejects with code 'CANCELLED' if the user dismisses.
 */
export function presentActivityPicker(): Promise<number> {
  return mod ? mod.presentActivityPicker() : noop();
}

/** True if the user has already picked at least one app/category */
export function hasSelection(): Promise<boolean> {
  return mod ? mod.hasSelection() : Promise.resolve(false);
}

/** Number of apps + categories currently selected */
export function getBlockedCount(): Promise<number> {
  return mod ? mod.getBlockedCount() : Promise.resolve(0);
}

/**
 * Applies ManagedSettings shields to the selected apps.
 * Call this when the user hasn't met their lesson goal yet.
 * Returns true if any apps were shielded, false if no selection exists.
 */
export function blockApps(): Promise<boolean> {
  return mod ? mod.blockApps() : Promise.resolve(false);
}

/**
 * Removes ManagedSettings shields without recording lesson completion.
 * Call this when shields should be lifted for non-completion reasons
 * (e.g. before lock time, non-goal day, blocking disabled).
 */
export function clearShields(): Promise<boolean> {
  return mod ? mod.clearShields() : Promise.resolve(true);
}

/**
 * Removes all ManagedSettings shields AND records today as completed.
 * Call this ONLY when the user has met their daily lesson target — this
 * prevents the background UnloqMonitor extension from re-applying shields.
 */
export function unblockApps(): Promise<boolean> {
  return mod ? mod.unblockApps() : Promise.resolve(true);
}

/**
 * Starts a recurring daily DeviceActivity schedule (lockTime → 11:59pm).
 * The UnloqMonitor extension fires at lockTime each day and re-applies shields
 * automatically, even when the app is closed. Call once after goal setup.
 * Requires iOS 16+.
 *
 * iOS fires intervalDidStart immediately if called after lockTime has already
 * passed today, so shields apply right away on first enable too.
 */
export function startMonitoring(lockHour: number, lockMinute: number): Promise<boolean> {
  return mod ? mod.startMonitoring(lockHour, lockMinute) : Promise.resolve(false);
}

/**
 * Stops all DeviceActivity monitoring schedules.
 * Only call this if the user disables blocking entirely.
 */
export function stopMonitoring(): Promise<boolean> {
  return mod ? mod.stopMonitoring() : Promise.resolve(true);
}

/**
 * Writes today's lesson progress to the shared App Group UserDefaults so the
 * UnloqShield extension can read it and display accurate progress on the native
 * block screen.
 */
export function setStudyProgress(completed: number, target: number): Promise<void> {
  return mod ? mod.setStudyProgress(completed, target) : Promise.resolve();
}
