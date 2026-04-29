/**
 * MemorySummaryCard demo — short and long body lengths.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MOCK_MEMORY_DETAIL } from './fixtures';
import { MemorySummaryCard } from './MemorySummaryCard';

export default function MemorySummaryCardDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Default summary</Text>
      <MemorySummaryCard summary={MOCK_MEMORY_DETAIL.summary} />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 2 — Long summary (4-paragraph)</Text>
      <MemorySummaryCard
        summary={
          'Discussed change order for lobby finishes and timeline impact. Client approved updated scope and budget. Payment terms revised to 30/60/90 with 5% retainer. Timeline pushed by 2 weeks to accommodate new finish samples — Tonio to confirm with vendor. Final approval expected by next Friday after legal review.'
        }
      />

      <View style={styles.spacer} />

      <Text style={styles.label}>State 3 — Custom eyebrow</Text>
      <MemorySummaryCard summary={MOCK_MEMORY_DETAIL.summary} eyebrow="Executive note" />
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
