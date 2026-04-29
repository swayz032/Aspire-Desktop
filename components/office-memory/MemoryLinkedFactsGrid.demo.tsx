/**
 * MemoryLinkedFactsGrid demo — full grid + minimal grid (just Add Link).
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemoryLinkedFactsGrid } from './MemoryLinkedFactsGrid';

export default function MemoryLinkedFactsGridDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Full grid (3 facts + Add Link)</Text>
      <MemoryLinkedFactsGrid
        facts={MOCK_MEMORY_DETAIL.linkedFacts}
        onFactPress={(f) => console.log('fact:', f.id)}
        onAddLink={() => console.log('add link')}
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Empty (just Add Link tile)</Text>
      <MemoryLinkedFactsGrid
        facts={[
          { id: 'add', kind: 'add_link', label: 'Add Link' },
        ]}
        onAddLink={() => console.log('add link')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground,
  },
  container: {
    padding: 32,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%' as unknown as number,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: Spacing.md,
  },
  spacer: {
    height: 32,
  },
});
