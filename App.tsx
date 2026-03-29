import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexReactClient } from "convex/react";
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

SplashScreen.preventAutoHideAsync();

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
