/**
 * MemoryFilterBar demo — exercises every chip + the search-clear chip.
 *
 * Renders the bar, prints the current filters JSON below, and seeds the
 * available entities + tags from the fixtures.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import { MemoryFilterBar } from './MemoryFilterBar';
import { MOCK_MEMORIES_9 } from './fixtures';
import type { MemoryFilters } from './types';

export function MemoryFilterBarDemo() {
  const [filters, setFilters] = useState<MemoryFilters>({});

  const entities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of MOCK_MEMORIES_9) {
      if (m.entity && !seen.has(m.entity.id)) seen.set(m.entity.id, m.entity.name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, []);

  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const m of MOCK_MEMORIES_9) for (const t of m.tags) seen.add(t);
    return Array.from(seen).sort();
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>MemoryFilterBar</Text>
      <Text style={styles.sub}>
        Click any chip — popovers open below, options select inline. Tags is
        multi-select.
      </Text>

      <View style={styles.barWrap}>
        <MemoryFilterBar
          filters={filters}
          availableEntities={entities}
          availableTags={tags}
          onChange={(delta) => setFilters((f) => ({ ...f, ...delta }))}
        />
      </View>

      <Pressable
        onPress={() =>
          setFilters({
            q: 'client calls, proposals, and project notes',
            type: 'meeting',
            sort: 'oldest',
            tags: ['Acme Builders'],
          })
        }
        style={styles.seed}
      >
        <Text style={styles.seedText}>Seed example filters</Text>
      </Pressable>
      <Pressable onPress={() => setFilters({})} style={styles.seed}>
        <Text style={styles.seedText}>Reset</Text>
      </Pressable>

      <View style={styles.jsonBox}>
        <Text style={styles.jsonLabel}>Current filters</Text>
        <Text style={styles.json}>{JSON.stringify(filters, null, 2)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
  },
  content: {
    padding: 32,
    gap: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary as string,
  },
  sub: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
    marginBottom: 8,
  },
  barWrap: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    minHeight: 200, // give popovers room
  },
  seed: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
  },
  seedText: {
    fontSize: 12,
    color: Colors.text.secondary as string,
    fontWeight: '500' as const,
  },
  jsonBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface.card as string,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
  },
  jsonLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.tertiary as string,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  json: {
    fontSize: 12,
    color: Colors.text.secondary as string,
    fontFamily: 'monospace',
  },
});
