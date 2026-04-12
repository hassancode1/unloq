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
 * Removes all ManagedSettings shields.
 * Call this when the user meets their daily lesson target.
 */
export function unblockApps(): Promise<boolean> {
  return mod ? mod.unblockApps() : Promise.resolve(true);
}
