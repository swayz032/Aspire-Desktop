/**
 * MemoryCard demo — three states:
 *   1. Default (meeting type, not bookmarked)
 *   2. Bookmarked + invoice type (different pill color)
 *   3. Compact list-mode variant
 *
 * Renders against the deep-black memory page background so halo glow reads
 * correctly.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORIES_9 } from './fixtures';
import { MemoryCard } from './MemoryCard';

export default function MemoryCardDemo() {
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({
    [MOCK_MEMORIES_9[0].id]: false,
    [MOCK_MEMORIES_9[6].id]: true,
    [MOCK_MEMORIES_9[7].id]: false,
  });

  const toggle = (id: string) =>
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Default (meeting, not bookmarked)</Text>
      <View style={styles.cardWrap}>
        <MemoryCard
          memory={{ ...MOCK_MEMORIES_9[0], bookmarked: bookmarks[MOCK_MEMORIES_9[0].id] }}
          onPress={() => console.log('press card 1')}
          onBookmarkToggle={() => toggle(MOCK_MEMORIES_9[0].id)}
        />
      </View>

      <Text style={styles.label}>State 2 — Bookmarked + invoice (green pill)</Text>
      <View style={styles.cardWrap}>
        <MemoryCard
          memory={{ ...MOCK_MEMORIES_9[6], bookmarked: bookmarks[MOCK_MEMORIES_9[6].id] }}
          onPress={() => console.log('press card 2')}
          onBookmarkToggle={() => toggle(MOCK_MEMORIES_9[6].id)}
        />
      </View>

      <Text style={styles.label}>State 3 — Compact list-mode (call type)</Text>
      <View style={styles.cardWrap}>
        <MemoryCard
          memory={{ ...MOCK_MEMORIES_9[7], bookmarked: bookmarks[MOCK_MEMORIES_9[7].id] }}
          onPress={() => console.log('press card 3')}
          onBookmarkToggle={() => toggle(MOCK_MEMORIES_9[7].id)}
          compact
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground,
  },
  container: {
    padding: Spacing.xxxl,
    gap: Spacing.xxl,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%' as unknown as number,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  cardWrap: {
    width: '100%' as unknown as number,
  },
});
