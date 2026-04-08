import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import Purchases from "react-native-purchases";
import { useConvexAuth, useQuery, ConvexReactClient } from "convex/react";
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
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { useAppStore, type GoalConfig } from "./store/useAppStore";
import { blockApps, unblockApps } from "./lib/familyControls";
import ScreenBlocking from "./lib/screenBlocking";
import AppSplashScreen from "./app/splash";
import OnboardingScreen from "./app/onboarding";
import GoalSetupScreen from "./app/goal-setup";
import HomeScreen from "./app/home";
import LockedScreen from "./app/locked";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// ── Locking logic ─────────────────────────────────────────────────────────────

function computeShouldLock(
  goalConfig: GoalConfig | null,
  dailyProgress: { date: string; count: number },
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

  // Daily goal already met → don't lock
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayDone = dailyProgress.date === todayDate ? dailyProgress.count : 0;
  return todayDone < goalConfig.lessonTarget;
}

function LockCheck() {
  const { flow, setFlow, goalConfig, dailyProgress } = useAppStore();
  const courses = useQuery(api.courses.listWithProgress);

  // Stable ref so the AppState handler always sees the latest values
  const ref = useRef({ flow, setFlow, goalConfig, dailyProgress, courses });
  useEffect(() => {
    ref.current = { flow, setFlow, goalConfig, dailyProgress, courses };
  });

  const check = useCallback(() => {
    const { flow, setFlow, goalConfig, dailyProgress, courses } = ref.current;
    if (flow !== 'home' && flow !== 'locked') return;
    if (courses === undefined) return; // still loading
    const shouldLock = computeShouldLock(goalConfig, dailyProgress, courses);
    setFlow(shouldLock ? 'locked' : 'home');
    // Sync native Screen Time shields with lock state
    if (shouldLock) blockApps().catch(() => {});
    else unblockApps().catch(() => {});
  }, []);

  // Lock when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  // Initial check once courses have loaded from Convex
  useEffect(() => {
    if (courses !== undefined) check();
  }, [courses]);

  // Auto-unlock when a lesson is completed and goal is now met
  useEffect(() => {
    if (flow === 'locked') check();
  }, [dailyProgress.count, dailyProgress.date]);

  return null;
}

function RevenueCatSync() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      Purchases.logIn(user._id).catch(() => {});
    } else if (!isAuthenticated) {
      Purchases.logOut().catch(() => {});
    }
  }, [isAuthenticated, user?._id]);

  return null;
}

SplashScreen.preventAutoHideAsync();

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
if (REVENUECAT_IOS_KEY) {
  Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
}

export default function App() {
  const { flow, setFlow } = useAppStore();

  const [fontsLoaded] = useFonts({
    "Inter-Regular":   Inter_400Regular,
    "Inter-Medium":    Inter_500Medium,
    "Inter-SemiBold":  Inter_600SemiBold,
    "Inter-Bold":      Inter_700Bold,
    "Inter-ExtraBold": Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      if (flow === "loading") setFlow("onboarding");
    }
  }, [fontsLoaded]);

  // Enable screen recording protection once the user is in the app
  useEffect(() => {
    if (flow === "home" || flow === "locked") {
      ScreenBlocking.enableScreenBlocking().catch(() => {});
    }
  }, [flow]);

  if (!fontsLoaded) return <AppSplashScreen />;

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <RevenueCatSync />
      <LockCheck />
      <SafeAreaProvider>
        {flow === "onboarding" && (
          <OnboardingScreen onComplete={() => setFlow("goalsetup")} />
        )}
        {flow === "goalsetup" && (
          <GoalSetupScreen onComplete={() => setFlow("home")} />
        )}
        {flow === "home" && <HomeScreen />}
        {flow === "locked" && <LockedScreen />}
      </SafeAreaProvider>
      <Toast />
    </ConvexAuthProvider>
  );
}
