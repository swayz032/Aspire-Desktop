/**
 * useContactSearch — Lane E6 (plan §3.9.9).
 *
 * Hits `GET /api/messages/contacts/search?q=...&limit=...` with a 200ms
 * internal debounce. Empty query returns the unranked default set; this is
 * intentional — `ContactsSidePanel` drives all 3 sections from the same
 * endpoint by passing `query=''`.
 *
 * Capability scope `telephony:sms_read` (server-minted).
 *
 * Pattern: matches the rest of `lib/messages/*` — module-level cache +
 * listener fan-out + AbortController per fetch. No React Query dep.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { searchContacts } from '@/lib/api/messages';
import type { ContactSearchResult } from '@/components/messages/ContactAutocomplete';

const DEBOUNCE_MS = 200;
const STALE_MS = 30_000;

interface CacheEntry {
  results: ContactSearchResult[];
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(officeId: string, q: string, limit: number): string {
  return `${officeId || '_'}:${q.trim().toLowerCase()}:${limit}`;
}

export interface UseContactSearchResult {
  results: ContactSearchResult[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useContactSearch(
  query: string,
  limit: number = 20,
): UseContactSearchResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';

  // Internal debounce
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const k = cacheKey(officeId, debounced, limit);

  // Hydrate from cache
  const cached = cache.get(k);
  const [results, setResults] = useState<ContactSearchResult[]>(
    () => cached?.results ?? [],
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

  // While debouncing (query !== debounced) keep loading=true so the dropdown
  // shimmer doesn't blink off-on between keystrokes.
  const isDebouncing = useMemo(() => query !== debounced, [query, debounced]);

  const doFetch = useCallback(async () => {
    if (!officeId) return;
    const existing = cache.get(k);
    const fresh = existing && Date.now() - existing.fetchedAt < STALE_MS;
    if (fresh) {
      if (mountedRef.current) {
        setResults(existing!.results);
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
      const result = await searchContacts({
        authenticatedFetch,
        officeId,
        query: debounced,
        limit,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      cache.set(k, { results: result, fetchedAt: Date.now() });
      if (mountedRef.current) {
        setResults(result);
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
  }, [authenticatedFetch, debounced, k, limit, officeId]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return {
    results,
    isLoading: isLoading || isDebouncing,
    isError: !!error,
    error,
  };
}
