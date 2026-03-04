import { useState, useEffect, useCallback, useRef } from 'react';
import type { CallSession } from '@/types/frontdesk';
import { useSupabase } from '@/providers';

interface UseFrontdeskCallsOptions {
  pollInterval?: number;
  limit?: number;
}

const MIN_POLL_INTERVAL_MS = 15000;
const MAX_POLL_INTERVAL_MS = 60000;
const SHARED_FETCH_COOLDOWN_MS = 8000;

let sharedInFlight: Promise<CallSession[]> | null = null;
let sharedLastFetchAt = 0;
let sharedCache: CallSession[] = [];

async function fetchSharedFrontdeskCalls(token: string, limit: number): Promise<CallSession[]> {
  const now = Date.now();
  if (sharedInFlight) return sharedInFlight;
  if (sharedCache.length > 0 && now - sharedLastFetchAt < SHARED_FETCH_COOLDOWN_MS) {
    return sharedCache;
  }

  sharedInFlight = (async () => {
    const res = await fetch(`/api/frontdesk/calls?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const calls = (data.calls || []) as CallSession[];
    sharedCache = calls;
    sharedLastFetchAt = Date.now();
    return calls;
  })();

  try {
    return await sharedInFlight;
  } finally {
    sharedInFlight = null;
  }
}

/**
 * Hook to fetch call sessions from enterprise call_sessions table.
 * Replaces useRealtimeCalls (which polled provider_call_log).
 */
export function useFrontdeskCalls(options: UseFrontdeskCallsOptions = {}) {
  const { pollInterval = 10000, limit = 50 } = options;
  const normalizedPollInterval = Math.min(
    MAX_POLL_INTERVAL_MS,
    Math.max(MIN_POLL_INTERVAL_MS, pollInterval),
  );
  const normalizedLimit = Math.max(10, Math.min(100, limit));
  const { session } = useSupabase();
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextDelayRef = useRef(normalizedPollInterval);

  const fetchCalls = useCallback(async () => {
    try {
      const token = session?.access_token;
      if (!token) {
        throw new Error('AUTH_REQUIRED');
      }

      const data = await fetchSharedFrontdeskCalls(token, normalizedLimit);
      setCalls(data || []);
      setError(null);
      nextDelayRef.current = normalizedPollInterval;
    } catch (e: any) {
      setError(e.message);
      const message = String(e?.message || '');
      const isAuth = /AUTH_REQUIRED|HTTP 401|HTTP 403/i.test(message);
      if (isAuth) {
        nextDelayRef.current = MAX_POLL_INTERVAL_MS;
      } else {
        // Back off aggressively on transient server/network failures.
        nextDelayRef.current = Math.min(
          Math.max(normalizedPollInterval * 2, nextDelayRef.current * 2),
          MAX_POLL_INTERVAL_MS,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [normalizedLimit, normalizedPollInterval, session?.access_token]);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        if (typeof document !== 'undefined' && document.hidden) {
          schedule(Math.min(nextDelayRef.current * 2, MAX_POLL_INTERVAL_MS));
          return;
        }
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
    nextDelayRef.current = normalizedPollInterval;
    fetchCalls();
  }, [fetchCalls, normalizedPollInterval]);

  return { calls, loading, error, refresh };
}
