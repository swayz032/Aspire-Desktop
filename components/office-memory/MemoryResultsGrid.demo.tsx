/**
 * MemoryResultsGrid demo — dev-only smoke test for the grid + pagination.
 *
 * Wired to MOCK_MEMORIES_9 fixture so all 9 memory types and badge colors
 * render. Adjustable controls let you flip between loading / empty / populated
 * states, and grid / list view modes, without touching the page route.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Colors } from '@/constants/tokens';
import { MemoryResultsGrid } from './MemoryResultsGrid';
import { MOCK_MEMORIES_9 } from './fixtures';
import { MEMORY_PAGE_SIZE, type MemoryViewMode } from './types';

type Mode = 'populated' | 'loading' | 'empty' | 'paged';

const MODES: { value: Mode; label: string }[] = [
  { value: 'populated', label: '9 cards' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'paged', label: '125 (paged)' },
];

// Build a 125-item dataset by cloning fixtures with unique ids/dates.
const PAGED_DATASET = Array.from({ length: 125 }, (_, i) => {
  const base = MOCK_MEMORIES_9[i % MOCK_MEMORIES_9.length];
  return {
    ...base,
    id: `${base.id}_p${i}`,
    title: `${base.title} — #${i + 1}`,
    date: new Date(Date.now() - i * 86_400_000).toISOString(),
  };
});

export function MemoryResultsGridDemo() {
  const [mode, setMode] = useState<Mode>('populated');
  const [viewMode, setViewMode] = useState<MemoryViewMode>('grid');
  const [page, setPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const dataset =
    mode === 'paged' ? PAGED_DATASET : mode === 'empty' ? [] : MOCK_MEMORIES_9;
  const total = dataset.length;
  const start = (page - 1) * MEMORY_PAGE_SIZE;
  const sliced = dataset.slice(start, start + MEMORY_PAGE_SIZE);
  const overlaid = sliced.map((m) =>
    bookmarks.has(m.id) === !!m.bookmarked
      ? m
      : { ...m, bookmarked: bookmarks.has(m.id) },
  );

  const onBookmark = (id: string) => {
    setBookmarks((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.controlsRow}>
        <Text style={styles.label}>State:</Text>
        {MODES.map((m) => (
          <Pressable
            key={m.value}
            onPress={() => {
              setMode(m.value);
              setPage(1);
            }}
            style={[styles.btn, mode === m.value && styles.btnActive]}
          >
            <Text style={[styles.btnText, mode === m.value && styles.btnTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
        <View style={styles.divider} />
        <Text style={styles.label}>View:</Text>
        {(['grid', 'list'] as MemoryViewMode[]).map((v) => (
          <Pressable
            key={v}
            onPress={() => setViewMode(v)}
            style={[styles.btn, viewMode === v && styles.btnActive]}
          >
            <Text style={[styles.btnText, viewMode === v && styles.btnTextActive]}>
              {v}
            </Text>
          </Pressable>
        ))}
      </View>

      <MemoryResultsGrid
        items={overlaid}
        loading={mode === 'loading'}
        page={page}
        pageSize={MEMORY_PAGE_SIZE}
        total={total}
        viewMode={viewMode}
        onPageChange={setPage}
        onCardPress={(id) => console.log('card pressed', id)}
        onBookmarkToggle={onBookmark}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
  },
  content: {
    padding: 24,
    gap: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.tertiary as string,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginRight: 4,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border.default as string,
    marginHorizontal: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
  },
  btnActive: {
    borderColor: Colors.accent.cyan as string,
    backgroundColor: Colors.accent.cyanLight as string,
  },
  btnText: {
    fontSize: 12,
    color: Colors.text.tertiary as string,
    fontWeight: '500' as const,
  },
  btnTextActive: {
    color: Colors.accent.cyan as string,
    fontWeight: '600' as const,
  },
});
