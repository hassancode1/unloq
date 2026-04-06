import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
import { useEffect } from "react";
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
import { useAppStore } from "./store/useAppStore";
import AppSplashScreen from "./app/splash";
import OnboardingScreen from "./app/onboarding";
import GoalSetupScreen from "./app/goal-setup";
import HomeScreen from "./app/home";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

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

  if (!fontsLoaded) return <AppSplashScreen />;

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <RevenueCatSync />
      <SafeAreaProvider>
        {flow === "onboarding" && (
          <OnboardingScreen onComplete={() => setFlow("goalsetup")} />
        )}
        {flow === "goalsetup" && (
          <GoalSetupScreen onComplete={() => setFlow("home")} />
        )}
        {flow === "home" && <HomeScreen />}
      </SafeAreaProvider>
      <Toast />
    </ConvexAuthProvider>
  );
}
