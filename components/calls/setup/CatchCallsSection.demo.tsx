/**
 * CatchCallsSection.demo — covers the 6 cells of the §3.2 interlock matrix.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { CatchCallsSection } from './CatchCallsSection';
import type {
  CatchMode,
  PublicNumberMode,
  CatchInterlockResult,
} from './setup-types';

export default function CatchCallsSectionDemo() {
  // 6 fixtures = 3 catch modes × 3 public-number modes (representative cells)
  const [m1, setM1] = useState<CatchMode>('APP_AND_PHONE_SIMUL_RING');
  const [m2, setM2] = useState<CatchMode>('APP_ONLY');
  const [m3, setM3] = useState<CatchMode>('APP_AND_PHONE_SIMUL_RING');
  const [m4, setM4] = useState<CatchMode>('PHONE_ONLY');
  const [m5, setM5] = useState<CatchMode>('APP_AND_PHONE_SIMUL_RING');

  const [statuses, setStatuses] = useState<Record<string, CatchInterlockResult>>({});

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="ASPIRE_NEW_NUMBER + Ring both → ok">
        <CatchCallsSection
          mode={m1}
          onChange={setM1}
          publicNumberMode={'ASPIRE_NEW_NUMBER' as PublicNumberMode}
          onValidityChange={(r) => setStatuses((s) => ({ ...s, m1: r }))}
        />
      </Variant>

      <Variant title="FORWARD_EXISTING + APP_ONLY → INVALID (red chip)">
        <CatchCallsSection
          mode={m2}
          onChange={setM2}
          publicNumberMode={'FORWARD_EXISTING' as PublicNumberMode}
          onValidityChange={(r) => setStatuses((s) => ({ ...s, m2: r }))}
        />
      </Variant>

      <Variant title="FORWARD_EXISTING + Ring both → WARN (amber chip)">
        <CatchCallsSection
          mode={m3}
          onChange={setM3}
          publicNumberMode={'FORWARD_EXISTING' as PublicNumberMode}
          onValidityChange={(r) => setStatuses((s) => ({ ...s, m3: r }))}
        />
      </Variant>

      <Variant title="FORWARD_EXISTING + Phone only → ok">
        <CatchCallsSection
          mode={m4}
          onChange={setM4}
          publicNumberMode={'FORWARD_EXISTING' as PublicNumberMode}
          onValidityChange={(r) => setStatuses((s) => ({ ...s, m4: r }))}
        />
      </Variant>

      <Variant title="PORT_IN + Ring both → ok">
        <CatchCallsSection
          mode={m5}
          onChange={setM5}
          publicNumberMode={'PORT_IN' as PublicNumberMode}
          onValidityChange={(r) => setStatuses((s) => ({ ...s, m5: r }))}
        />
      </Variant>

      <View style={styles.statusBlock}>
        <Text style={styles.statusHeader}>Validity callback log</Text>
        {Object.entries(statuses).map(([k, r]) => (
          <Text key={k} style={styles.statusLine}>
            {k}: {r.severity}
            {r.message ? ` — ${r.message}` : ''}
          </Text>
        ))}
      </View>
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
  content: { padding: 32, gap: 28 },
  variant: { gap: 12 },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  statusBlock: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#101012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 6,
  },
  statusHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusLine: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
  } as any,
});
