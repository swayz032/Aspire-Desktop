/**
 * PublicNumberSection.demo — covers all 3 honest 2026 modes (§3.1):
 *   - ASPIRE_NEW_NUMBER (default + with active number)
 *   - FORWARD_EXISTING (with companion-SMS picker entry)
 *   - PORT_IN (V1.1 stub)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { PublicNumberSection } from './PublicNumberSection';
import type { PublicNumberConfig } from './setup-types';

export default function PublicNumberSectionDemo() {
  const [a, setA] = useState<PublicNumberConfig>({
    mode: 'ASPIRE_NEW_NUMBER',
  });
  const [b, setB] = useState<PublicNumberConfig>({
    mode: 'ASPIRE_NEW_NUMBER',
    selectedNumberId: '+14483331552',
  });
  const [c, setC] = useState<PublicNumberConfig>({
    mode: 'FORWARD_EXISTING',
    forwardedNumber: '(404) 555-0182',
  });
  const [d, setD] = useState<PublicNumberConfig>({
    mode: 'PORT_IN',
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Aspire new number — default selected, no number picked yet">
        <PublicNumberSection config={a} onChange={(p) => setA({ ...a, ...p })} />
      </Variant>

      <Variant title="Aspire new number — number purchased & active">
        <PublicNumberSection config={b} onChange={(p) => setB({ ...b, ...p })} />
      </Variant>

      <Variant title="Forward existing — owner enters their existing carrier number">
        <PublicNumberSection config={c} onChange={(p) => setC({ ...c, ...p })} />
      </Variant>

      <Variant title="Port-in (advanced V1.1) — placeholder timeline">
        <PublicNumberSection config={d} onChange={(p) => setD({ ...d, ...p })} />
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
  content: { padding: 32, gap: 32 },
  variant: { gap: 12 },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
