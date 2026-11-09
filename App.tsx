import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, LogBox } from "react-native";
import Purchases from "react-native-purchases";
import { useConvexAuth, useQuery, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { api } from "./convex/_generated/api";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
import Toast from "react-native-toast-message";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useAppStore, type GoalConfig } from "./store/useAppStore";
import { blockApps, unblockApps, clearShields } from "./lib/familyControls";
import ScreenBlocking from "./lib/screenBlocking";
import { setupNotificationHandler } from "./lib/notifications";
import { ProgressSync } from "./lib/progressSync";
import AppSplashScreen from "./app/splash";
import OnboardingScreen from "./app/onboarding";
import HomeScreen from "./app/home";
import ProGate from "./app/pro-gate";
import PaywallHost from "./components/paywall/PaywallHost";
import GlimLab from "./app/glim-lab";
import { QuestResultPreview } from "./components/quest/QuestResult";

// Dev-only: render the Glim mascot playground instead of the app.
const GLIM_LAB = __DEV__ && false;
// Dev-only: open the quest result screen with sample data (animation review).
const RESULT_PREVIEW = __DEV__ && false;
// Dev-only: always start at onboarding so it can be replayed on every reload.
const FORCE_ONBOARDING = __DEV__ && false;

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// ── Locking logic ─────────────────────────────────────────────────────────────

function computeShouldLock(
  goalConfig: GoalConfig | null,
  dailyProgress: { date: string; count: number; sessionStartMs: number | null },
  blockDurationHours: number,
  sessionCompletedDate: string | null,
  courses: any[] | undefined,
): boolean {
  if (!goalConfig) return false;

  // No ready courses → nothing to study, don't lock
  const readyCourses = (courses ?? []).filter((c: any) => c.status === 'ready');
  if (readyCourses.length === 0) return false;

  // All lessons complete across every ready course → don't lock
  const allDone = readyCourses.every(
    (c: any) => c.lessonCount > 0 && c.completedCount >= c.lessonCount,
  );
  if (allDone) return false;

  // Not a goal day → don't lock
  const day = new Date().getDay();
  const isGoalDay =
    goalConfig.frequency === 'daily'
      ? true
      : goalConfig.frequency === 'weekdays'
      ? day >= 1 && day <= 5
      : goalConfig.customDays.includes(day);
  if (!isGoalDay) return false;

  // Only lock after the user's chosen lock time each day
  const parts = goalConfig.lockTime?.split(':').map(Number) ?? [];
  const lockHour = parts[0] ?? 0;
  const lockMin  = parts[1] ?? 0;
  const now = new Date();
  const isAfterLockTime =
    !isNaN(lockHour) && !isNaN(lockMin) && (
      now.getHours() > lockHour ||
      (now.getHours() === lockHour && now.getMinutes() >= lockMin)
    );
  if (!isAfterLockTime) return false;

  const todayDate = now.toLocaleDateString('en-CA'); // local YYYY-MM-DD

  // Grace period: don't lock on the day the goal was first set
  if (goalConfig.goalSetDate === todayDate) return false;

  // Session already marked complete today (set when duration goal is met)
  if (sessionCompletedDate === todayDate) return false;

  // Duration goal already met today — check elapsed wall-clock time
  if (dailyProgress.date === todayDate && dailyProgress.sessionStartMs !== null) {
    const elapsed = Date.now() - dailyProgress.sessionStartMs;
    if (elapsed >= blockDurationHours * 3_600_000) return false;
  }

  return true;
}

function LockCheck() {
  const {
    flow, setFlow, goalConfig, dailyProgress, blockingEnabled,
    blockDurationHours, startBlockSession, sessionCompletedDate,
  } = useAppStore();
  const courses = useQuery(api.courses.listMineWithProgress);

  // Stable ref so the AppState handler always sees the latest values
  const ref = useRef({
    flow, setFlow, goalConfig, dailyProgress, courses, blockingEnabled,
    blockDurationHours, startBlockSession, sessionCompletedDate,
  });
  useEffect(() => {
    ref.current = {
      flow, setFlow, goalConfig, dailyProgress, courses, blockingEnabled,
      blockDurationHours, startBlockSession, sessionCompletedDate,
    };
  });

  const check = useCallback(() => {
    const {
      flow, setFlow, goalConfig, dailyProgress, courses, blockingEnabled,
      blockDurationHours, startBlockSession, sessionCompletedDate,
    } = ref.current;
    if (flow !== 'home' && flow !== 'locked') return;
    if (!blockingEnabled) {
      if (flow === 'locked') setFlow('home');
      clearShields().catch(() => {}); // remove shields without stamping completion date
      return;
    }
    if (courses === undefined) return; // still loading
    const shouldLock = computeShouldLock(
      goalConfig, dailyProgress, blockDurationHours, sessionCompletedDate, courses,
    );
    setFlow(shouldLock ? 'locked' : 'home');
    if (shouldLock) {
      startBlockSession(); // stamp session start time so duration tracking begins
      blockApps().catch((e) => {
        Toast.show({ type: 'error', text1: 'Blocking unavailable', text2: 'Could not lock apps. Check Screen Time permissions in Settings.' });
      });
    } else {
      // Only stamp today's completion date when duration goal is genuinely done —
      // doing so prematurely would cause the background UnloqMonitor extension to
      // skip blocking when the lock time eventually arrives.
      const todayDate = new Date().toLocaleDateString('en-CA');
      if (sessionCompletedDate === todayDate) {
        unblockApps().catch(() => {});
      } else {
        clearShields().catch(() => {});
      }
    }
  }, []);

  // Lock when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  // Periodic check while app is in foreground — catches lockTime crossing without an AppState event
  useEffect(() => {
    if (flow !== 'home') return;
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [flow, check]);

  // Initial check once courses have loaded from Convex (run only once — not on every live-query update)
  const didInitialCheck = useRef(false);

  // If the user taps "Study Now" before courses finish loading, mark the initial
  // check as done so the courses-load effect doesn't re-lock them.
  const prevFlowRef = useRef(flow);
  useEffect(() => {
    if (prevFlowRef.current === 'locked' && flow === 'home') {
      didInitialCheck.current = true;
    }
    prevFlowRef.current = flow;
  }, [flow]);

  useEffect(() => {
    if (courses !== undefined && !didInitialCheck.current) {
      didInitialCheck.current = true;
      check();
    }
  }, [courses]);

  // Auto-unlock when a lesson is completed and goal is now met
  useEffect(() => {
    if (flow === 'locked') check();
  }, [dailyProgress.count, dailyProgress.date]);

  return null;
}

function RevenueCatSync() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const setRevenueCatReady = useAppStore((s) => s.setRevenueCatReady);

  useEffect(() => {
    if (isLoading) return; // don't act on the "not signed in yet" state at launch
    if (isAuthenticated && user?._id) {
      Purchases.logIn(user._id)
        .then(() => {
          setRevenueCatReady(true);
          // Silently sync the App Store receipt so prior purchases are recognised
          // after a reinstall without requiring the user to manually tap "Restore".
          Purchases.restorePurchases().catch(() => {});
        })
        // Still mark ready so nothing waits forever (e.g. no RevenueCat key in dev).
        .catch(() => setRevenueCatReady(true));
    } else if (!isAuthenticated) {
      // Signed out (or never signed in): RevenueCat runs on an anonymous id,
      // which is enough to buy/start a trial — so entitlements must still load.
      Purchases.logOut().catch(() => {}).finally(() => setRevenueCatReady(true));
    }
  }, [isLoading, isAuthenticated, user?._id]);

  return null;
}

// Shows the splash screen while we wait for RevenueCat to identify the user,
// preventing a flash of "upgrade" UI for pro subscribers on app open.
// Only gates the FIRST launch: once the app has shown, signing in later must
// not swap everything for the splash — that unmounted the sign-in sheet
// mid-flow and made people sign in twice.
function AppGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const revenueCatReady = useAppStore((s) => s.revenueCatReady);
  const booted = useRef(false);
  const [rcTimedOut, setRcTimedOut] = useState(false);

  // Never wait on RevenueCat for more than 3s.
  useEffect(() => {
    const t = setTimeout(() => setRcTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const waiting = authLoading || (isAuthenticated && !revenueCatReady && !rcTimedOut);
  if (!booted.current && waiting) return <AppSplashScreen />;
  booted.current = true;
  return <>{children}</>;
}

SplashScreen.preventAutoHideAsync();
setupNotificationHandler();

// Dev overlay: RevenueCat logs a user cancelling Apple's sheet at error level.
// That's a normal outcome (the paywall just resets), not a bug.
LogBox.ignoreLogs([/Purchase was cancelled/]);

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
if (REVENUECAT_IOS_KEY) {
  Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
}

export default function App() {
  const { flow, setFlow } = useAppStore();

  const [fontsLoaded] = useFonts({
    "Nunito-Regular":   Nunito_400Regular,
    "Nunito-Medium":    Nunito_500Medium,
    "Nunito-SemiBold":  Nunito_600SemiBold,
    "Nunito-Bold":      Nunito_700Bold,
    "Nunito-ExtraBold": Nunito_800ExtraBold,
    // Onboarding type: Space Grotesk headlines, Inter body
    "SpaceGrotesk-Medium":   SpaceGrotesk_500Medium,
    "SpaceGrotesk-SemiBold": SpaceGrotesk_600SemiBold,
    "SpaceGrotesk-Bold":     SpaceGrotesk_700Bold,
    "Inter-Regular":  Inter_400Regular,
    "Inter-Medium":   Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold":     Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Onboarding saves the Glim profile only on its last step, so a profile
      // with interests means it was already finished — go straight home.
      const finished = useAppStore.getState().glim.interests.length > 0;
      if (FORCE_ONBOARDING) setFlow("onboarding");
      else if (flow === "loading" || flow === "onboarding") setFlow(finished ? "home" : "onboarding");
    }
  }, [fontsLoaded]);

  // Enable screen recording protection once the user is in the app
  useEffect(() => {
    if (flow === "home" || flow === "locked") {
      ScreenBlocking.enableScreenBlocking().catch(() => {});
    }
  }, [flow]);

  if (!fontsLoaded) return <AppSplashScreen />;

  if (RESULT_PREVIEW) {
    return (
      <SafeAreaProvider>
        <QuestResultPreview />
      </SafeAreaProvider>
    );
  }

  if (GLIM_LAB) {
    return (
      <SafeAreaProvider>
        <GlimLab />
      </SafeAreaProvider>
    );
  }

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <RevenueCatSync />
      <ProgressSync />
      <LockCheck />
      <AppGate>
        <SafeAreaProvider>
          {flow === "onboarding" && (
            <OnboardingScreen onComplete={() => setFlow("home")} />
          )}
          {/* App blocking is legacy — goalsetup / locked flows land on home. */}
          {(flow === "home" || flow === "goalsetup" || flow === "locked") && (
            // Hard paywall: no Pro → "Glim is resting" (see lib/features.ts)
            <ProGate><HomeScreen /></ProGate>
          )}
          {flow !== "onboarding" && <StatusBar style="light" />}
          <PaywallHost />
        </SafeAreaProvider>
        <Toast />
      </AppGate>
    </ConvexAuthProvider>
  );
}
