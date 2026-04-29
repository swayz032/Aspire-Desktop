/**
 * MemoryKeyDecisionsCard demo — checked, mixed, and empty states.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemoryKeyDecisionsCard } from './MemoryKeyDecisionsCard';

export default function MemoryKeyDecisionsCardDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — All checked (default)</Text>
      <MemoryKeyDecisionsCard items={MOCK_MEMORY_DETAIL.keyDecisions} />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Mixed checked / unchecked</Text>
      <MemoryKeyDecisionsCard
        items={[
          { id: '1', label: 'Approve revised layout', checked: true },
          { id: '2', label: 'Confirm budget cap', checked: false },
          { id: '3', label: 'Send proposal v2', checked: true },
          { id: '4', label: 'Schedule follow-up walk', checked: false },
        ]}
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 3 — Empty</Text>
      <MemoryKeyDecisionsCard items={[]} />
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
