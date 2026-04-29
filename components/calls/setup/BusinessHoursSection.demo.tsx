/**
 * BusinessHoursSection.demo — typical Mon–Fri config + edited weekend.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { BusinessHoursSection } from './BusinessHoursSection';
import type { BusinessHoursConfig } from './setup-types';

const DEFAULT_HOURS: BusinessHoursConfig = {
  days: [
    { day: 'mon', open: true, startTime: '09:00', endTime: '17:00' },
    { day: 'tue', open: true, startTime: '09:00', endTime: '17:00' },
    { day: 'wed', open: true, startTime: '09:00', endTime: '17:00' },
    { day: 'thu', open: true, startTime: '09:00', endTime: '17:00' },
    { day: 'fri', open: true, startTime: '09:00', endTime: '17:00' },
    { day: 'sat', open: false },
    { day: 'sun', open: false },
  ],
  afterHoursMode: 'TAKE_MESSAGE',
  pronunciationOverride: '',
};

const EXTENDED_HOURS: BusinessHoursConfig = {
  days: [
    { day: 'mon', open: true, startTime: '08:00', endTime: '18:00' },
    { day: 'tue', open: true, startTime: '08:00', endTime: '18:00' },
    { day: 'wed', open: true, startTime: '08:00', endTime: '18:00' },
    { day: 'thu', open: true, startTime: '08:00', endTime: '18:00' },
    { day: 'fri', open: true, startTime: '08:00', endTime: '18:00' },
    { day: 'sat', open: true, startTime: '10:00', endTime: '14:00' },
    { day: 'sun', open: false },
  ],
  afterHoursMode: 'TRY_TRANSFER_THEN_MESSAGE',
  pronunciationOverride: 'Zen-ith So-LOO-shuns',
};

export default function BusinessHoursSectionDemo() {
  const [a, setA] = useState<BusinessHoursConfig>(DEFAULT_HOURS);
  const [b, setB] = useState<BusinessHoursConfig>(EXTENDED_HOURS);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Standard — Mon–Fri 9–5, weekend closed">
        <BusinessHoursSection config={a} onChange={(p) => setA({ ...a, ...p })} />
      </Variant>

      <Variant title="Extended — Sat partial, pronunciation override, transfer fallback">
        <BusinessHoursSection config={b} onChange={(p) => setB({ ...b, ...p })} />
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
