/**
 * MemoryCardGlowHalo demo — three intensity stops side-by-side.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { MemoryCardGlowHalo, type HaloIntensity } from './MemoryCardGlowHalo';

const INTENSITIES: HaloIntensity[] = ['subtle', 'normal', 'strong'];

export default function MemoryCardGlowHaloDemo() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Halo intensity comparison</Text>
      <View style={styles.row}>
        {INTENSITIES.map((intensity) => (
          <View key={intensity} style={styles.col}>
            <Text style={styles.label}>{intensity}</Text>
            <MemoryCardGlowHalo intensity={intensity}>
              <View style={styles.fakeCard}>
                <Text style={styles.fakeCardText}>Card content</Text>
              </View>
            </MemoryCardGlowHalo>
          </View>
        ))}
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
    padding: 64,
    gap: Spacing.xxl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: 48,
    flexWrap: 'wrap',
  },
  col: {
    gap: Spacing.md,
    width: 240,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  fakeCard: {
    height: 160,
    borderRadius: 16,
    backgroundColor: Colors.memory.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  fakeCardText: {
    color: Colors.text.tertiary,
    fontSize: 14,
  },
});
