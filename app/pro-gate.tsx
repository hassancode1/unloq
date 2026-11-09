// Hard paywall gate. Without Pro (trial ended, or never started) the app shows
// the paywall instead of Home. Nothing is ever deleted — subscribing, restoring
// or signing in brings everything straight back.
import React, { type ReactNode } from 'react';
import { Platform } from 'react-native';
import Paywall from '../components/paywall/Paywall';
import { useEntitlement } from '../hooks/useEntitlement';
import { DEV_FORCE_PRO, HARD_PAYWALL } from '../lib/features';
import AppSplashScreen from './splash';

// No RevenueCat on this platform/build → nothing to buy, so don't gate.
const RC_CONFIGURED = Platform.OS === 'ios' && !!process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

export default function ProGate({ children }: { children: ReactNode }) {
  const { isPremium, loading } = useEntitlement();
  if (!HARD_PAYWALL || DEV_FORCE_PRO || !RC_CONFIGURED) return <>{children}</>;
  if (loading) return <AppSplashScreen />;
  // The paywall itself; once they subscribe, the entitlement listener flips
  // isPremium and Home appears.
  if (!isPremium) return <Paywall />;
  return <>{children}</>;
}

