/**
 * BusyModeSection.demo — all 3 mode states.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { BusyModeSection } from './BusyModeSection';
import type { BusyMode } from './setup-types';

export default function BusyModeSectionDemo() {
  const [a, setA] = useState<BusyMode>('TAKE_MESSAGE');
  const [b, setB] = useState<BusyMode>('ASK_CALLBACK_WINDOW');
  const [c, setC] = useState<BusyMode>('TRY_TRANSFER_THEN_MESSAGE');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Take message">
        <BusyModeSection mode={a} onChange={setA} />
      </Variant>
      <Variant title="Ask for callback window">
        <BusyModeSection mode={b} onChange={setB} />
      </Variant>
      <Variant title="Try transfer once, then message">
        <BusyModeSection mode={c} onChange={setC} />
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
