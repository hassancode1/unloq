import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [networkLoading, setNetworkLoading] = useState(true);

  const recheck = useCallback(() => {
    NetInfo.fetch().then((s: NetInfoState) => setIsConnected(s.isConnected ?? true));
  }, []);

  useEffect(() => {
    NetInfo.fetch().then((s: NetInfoState) => {
      setIsConnected(s.isConnected ?? true);
      setNetworkLoading(false);
    });
    const unsub = NetInfo.addEventListener((s: NetInfoState) => {
      setIsConnected(s.isConnected ?? true);
    });
    return () => unsub();
  }, []);

  return { isConnected, networkLoading, recheck };
}
