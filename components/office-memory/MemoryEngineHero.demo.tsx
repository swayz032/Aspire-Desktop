/**
 * MemoryEngineHero demo — full-screen render of the hero with mock onSearch.
 *
 * Three states:
 *   1. Default
 *   2. Constrained-height embed (e.g., when shown above a fold preview)
 *   3. With real router-style callback that logs the query
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MemoryEngineHero } from './MemoryEngineHero';

export default function MemoryEngineHeroDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>State 1 — Default hero</Text>
      <View style={styles.heroFrame}>
        <MemoryEngineHero onSearch={(q) => console.log('search →', q)} />
      </View>

      <Text style={styles.label}>State 2 — Constrained height (480px frame)</Text>
      <View style={[styles.heroFrame, { height: 480 }]}>
        <MemoryEngineHero onSearch={(q) => alert(`Submitted: ${q}`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  container: {
    padding: Spacing.xxxl,
    gap: Spacing.xxl,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: Spacing.sm,
  },
  heroFrame: {
    height: 800,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
});
