/**
 * MemoryActivityReceiptsRow demo — full row + empty state.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemoryActivityReceiptsRow } from './MemoryActivityReceiptsRow';

export default function MemoryActivityReceiptsRowDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Full row (4 mixed kinds)</Text>
      <MemoryActivityReceiptsRow
        files={MOCK_MEMORY_DETAIL.activityFiles}
        onFilePress={(f) => console.log('open:', f.id)}
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Empty state</Text>
      <MemoryActivityReceiptsRow files={[]} />
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
