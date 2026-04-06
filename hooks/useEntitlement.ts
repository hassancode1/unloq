import { useState, useEffect } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

function checkPremium(info: CustomerInfo): boolean {
  return (
    !!info.entitlements.active['premium'] ||
    info.activeSubscriptions.length > 0
  );
}

export function useEntitlement() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Purchases.getCustomerInfo()
      .then((info) => {
        setIsPremium(checkPremium(info));
      })
      .catch(() => {
        setIsPremium(false);
      })
      .finally(() => setLoading(false));

    const handler = (info: CustomerInfo) => {
      setIsPremium(checkPremium(info));
    };
    Purchases.addCustomerInfoUpdateListener(handler);

    return () => { Purchases.removeCustomerInfoUpdateListener(handler); };
  }, []);

  return { isPremium, loading };
}
