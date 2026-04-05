import { useState, useEffect } from 'react';
import Purchases from 'react-native-purchases';

export function useEntitlement() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Purchases.getCustomerInfo()
      .then((info) => {
        setIsPremium(!!info.entitlements.active['premium']);
      })
      .catch(() => {
        setIsPremium(false);
      })
      .finally(() => setLoading(false));

    Purchases.addCustomerInfoUpdateListener((info) => {
      setIsPremium(!!info.entitlements.active['premium']);
    });
  }, []);

  return { isPremium, loading };
}
