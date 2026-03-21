/**
 * useBackendConnectivity — S3-M8: Backend + device connectivity indicator
 *
 * Two-level detection:
 * 1. Device online: navigator.onLine (web) / expo-network (native)
 * 2. Backend connected: /api/health ping with timeout
 *
 * Skips health poll when device is offline (saves requests).
 * Uses faster polling when disconnected, slower when healthy.
 *
 * Mount once at app layout level (_layout.tsx).
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { setBackendConnected, setDeviceOnline, getDeviceOnline } from '@/lib/connectivityStore';

const NORMAL_INTERVAL_MS = 30_000;    // Check every 30s when healthy
const UNHEALTHY_INTERVAL_MS = 5_000;  // Check every 5s when unhealthy
const TIMEOUT_MS = 5_000;             // Health check timeout

export function useBackendConnectivity(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // --- Device-level network detection ---
    function handleOnline() {
      if (mountedRef.current) {
        setDeviceOnline(true);
        // Re-check backend immediately when coming back online
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(checkHealth, 500);
      }
    }

    function handleOffline() {
      if (mountedRef.current) {
        setDeviceOnline(false);
        setBackendConnected(false); // Backend unreachable when device is offline
      }
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Initialize from browser state
      setDeviceOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    } else {
      // Native: use expo-network for initial state
      // Dynamic import to avoid bundling on web
      import('expo-network').then(({ getNetworkStateAsync }) => {
        if (!mountedRef.current) return;
        getNetworkStateAsync().then(state => {
          if (mountedRef.current) {
            setDeviceOnline(state.isConnected ?? true);
          }
        }).catch(() => {
          // Assume online if we can't check
          if (mountedRef.current) setDeviceOnline(true);
        });
      }).catch(() => {});
    }

    // --- Backend health check ---
    const checkHealth = async () => {
      // Skip health poll when device is offline
      if (!getDeviceOnline()) {
        setBackendConnected(false);
        scheduleNext(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const resp = await fetch('/api/health', {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (mountedRef.current) {
          const connected = resp.ok;
          setBackendConnected(connected);
          scheduleNext(connected);
        }
      } catch {
        if (mountedRef.current) {
          setBackendConnected(false);
          scheduleNext(false);
        }
      }
    };

    const scheduleNext = (wasConnected: boolean) => {
      if (!mountedRef.current) return;
      const interval = wasConnected ? NORMAL_INTERVAL_MS : UNHEALTHY_INTERVAL_MS;
      timerRef.current = setTimeout(checkHealth, interval);
    };

    // Initial check after short delay (don't block startup)
    timerRef.current = setTimeout(checkHealth, 2_000);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);
}
