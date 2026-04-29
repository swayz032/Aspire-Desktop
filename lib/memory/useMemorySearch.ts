/**
 * Memory search hook — placeholder until the backend `/v1/office-memory/search-memory`
 * endpoint is wired into the app. Returns `MOCK_MEMORIES_9` filtered by the
 * current query for fast iteration on the page UX.
 *
 * Pass 5 backend already ships the API; Pass 6 ships the UI; the wire-in to
 * real fetch happens in a follow-up after auth context is plumbed.
 */

import { useMemo } from 'react';
import type { MemoryFilters, MemorySummary, MemoryViewMode } from '@/components/office-memory/types';
import { MOCK_MEMORIES_9 } from '@/components/office-memory/fixtures';

export interface UseMemorySearchResult {
  items: MemorySummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: Error | null;
}

export function useMemorySearch(filters: MemoryFilters): UseMemorySearchResult {
  const items = useMemo(() => {
    let result = [...MOCK_MEMORIES_9];

    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.entity?.name.toLowerCase().includes(q),
      );
    }

    if (filters.type) {
      result = result.filter((m) => m.type === filters.type);
    }

    if (filters.entityId) {
      result = result.filter((m) => m.entity?.id === filters.entityId);
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((m) => filters.tags!.some((t) => m.tags.includes(t)));
    }

    if (filters.sort === 'oldest') {
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return result;
  }, [filters]);

  return {
    items,
    total: items.length,
    page: filters.page ?? 1,
    pageSize: 9,
    loading: false,
    error: null,
  };
}

export type { MemoryFilters, MemorySummary, MemoryViewMode };
