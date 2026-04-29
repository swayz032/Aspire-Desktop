/**
 * MemoryGridListToggle demo — segmented control + Export button.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import { MemoryGridListToggle } from './MemoryGridListToggle';
import type { MemoryViewMode } from './types';

export function MemoryGridListToggleDemo() {
  const [view, setView] = useState<MemoryViewMode>('grid');
  const [exportCount, setExportCount] = useState(0);

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>MemoryGridListToggle</Text>
      <Text style={styles.sub}>
        Right-aligned trio: grid/list segmented control + ghost Export button.
      </Text>

      <View style={styles.row}>
        <MemoryGridListToggle
          viewMode={view}
          onChange={setView}
          onExport={() => setExportCount((c) => c + 1)}
        />
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Current view:</Text>
        <Text style={styles.statusValue}>{view}</Text>
      </View>
      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>Export presses:</Text>
        <Text style={styles.statusValue}>{exportCount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
    padding: 32,
    gap: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary as string,
  },
  sub: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusBox: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface.card as string,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    alignSelf: 'flex-start',
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.text.tertiary as string,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 12,
    color: Colors.accent.cyan as string,
    fontWeight: '700' as const,
  },
});
