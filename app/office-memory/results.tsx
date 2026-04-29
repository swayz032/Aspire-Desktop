/**
 * Office Memory — Results page.
 *
 * URL state model (per plan §13 Lane D): every filter is read from
 * `useLocalSearchParams()` and written back via `router.setParams()` so the
 * URL is shareable.
 *
 * Header row: "Memory Results" title + dynamic subtitle ("Showing 1–9 of 125
 * memories"). Below: filter chip row + grid/list toggle + Export. Then the
 * 3×3 results grid, then pagination footer (rendered by the grid component).
 *
 * V1 scope: bookmark toggling is local state, Export is a stub. Backend wire-in
 * happens in a follow-up after auth context lands (see useMemorySearch.ts).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useMemorySearch } from '@/lib/memory/useMemorySearch';
import { MemoryFilterBar } from '@/components/office-memory/MemoryFilterBar';
import { MemoryGridListToggle } from '@/components/office-memory/MemoryGridListToggle';
import { MemoryResultsGrid } from '@/components/office-memory/MemoryResultsGrid';
import {
  MEMORY_PAGE_SIZE,
  MEMORY_TYPE_COLORS,
  type MemoryFilters,
  type MemorySortKey,
  type MemoryType,
  type MemoryViewMode,
} from '@/components/office-memory/types';
import { devLog } from '@/lib/devLog';

// ---------------------------------------------------------------------------
// Param parsing helpers
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set(Object.keys(MEMORY_TYPE_COLORS));
const VALID_DATE_RANGES = new Set(['last_7d', 'last_30d', 'last_90d', 'custom']);
const VALID_SORTS = new Set<MemorySortKey>(['recent', 'oldest', 'relevance']);

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

/**
 * Parse a URL params bag into a strongly-typed MemoryFilters. Unknown values
 * are silently dropped (not stored as undefined garbage) so the URL can be
 * round-tripped without leakage.
 */
function paramsToFilters(raw: Record<string, string | string[]>): MemoryFilters {
  const q = asString(raw.q);
  const typeRaw = asString(raw.type);
  const dateRangeRaw = asString(raw.dateRange);
  const entityId = asString(raw.entityId);
  const tagsRaw = asString(raw.tags);
  const sortRaw = asString(raw.sort);
  const pageRaw = asString(raw.page);

  const type =
    typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as MemoryType) : undefined;
  const dateRange =
    dateRangeRaw && VALID_DATE_RANGES.has(dateRangeRaw)
      ? (dateRangeRaw as MemoryFilters['dateRange'])
      : undefined;
  const sort =
    sortRaw && VALID_SORTS.has(sortRaw as MemorySortKey)
      ? (sortRaw as MemorySortKey)
      : undefined;
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : undefined;
  const pageNum = pageRaw ? Number(pageRaw) : NaN;
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 1;

  return {
    q: q && q.length > 0 ? q : undefined,
    type,
    dateRange,
    entityId: entityId && entityId.length > 0 ? entityId : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    sort,
    page,
  };
}

/**
 * Convert a filter delta into a setParams-compatible payload. We use empty
 * strings to clear a param (Expo Router `setParams` interprets '' as "remove
 * this key from the URL").
 */
function filtersToParams(f: MemoryFilters): Record<string, string> {
  return {
    q: f.q ?? '',
    type: f.type ?? '',
    dateRange: f.dateRange ?? '',
    entityId: f.entityId ?? '',
    tags: f.tags && f.tags.length > 0 ? f.tags.join(',') : '',
    sort: f.sort ?? '',
    page: f.page && f.page > 1 ? String(f.page) : '',
  };
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function MemoryResultsContent() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    q?: string;
    type?: string;
    dateRange?: string;
    entityId?: string;
    tags?: string;
    sort?: string;
    page?: string;
    view?: string;
  }>();

  const filters = useMemo(
    () => paramsToFilters(rawParams as Record<string, string | string[]>),
    [rawParams],
  );

  // viewMode is also URL-state (?view=grid|list). Default 'grid'.
  const viewMode: MemoryViewMode =
    asString(rawParams.view) === 'list' ? 'list' : 'grid';

  const result = useMemorySearch(filters);

  // Local-only bookmarks for V1 (no persistence).
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const m of result.items) {
      if (m.bookmarked) initial.add(m.id);
    }
    return initial;
  });

  // Apply local bookmark overlay onto fixture data.
  const overlaidItems = useMemo(
    () =>
      result.items.map((m) =>
        bookmarkedIds.has(m.id) === !!m.bookmarked
          ? m
          : { ...m, bookmarked: bookmarkedIds.has(m.id) },
      ),
    [result.items, bookmarkedIds],
  );

  // ---- pagination slicing -----------------------------------------------
  const total = result.total;
  const page = Math.max(1, Math.min(filters.page ?? 1, Math.max(1, Math.ceil(total / MEMORY_PAGE_SIZE))));
  const startIdx = (page - 1) * MEMORY_PAGE_SIZE;
  const pagedItems = overlaidItems.slice(startIdx, startIdx + MEMORY_PAGE_SIZE);
  const startDisplay = total === 0 ? 0 : startIdx + 1;
  const endDisplay = Math.min(startIdx + MEMORY_PAGE_SIZE, total);

  // ---- derived filter helper data ---------------------------------------
  const availableEntities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of result.items) {
      if (m.entity && !seen.has(m.entity.id)) seen.set(m.entity.id, m.entity.name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [result.items]);

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    for (const m of result.items) for (const t of m.tags) seen.add(t);
    return Array.from(seen).sort();
  }, [result.items]);

  // ---- handlers ---------------------------------------------------------
  const handleFiltersChange = useCallback(
    (delta: Partial<MemoryFilters>) => {
      const next: MemoryFilters = { ...filters, ...delta };
      // Reset page to 1 on any non-page change unless caller passed one.
      if (delta.page === undefined && Object.keys(delta).some((k) => k !== 'page')) {
        next.page = 1;
      }
      router.setParams(filtersToParams(next) as any);
    },
    [filters, router],
  );

  const handleViewChange = useCallback(
    (mode: MemoryViewMode) => {
      router.setParams({ view: mode === 'grid' ? '' : 'list' } as any);
    },
    [router],
  );

  const handlePageChange = useCallback(
    (n: number) => {
      router.setParams({ page: n > 1 ? String(n) : '' } as any);
    },
    [router],
  );

  const handleCardPress = useCallback(
    (memoryId: string) => {
      router.push(`/office-memory/${memoryId}` as any);
    },
    [router],
  );

  const handleBookmarkToggle = useCallback((memoryId: string) => {
    setBookmarkedIds((cur) => {
      const next = new Set(cur);
      if (next.has(memoryId)) next.delete(memoryId);
      else next.add(memoryId);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    devLog('[office-memory] export requested', { filters, total });
  }, [filters, total]);

  // ---- subtitle ---------------------------------------------------------
  const subtitle =
    total === 0
      ? 'No memories match the current filters.'
      : `Showing ${startDisplay}–${endDisplay} of ${total} ${total === 1 ? 'memory' : 'memories'}`;

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Memory Results</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.controlsLeft}>
            <MemoryFilterBar
              filters={filters}
              availableEntities={availableEntities}
              availableTags={availableTags}
              onChange={handleFiltersChange}
            />
          </View>
          <View style={styles.controlsRight}>
            <MemoryGridListToggle
              viewMode={viewMode}
              onChange={handleViewChange}
              onExport={handleExport}
            />
          </View>
        </View>

        <View style={styles.gridSection}>
          <MemoryResultsGrid
            items={pagedItems}
            loading={result.loading}
            page={page}
            pageSize={MEMORY_PAGE_SIZE}
            total={total}
            viewMode={viewMode}
            onPageChange={handlePageChange}
            onCardPress={handleCardPress}
            onBookmarkToggle={handleBookmarkToggle}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export — wrapped in DesktopShell + PageErrorBoundary
// ---------------------------------------------------------------------------

export default function OfficeMemoryResultsPage() {
  return (
    <PageErrorBoundary pageName="office-memory-results">
      <DesktopShell fullBleed>
        <MemoryResultsContent />
      </DesktopShell>
    </PageErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
    ...(Platform.OS === 'web' ? ({ height: '100%', minHeight: 0 } as object) : {}),
  } as any,
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 64,
    maxWidth: 1440,
    alignSelf: 'center',
    width: '100%',
  },

  // header
  header: {
    marginBottom: 24,
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text.primary as string,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontWeight: '500' as const,
  },

  // controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
    zIndex: 50,
    ...(Platform.OS === 'web' ? ({ position: 'relative' } as object) : {}),
  } as any,
  controlsLeft: {
    flex: 1,
    minWidth: 280,
  },
  controlsRight: {
    paddingTop: 0,
  },

  // grid section sits above the page content
  gridSection: {
    marginTop: 8,
    zIndex: 1,
  },
});
