import { useState, useEffect, useCallback, useRef } from 'react';
import type { CallSession } from '@/types/frontdesk';

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
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch(`/api/frontdesk/calls?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCalls(data.calls || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchCalls();
    intervalRef.current = setInterval(fetchCalls, pollInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchCalls, pollInterval]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchCalls();
  }, [fetchCalls]);

  return { calls, loading, error, refresh };
}
