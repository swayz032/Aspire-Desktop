/**
 * Supabase Dev Tools Plugin — Custom debugging panel for Supabase state.
 *
 * Shows in React Native DevTools (press shift+m in terminal to see dev tools plugins).
 * Exposes: auth state, realtime channel status, RLS context, recent queries.
 *
 * Only active in __DEV__ mode — zero overhead in production.
 */
import { useEffect, useRef } from 'react';

// expo/devtools is only available in dev builds
let useDevToolsPluginClient: any = null;
try {
  if (__DEV__) {
    // Dynamic require to avoid bundling in production
    useDevToolsPluginClient = require('expo/devtools').useDevToolsPluginClient;
  }
} catch {
  // Not available — no-op
}

interface SupabaseDebugState {
  authUserId: string | null;
  suiteId: string | null;
  realtimeChannels: string[];
  realtimeStatus: Record<string, string>;
  lastQueryMs: number | null;
}

const debugState: SupabaseDebugState = {
  authUserId: null,
  suiteId: null,
  realtimeChannels: [],
  realtimeStatus: {},
  lastQueryMs: null,
};

/** Update debug state (called from Supabase provider). */
export function updateSupabaseDebugState(partial: Partial<SupabaseDebugState>) {
  Object.assign(debugState, partial);
}

/** Hook to register Supabase dev tools plugin. Mount in _layout.tsx under __DEV__. */
export function useSupabaseDevTools() {
  if (!__DEV__ || !useDevToolsPluginClient) return;

  try {
    const client = useDevToolsPluginClient('aspire-supabase');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      if (!client) return;

      // Send state updates every 2s
      intervalRef.current = setInterval(() => {
        try {
          client.sendMessage('supabase-state', debugState);
        } catch {
          // Plugin not connected — safe to ignore
        }
      }, 2000);

      // Listen for inspection requests from DevTools panel
      const subscription = client.addMessageListener('inspect-rls', () => {
        client.sendMessage('rls-context', {
          suiteId: debugState.suiteId,
          userId: debugState.authUserId,
          message: 'RLS context — all queries scoped to this tenant',
        });
      });

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        subscription?.remove?.();
      };
    }, [client]);
  } catch {
    // Dev tools not available in this build
  }
}
