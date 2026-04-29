/**
 * MemoryDetailsCard demo — full and minimal variants.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemoryDetailsCard } from './MemoryDetailsCard';

export default function MemoryDetailsCardDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Full details</Text>
      <MemoryDetailsCard
        details={{
          participants: MOCK_MEMORY_DETAIL.participants,
          location: MOCK_MEMORY_DETAIL.location,
          createdBy: MOCK_MEMORY_DETAIL.createdBy,
          tags: MOCK_MEMORY_DETAIL.tags,
        }}
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Minimal (no location, no tags)</Text>
      <MemoryDetailsCard
        details={{
          participants: ['Tonio Scott'],
          createdBy: 'Tonio Scott',
          tags: [],
        }}
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
