import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppStore } from "./store/useAppStore";
import OnboardingScreen from "./app/onboarding";
import GoalSetupScreen from "./app/goal-setup";
import HomeScreen from "./app/home";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { flow, setFlow } = useAppStore();

  const [fontsLoaded] = useFonts({
    "Nunito-Regular": Nunito_400Regular,
    "Nunito-SemiBold": Nunito_600SemiBold,
    "Nunito-Bold": Nunito_700Bold,
    "Nunito-ExtraBold": Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Only show onboarding on first-ever launch; persisted flow is reused after that
      if (flow === 'loading') setFlow('onboarding');
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {flow === "onboarding" && (
        <OnboardingScreen onComplete={() => setFlow("goalsetup")} />
      )}
      {flow === "goalsetup" && (
        <GoalSetupScreen onComplete={() => setFlow("home")} />
      )}
      {flow === "home" && <HomeScreen />}
    </SafeAreaProvider>
  );
}
