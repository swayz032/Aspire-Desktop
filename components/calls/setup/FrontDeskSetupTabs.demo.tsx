/**
 * FrontDeskSetupTabs.demo — visual smoke test for the 5-step segmented tab nav.
 * Cycles through default / dirty-tabs / preselected variants.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import {
  FrontDeskSetupTabs,
  type FrontDeskTabId,
} from './FrontDeskSetupTabs';

export default function FrontDeskSetupTabsDemo() {
  const [a, setA] = useState<FrontDeskTabId>('public-number');
  const [b, setB] = useState<FrontDeskTabId>('hours');
  const [c, setC] = useState<FrontDeskTabId>('routing');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Default — first tab active">
        <FrontDeskSetupTabs activeTab={a} onChange={setA} />
        <Output>{`Active: ${a}`}</Output>
      </Variant>

      <Variant title="With dirty tabs (Public Number + Routing)">
        <FrontDeskSetupTabs
          activeTab={b}
          onChange={setB}
          dirtyTabs={new Set<FrontDeskTabId>(['public-number', 'routing'])}
        />
        <Output>{`Active: ${b}`}</Output>
      </Variant>

      <Variant title="All tabs dirty — Routing active">
        <FrontDeskSetupTabs
          activeTab={c}
          onChange={setC}
          dirtyTabs={
            new Set<FrontDeskTabId>([
              'public-number',
              'catch',
              'hours',
              'routing',
              'busy',
            ])
          }
        />
        <Output>{`Active: ${c}`}</Output>
      </Variant>
    </ScrollView>
  );
}

function Variant({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      <View style={styles.variantBody}>{children}</View>
    </View>
  );
}

function Output({ children }: { children: string }) {
  return (
    <View style={styles.output}>
      <Text style={styles.outputText}>{children}</Text>
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
  variantBody: {
    backgroundColor: '#101012',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 12,
  },
  output: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
  },
  outputText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.accent.cyan,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
});
