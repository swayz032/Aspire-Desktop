/**
 * MessagesFilterTabs.demo — visual smoke + accessibility check.
 *
 * Drives output-critic's "Would Framer ship this filter strip?" review.
 *
 * Demos cover:
 *   1. Default — typical multi-tab counts, switching springs the underline
 *   2. Zero counts — every tab shows "0", proving the layout doesn't collapse
 *   3. Long counts — proving the count pill grows gracefully
 *   4. ⌘1–⌘4 keyboard shortcuts — interactive (try them on web)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import {
  MessagesFilterTabs,
  type MessagesFilterTab,
  type MessagesFilterCounts,
} from './MessagesFilterTabs';

const COUNTS_TYPICAL: MessagesFilterCounts = {
  all: 42,
  unread: 7,
  pinned: 3,
  archived: 14,
};
const COUNTS_ZERO: MessagesFilterCounts = {
  all: 0,
  unread: 0,
  pinned: 0,
  archived: 0,
};
const COUNTS_HIGH: MessagesFilterCounts = {
  all: 1287,
  unread: 134,
  pinned: 12,
  archived: 4096,
};

export default function MessagesFilterTabsDemo() {
  const [tabA, setTabA] = useState<MessagesFilterTab>('all');
  const [tabB, setTabB] = useState<MessagesFilterTab>('unread');
  const [tabC, setTabC] = useState<MessagesFilterTab>('pinned');

  const [bulkLog, setBulkLog] = useState<string[]>([]);
  const log = (s: string) =>
    setBulkLog((prev) => [
      `${new Date().toLocaleTimeString()} ${s}`,
      ...prev.slice(0, 4),
    ]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Typical counts (try ⌘1-⌘4 on web)">
        <View style={styles.tabsHost}>
          <MessagesFilterTabs
            activeTab={tabA}
            onChange={setTabA}
            counts={COUNTS_TYPICAL}
            onMarkAllRead={() => log('Mark all read fired')}
            onClearArchived={() => log('Clear archived fired')}
            onExportSelected={() => log('Export selected fired')}
          />
        </View>
        <Text style={styles.activeText}>Active: {tabA}</Text>
      </Variant>

      <Variant title="Zero counts everywhere">
        <View style={styles.tabsHost}>
          <MessagesFilterTabs
            activeTab={tabB}
            onChange={setTabB}
            counts={COUNTS_ZERO}
            onMarkAllRead={() => log('Mark all read fired (zero)')}
            onClearArchived={() => log('Clear archived fired (zero)')}
          />
        </View>
        <Text style={styles.activeText}>Active: {tabB}</Text>
      </Variant>

      <Variant title="High counts (4-digit archived)">
        <View style={styles.tabsHost}>
          <MessagesFilterTabs
            activeTab={tabC}
            onChange={setTabC}
            counts={COUNTS_HIGH}
            onMarkAllRead={() => log('Mark all read fired (high)')}
            onClearArchived={() => log('Clear archived fired (high)')}
          />
        </View>
        <Text style={styles.activeText}>Active: {tabC}</Text>
      </Variant>

      <View style={styles.log}>
        <Text style={styles.logTitle}>Bulk-action log</Text>
        {bulkLog.length === 0 ? (
          <Text style={styles.logEmpty}>
            Open the ⋮ menu to fire bulk actions.
          </Text>
        ) : (
          bulkLog.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>
              {entry}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Variant({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  content: {
    padding: 32,
    gap: 32,
  },
  variant: {
    gap: 12,
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tabsHost: {
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
  },
  activeText: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontFamily: Platform.select({ web: 'monospace' }),
  },
  log: {
    padding: 16,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  logTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  logEmpty: {
    fontSize: 12,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  logEntry: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontFamily: Platform.select({ web: 'monospace' }),
  },
});
