/**
 * Generic data hook for Front Desk Hub sections.
 *
 * Mirrors the pattern in hooks/useFrontdeskCalls.ts:
 *   - Manual polling via setTimeout (not setInterval) for visibility-aware backoff
 *   - Exponential backoff on errors, capped at pollIntervalMs * 4
 *   - Auth errors block further fetches until session token changes
 *
 * Mock mode:
 *   When the URL search param `?mock=1` is present (read via expo-router's
 *   useLocalSearchParams), the fetcher is skipped entirely and opts.mock is
 *   returned immediately. This lets any workspace be demoed without a live
 *   backend, toggled at the URL level — no env var required.
 *
 *   Why URL param over env var: env vars are baked at build time and require a
 *   restart; `?mock=1` is flippable per-tab in the browser, which matches the
 *   iterative UI-first workflow of the Front Desk Hub.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';

export interface UseFrontDeskSectionResult<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface UseFrontDeskSectionOptions<T> {
  /** Static mock fixtures returned when ?mock=1 is in the URL. */
  mock?: T[];
  /** Polling interval in ms. Clamped to [15_000, 120_000]. Default: 30_000. */
  pollIntervalMs?: number;
}

const MIN_POLL_MS = 15_000;
const MAX_POLL_MS = 120_000;
const DEFAULT_POLL_MS = 30_000;

/**
 * Generic data hook for a Front Desk section.
 *
 * @param fetcher Async function that returns T[]. Called on mount and on each
 *   poll tick. Should throw on error (message is surfaced in `error`).
 * @param opts Optional mock fixtures and polling interval.
 *
 * @example
 *   const { data, loading, error, refresh } = useFrontDeskSection(
 *     () => fetchVoicemails(authFetch, officeId),
 *     { mock: MOCK_VOICEMAILS, pollIntervalMs: 60_000 }
 *   );
 */
export function useFrontDeskSection<T>(
  fetcher: () => Promise<T[]>,
  opts: UseFrontDeskSectionOptions<T> = {},
): UseFrontDeskSectionResult<T> {
  const params = useLocalSearchParams<{ mock?: string }>();
  const isMockMode = params.mock === '1';

  const pollMs = Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, opts.pollIntervalMs ?? DEFAULT_POLL_MS));

  // Pass I P0 #6: when mock mode is active, initialize data/loading synchronously
  // so the LoadingSkeleton doesn't flash for one paint cycle before the effect
  // settles. Without this, every workspace flickers a skeleton on mount even
  // though the fixture is available immediately.
  const [data, setData] = useState<T[] | null>(isMockMode ? (opts.mock ?? []) : null);
  const [loading, setLoading] = useState<boolean>(!isMockMode);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextDelayRef = useRef<number>(pollMs);
  const mountedRef = useRef<boolean>(true);

  // Mock mode: keep state in sync if opts.mock changes after mount.
  useEffect(() => {
    if (!isMockMode) return;
    setData(opts.mock ?? []);
    setError(null);
    setLoading(false);
  }, [isMockMode, opts.mock]);

  const fetchData = useCallback(async () => {
    if (isMockMode) return;

    try {
      const result = await fetcher();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
      nextDelayRef.current = pollMs;
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      // Exponential backoff: double the delay on each error, cap at MAX_POLL_MS.
      nextDelayRef.current = Math.min(nextDelayRef.current * 2, MAX_POLL_MS);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher, isMockMode, pollMs]);

  useEffect(() => {
    if (isMockMode) return;

    mountedRef.current = true;

    const schedule = (delay: number) => {
      if (!mountedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        // Skip poll when tab is hidden — saves bandwidth, mirrors useFrontdeskCalls.ts pattern.
        if (typeof document !== 'undefined' && document.hidden) {
          schedule(Math.min(nextDelayRef.current * 2, MAX_POLL_MS));
          return;
        }
        await fetchData();
        schedule(nextDelayRef.current);
      }, delay);
    };

    setLoading(true);
    fetchData().finally(() => {
      schedule(nextDelayRef.current);
    });

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchData, isMockMode]);

  const refresh = useCallback(() => {
    if (isMockMode) return;
    nextDelayRef.current = pollMs;
    setLoading(true);
    fetchData();
  }, [fetchData, isMockMode, pollMs]);

  return { data, loading, error, refresh };
}
