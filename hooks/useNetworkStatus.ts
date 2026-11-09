import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useConvex } from 'convex/react';

/**
 * Offline only when the OS says so AND our backend socket is down too.
 * NetInfo alone gives false "offline" readings (notably on the iOS simulator
 * after the Mac's network changes) while data is still loading fine.
 */
export function useNetworkStatus() {
  const convex = useConvex();
  const [osOnline, setOsOnline] = useState(true);
  const [backendUp, setBackendUp] = useState(true);
  const [networkLoading, setNetworkLoading] = useState(true);

  const read = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

  const recheck = useCallback(() => {
    NetInfo.fetch().then((s) => setOsOnline(read(s)));
  }, []);

  useEffect(() => {
    let mounted = true;
    NetInfo.fetch().then((s) => {
      if (!mounted) return;
      setOsOnline(read(s));
      setNetworkLoading(false);
    });
    const unsub = NetInfo.addEventListener((s) => setOsOnline(read(s)));
    return () => { mounted = false; unsub(); };
  }, []);

  // Only poll the backend while the OS claims we're offline.
  useEffect(() => {
    if (osOnline) { setBackendUp(true); return; }
    const check = () => {
      try { setBackendUp(convex.connectionState().isWebSocketConnected); } catch { setBackendUp(false); }
    };
    check();
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, [osOnline, convex]);

  return { isConnected: osOnline || backendUp, networkLoading, recheck };
}
