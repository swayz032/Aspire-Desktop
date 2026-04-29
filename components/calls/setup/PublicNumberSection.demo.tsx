/**
 * PublicNumberSection.demo — both modes + selection states + empty.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { PublicNumberSection } from './PublicNumberSection';
import type { PublicNumberConfig, AvailableNumber } from './setup-types';

const SAMPLE_NUMBERS: AvailableNumber[] = [
  { id: 'n1', number: '(212) 555-0198', inboundReady: true, outboundAvailable: true },
  { id: 'n2', number: '(212) 555-7204', inboundReady: true, outboundAvailable: true },
  { id: 'n3', number: '(212) 555-3148', inboundReady: true, outboundAvailable: true },
];

export default function PublicNumberSectionDemo() {
  const [a, setA] = useState<PublicNumberConfig>({
    mode: 'ASPIRE_NUMBER',
    areaCode: '212',
    selectedNumberId: 'n1',
  });
  const [b, setB] = useState<PublicNumberConfig>({
    mode: 'KEEP_CURRENT_NUMBER',
    forwardedNumber: '(404) 555-0182',
  });
  const [c, setC] = useState<PublicNumberConfig>({
    mode: 'ASPIRE_NUMBER',
    areaCode: '',
    containsFilter: 'PAINT',
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Aspire number — number selected">
        <PublicNumberSection
          config={a}
          onChange={(p) => setA({ ...a, ...p })}
          availableNumbers={SAMPLE_NUMBERS}
        />
      </Variant>

      <Variant title="Keep current number — sub-form hidden">
        <PublicNumberSection config={b} onChange={(p) => setB({ ...b, ...p })} />
      </Variant>

      <Variant title="Aspire number — no area code, empty results hint">
        <PublicNumberSection
          config={c}
          onChange={(p) => setC({ ...c, ...p })}
          availableNumbers={[]}
        />
      </Variant>
    </ScrollView>
  );
}

function Variant({ title, children }: { title: string; children: React.ReactNode }) {
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
  content: { padding: 32, gap: 24 },
  variant: { gap: 12 },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
