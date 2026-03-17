/**
 * useBackendConnectivity — S3-M8: Backend connectivity indicator
 *
 * Periodically pings /api/health and updates the connectivity store.
 * Uses faster polling when disconnected, slower when healthy.
 *
 * Mount once at app layout level (_layout.tsx).
 */
import { useEffect, useRef } from 'react';
import { setBackendConnected } from '@/lib/connectivityStore';

const NORMAL_INTERVAL_MS = 30_000;    // Check every 30s when healthy
const UNHEALTHY_INTERVAL_MS = 5_000;  // Check every 5s when unhealthy
const TIMEOUT_MS = 5_000;             // Health check timeout

export function useBackendConnectivity(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const checkHealth = async () => {
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
    };
  }, []);
}
