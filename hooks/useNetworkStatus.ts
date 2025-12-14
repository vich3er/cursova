import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const previousOnlineState = useRef<boolean | null>(null);

  useEffect(() => {
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setIsInitialized(true);

      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      previousOnlineState.current = isOnline;

    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);

      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      if (previousOnlineState.current !== isOnline) {
        previousOnlineState.current = isOnline;
      }

      if (!isInitialized) {
        setIsInitialized(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const isOffline = isInitialized && (isConnected === false || isInternetReachable === false);

  return {
    isConnected,
    isInternetReachable,
    isOffline,
    isInitialized,
  };
}
