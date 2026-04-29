/**
 * CatchCallsSection.demo — all 3 mode states.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { CatchCallsSection } from './CatchCallsSection';
import type { CatchMode } from './setup-types';

export default function CatchCallsSectionDemo() {
  const [m1, setM1] = useState<CatchMode>('APP_AND_PHONE_SIMUL_RING');
  const [m2, setM2] = useState<CatchMode>('APP_ONLY');
  const [m3, setM3] = useState<CatchMode>('PHONE_ONLY');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Default — Ring both (advanced)">
        <CatchCallsSection mode={m1} onChange={setM1} />
      </Variant>
      <Variant title="App only">
        <CatchCallsSection mode={m2} onChange={setM2} />
      </Variant>
      <Variant title="Phone only">
        <CatchCallsSection mode={m3} onChange={setM3} />
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
  scroll: { flex: 1, backgroundColor: '#0a0a0c', ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}) } as any,
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
