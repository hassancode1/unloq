import { useState, useEffect } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { useAppStore } from '@/store/useAppStore';
import { DEV_FORCE_PRO } from '@/lib/features';

function checkPremium(info: CustomerInfo): boolean {
  return (
    !!info.entitlements.active['premium'] ||
    info.activeSubscriptions.length > 0
  );
}

export function useEntitlement() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const revenueCatReady = useAppStore((s) => s.revenueCatReady);

  // Never keep the app waiting on RevenueCat: after 5s, stop "loading" and go
  // with what we know (not Pro → the paywall, which retries on its own).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!revenueCatReady) return; // wait until the user is logged into RevenueCat

    Purchases.getCustomerInfo()
      .then((info) => setIsPremium(checkPremium(info)))
      .catch(() => setIsPremium(false))
      .finally(() => setLoading(false));

    const handler = (info: CustomerInfo) => setIsPremium(checkPremium(info));
    Purchases.addCustomerInfoUpdateListener(handler);

    return () => { Purchases.removeCustomerInfoUpdateListener(handler); };
  }, [revenueCatReady]);

  // Dev testing switch (lib/features.ts): every Pro check passes — explaining,
  // creating paths, the gate. Never true in release builds.
  if (DEV_FORCE_PRO) return { isPremium: true, loading: false };
  return { isPremium, loading };
}
