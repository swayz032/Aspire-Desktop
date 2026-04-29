/**
 * MemoryDetailHeader demo — three states:
 *   1. Default (full memory with entity + project + duration)
 *   2. No project, no duration
 *   3. With actions menu open programmatically (interaction test)
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemoryDetailHeader } from './MemoryDetailHeader';

export default function MemoryDetailHeaderDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Full memory (entity + project + duration)</Text>
      <MemoryDetailHeader
        memory={MOCK_MEMORY_DETAIL}
        onBack={() => console.log('back')}
        onAction={(a) => console.log('action:', a)}
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Minimal (no project, no duration)</Text>
      <MemoryDetailHeader
        memory={{
          ...MOCK_MEMORY_DETAIL,
          project: undefined,
          duration: undefined,
          title: 'Standalone note about pricing',
        }}
        onBack={() => console.log('back')}
        onAction={(a) => console.log('action:', a)}
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
    gap: Spacing.md,
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
    height: 64,
  },
});
