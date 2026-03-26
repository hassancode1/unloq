import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { useAppStore } from "./store/useAppStore";
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

  if (!fontsLoaded) return null;

  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        {flow === "onboarding" && (
          <OnboardingScreen onComplete={() => setFlow("goalsetup")} />
        )}
        {flow === "goalsetup" && (
          <GoalSetupScreen onComplete={() => setFlow("home")} />
        )}
        {flow === "home" && <HomeScreen />}
      </SafeAreaProvider>
    </ConvexProvider>
  );
}
