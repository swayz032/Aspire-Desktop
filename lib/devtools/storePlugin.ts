/**
 * Store Inspector Dev Tools Plugin — Real-time state inspection for Zustand/custom stores.
 *
 * Shows in React Native DevTools (press shift+m in terminal).
 * Exposes: connectivity store, authority queue store, immersion store state.
 *
 * Only active in __DEV__ mode — zero overhead in production.
 */
import { useEffect, useRef } from 'react';
import { getBackendConnected, getDeviceOnline } from '@/lib/connectivityStore';
import { getAuthorityItems } from '@/lib/authorityQueueStore';

let useDevToolsPluginClient: any = null;
try {
  if (__DEV__) {
    useDevToolsPluginClient = require('expo/devtools').useDevToolsPluginClient;
  }
} catch {
  // Not available
}

/** Hook to register Store Inspector dev tools plugin. Mount in _layout.tsx under __DEV__. */
export function useStoreDevTools() {
  if (!__DEV__ || !useDevToolsPluginClient) return;

  try {
    const client = useDevToolsPluginClient('aspire-stores');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      if (!client) return;

      // Send store snapshots every 2s
      intervalRef.current = setInterval(() => {
        try {
          const authorityItems = getAuthorityItems();
          client.sendMessage('store-snapshot', {
            timestamp: Date.now(),
            connectivity: {
              deviceOnline: getDeviceOnline(),
              backendConnected: getBackendConnected(),
            },
            authorityQueue: {
              count: authorityItems.length,
              pending: authorityItems.filter(i => i.status === 'pending' || i.status === 'live').length,
              items: authorityItems.slice(0, 10).map(i => ({
                id: i.id,
                title: i.title,
                status: i.status,
                riskTier: i.riskTier,
              })),
            },
          });
        } catch {
          // Store or plugin not ready
        }
      }, 2000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [client]);
  } catch {
    // Dev tools not available
  }
}
