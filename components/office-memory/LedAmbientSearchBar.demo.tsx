/**
 * LedAmbientSearchBar demo — renders three states stacked vertically:
 *   1. Empty (default LED breathing)
 *   2. With query (submit button glows)
 *   3. Custom placeholder + autoFocus
 *
 * Used by the dev-only `app/demo/office-memory.tsx` cycler.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { LedAmbientSearchBar } from './LedAmbientSearchBar';

export default function LedAmbientSearchBarDemo() {
  const [empty, setEmpty] = useState('');
  const [withQuery, setWithQuery] = useState('Acme Builders contract');
  const [custom, setCustom] = useState('');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.row}>
        <Text style={styles.label}>State 1 — Empty (default LED breathing)</Text>
        <LedAmbientSearchBar
          value={empty}
          onChange={setEmpty}
          onSubmit={(v) => console.log('submit empty:', v)}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>State 2 — With query (submit ready)</Text>
        <LedAmbientSearchBar
          value={withQuery}
          onChange={setWithQuery}
          onSubmit={(v) => console.log('submit query:', v)}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>State 3 — Custom placeholder + autoFocus</Text>
        <LedAmbientSearchBar
          value={custom}
          onChange={setCustom}
          onSubmit={(v) => console.log('submit custom:', v)}
          placeholder="Search Q2 strategy memos…"
          autoFocus
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
    gap: 56,
  },
  row: {
    gap: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
});
