/**
 * Service Memory search hook — Wave 5.1b-7.
 *
 * Mirror of `lib/memory/useMemorySearch.ts` wired to the service-hub
 * backend route `/api/v1/service-memory/search-memory`. The Express proxy
 * mints the capability token + injects Gateway-trusted scope headers
 * (`X-Tenant-Id`, `X-Suite-Id`, `X-Office-Id`) before forwarding to the
 * Python orchestrator (`routes/service_memory.py`).
 *
 * Auth: `useAuthFetch` injects the JWT (`Authorization: Bearer ...`) and
 * suite_id (`X-Suite-Id`). Capability tokens are minted server-side per
 * Law #5; the frontend never holds the signing key.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  API_BASE,
  MemoryApiError,
  mapMemorySummary,
  SERVICE_MEMORY_SEARCH_PATH,
  type BackendSearchResponse,
} from '@/lib/api/serviceMemory';
import type {
  MemoryFilters,
  MemorySummary,
  MemoryViewMode,
} from '@/components/office-memory/types';
import { MEMORY_PAGE_SIZE } from '@/components/office-memory/types';

export interface UseServiceMemorySearchResult {
  items: MemorySummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: Error | null;
  /** Manually re-run the search (e.g. retry button on the grid). */
  refetch: () => void;
}

interface SearchBody {
  q: string;
  memory_type?: string[];
  entity_id?: string;
  thread_id?: string;
  limit: number;
}

function buildBody(filters: MemoryFilters): SearchBody {
  const body: SearchBody = {
    q: filters.q && filters.q.trim().length > 0 ? filters.q.trim() : ' ',
    limit: MEMORY_PAGE_SIZE,
  };
  if (filters.type) body.memory_type = [filters.type];
  if (filters.entityId) body.entity_id = filters.entityId;
  return body;
}

export function useServiceMemorySearch(
  filters: MemoryFilters,
): UseServiceMemorySearchResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId;

  const [items, setItems] = useState<MemorySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const filtersKey = useMemo(
    () =>
      JSON.stringify([
        filters.q,
        filters.type,
        filters.entityId,
        filters.tags,
        filters.sort,
        filters.page,
      ]),
    [filters.q, filters.type, filters.entityId, filters.tags, filters.sort, filters.page],
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!officeId) {
      setLoading(true);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `${API_BASE}${SERVICE_MEMORY_SEARCH_PATH}`;
    const body = buildBody(filters);

    (async () => {
      try {
        const resp = await authenticatedFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Office-Id': officeId,
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!resp.ok) {
          let detailCode = 'SERVICE_MEMORY_SEARCH_FAILED';
          try {
            const errBody = await resp.json();
            detailCode = errBody?.detail?.code ?? errBody?.error ?? detailCode;
          } catch {
            // ignore JSON parse errors on error responses
          }
          throw new MemoryApiError(
            resp.status,
            detailCode,
            `Service memory search failed (${resp.status})`,
          );
        }

        const json = (await resp.json()) as BackendSearchResponse;
        if (cancelled) return;

        const mapped = (json.results ?? []).map(mapMemorySummary);
        setItems(mapped);
        setTotal(json.total ?? mapped.length);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setItems([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [authenticatedFetch, officeId, filtersKey, refetchTick, filters]);

  const refetch = useCallback(() => {
    setRefetchTick((t) => t + 1);
  }, []);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    if (filters.sort === 'oldest') {
      copy.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (filters.sort === 'recent' || !filters.sort) {
      copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return copy;
  }, [items, filters.sort]);

  return {
    items: sortedItems,
    total,
    page: filters.page ?? 1,
    pageSize: MEMORY_PAGE_SIZE,
    loading,
    error,
    refetch,
  };
}

export type { MemoryFilters, MemorySummary, MemoryViewMode };
