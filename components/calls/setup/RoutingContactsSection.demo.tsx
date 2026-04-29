/**
 * RoutingContactsSection.demo — populated table + empty + add modal.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { RoutingContactsSection } from './RoutingContactsSection';
import type { RoutingContact } from './setup-types';

const SAMPLE: RoutingContact[] = [
  {
    id: 'rc-owner',
    role: 'owner',
    name: 'Tonio Scott',
    phone: '(404) 555-0182',
    initials: 'TS',
    fallbackMode: 'TRANSFER_ALLOWED',
    transferAllowed: true,
    priority: 0,
  },
  {
    id: 'rc-sales',
    role: 'sales',
    name: 'Maya Reed',
    phone: '(404) 555-0144',
    initials: 'MR',
    fallbackMode: 'TRANSFER_ALLOWED',
    transferAllowed: true,
    priority: 1,
  },
  {
    id: 'rc-support',
    role: 'support',
    name: 'James Cole',
    phone: '(404) 555-0177',
    initials: 'JC',
    fallbackMode: 'MESSAGE_FALLBACK',
    transferAllowed: true,
    priority: 2,
  },
];

export default function RoutingContactsSectionDemo() {
  const [populated, setPopulated] = useState<RoutingContact[]>(SAMPLE);
  const [empty, setEmpty] = useState<RoutingContact[]>([]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Populated — three roles">
        <RoutingContactsSection contacts={populated} onChange={setPopulated} />
      </Variant>

      <Variant title="Empty state">
        <RoutingContactsSection contacts={empty} onChange={setEmpty} />
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
