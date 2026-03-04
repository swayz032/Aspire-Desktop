import { useState, useEffect, useCallback, useRef } from 'react';
import type { CallSession } from '@/types/frontdesk';
import { useSupabase } from '@/providers';

interface UseFrontdeskCallsOptions {
  pollInterval?: number;
  limit?: number;
}

/**
 * Hook to fetch call sessions from enterprise call_sessions table.
 * Replaces useRealtimeCalls (which polled provider_call_log).
 */
export function useFrontdeskCalls(options: UseFrontdeskCallsOptions = {}) {
  const { pollInterval = 10000, limit = 50 } = options;
  const { session } = useSupabase();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextDelayRef = useRef(pollInterval);

  const fetchCalls = useCallback(async () => {
    try {
      const token = session?.access_token;
      if (!token) {
        throw new Error('AUTH_REQUIRED');
      }

      const res = await fetch(`/api/frontdesk/calls?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCalls(data.calls || []);
      setError(null);
      nextDelayRef.current = pollInterval;
    } catch (e: any) {
      setError(e.message);
      const message = String(e?.message || '');
      const isAuth = /AUTH_REQUIRED|HTTP 401|HTTP 403/i.test(message);
      if (isAuth) {
        nextDelayRef.current = 60000;
      } else {
        // Back off aggressively on transient server/network failures.
        nextDelayRef.current = Math.min(Math.max(pollInterval * 2, nextDelayRef.current * 2), 60000);
      }
    } finally {
      setLoading(false);
    }
  }, [limit, pollInterval, session?.access_token]);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        await fetchCalls();
        schedule(nextDelayRef.current);
      }, delay);
    };

    fetchCalls().finally(() => {
      schedule(nextDelayRef.current);
    });

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchCalls]);

  const refresh = useCallback(() => {
    setLoading(true);
    nextDelayRef.current = pollInterval;
    fetchCalls();
  }, [fetchCalls, pollInterval]);

  return { calls, loading, error, refresh };
}
