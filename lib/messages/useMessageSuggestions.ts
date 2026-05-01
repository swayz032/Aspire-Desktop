/**
 * useMessageSuggestions — Lane E6 (plan §3.9.9).
 *
 * Fetches Ava-recommended SMS follow-ups from the proactive_candidate engine
 * via `GET /api/messages/suggestions?limit=...`.
 *
 * Suggestions are not super volatile — 60s stale window. Capability scope
 * `telephony:sms_read` (server-minted).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchSuggestions } from '@/lib/api/messages';
import type { MessageSuggestion } from '@/components/messages/MessagesSuggestedActions';

const STALE_MS = 60_000;

interface CacheEntry {
  suggestions: MessageSuggestion[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
function key(officeId: string, limit: number): string {
  return `${officeId || '_'}:${limit}`;
}

export interface UseMessageSuggestionsResult {
  suggestions: MessageSuggestion[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMessageSuggestions(
  limit: number = 5,
): UseMessageSuggestionsResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';
  const k = key(officeId, limit);

  const cached = cache.get(k);
  const [suggestions, setSuggestions] = useState<MessageSuggestion[]>(
    () => cached?.suggestions ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const doFetch = useCallback(
    async (force: boolean) => {
      if (!officeId) return;
      const existing = cache.get(k);
      const fresh = existing && Date.now() - existing.fetchedAt < STALE_MS;
      if (!force && fresh) {
        if (mountedRef.current) {
          setSuggestions(existing!.suggestions);
          setIsLoading(false);
          setError(null);
        }
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!existing && mountedRef.current) setIsLoading(true);
      try {
        const result = await fetchSuggestions({
          authenticatedFetch,
          officeId,
          limit,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        cache.set(k, { suggestions: result, fetchedAt: Date.now() });
        if (mountedRef.current) {
          setSuggestions(result);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(e);
          setIsLoading(false);
        }
      }
    },
    [authenticatedFetch, k, limit, officeId],
  );

  useEffect(() => {
    void doFetch(false);
  }, [doFetch]);

  const refetch = useCallback(() => doFetch(true), [doFetch]);

  return {
    suggestions,
    isLoading,
    isError: !!error,
    error,
    refetch,
  };
}
