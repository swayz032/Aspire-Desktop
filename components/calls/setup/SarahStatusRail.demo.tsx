/**
 * SarahStatusRail.demo — covers the 4 verification states + idle Sarah.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { SarahStatusRail } from './SarahStatusRail';
import type { SarahStatus, SetupSummaryItem } from './setup-types';

const SARAH_ACTIVE: SarahStatus = {
  active: true,
  displayName: 'Sarah',
  roleLabel: 'AI Front Desk Agent',
};

const SARAH_IDLE: SarahStatus = {
  active: false,
  displayName: 'Sarah',
  roleLabel: 'AI Front Desk Agent',
};

const SUMMARY: SetupSummaryItem[] = [
  { iconName: 'call-outline', label: 'Public number', value: 'Aspire number' },
  { iconName: 'arrow-redo-outline', label: 'Catch calls', value: 'Ring both' },
  { iconName: 'time-outline', label: 'Open hours', value: 'Mon–Fri, 9:00–5:00' },
  { iconName: 'moon-outline', label: 'After hours', value: 'Take message' },
  { iconName: 'people-outline', label: 'Routing contacts', value: '3 configured' },
];

export default function SarahStatusRailDemo() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Active — Aspire number mode (forwarding not needed)">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="ASPIRE_NUMBER"
          />
        </Hosted>
      </Variant>

      <Variant title="Active — Keep current, NOT_CONFIGURED">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="KEEP_CURRENT_NUMBER"
            forwarding={{ status: 'NOT_CONFIGURED' }}
          />
        </Hosted>
      </Variant>

      <Variant title="Active — Keep current, PENDING">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="KEEP_CURRENT_NUMBER"
            forwarding={{ status: 'PENDING' }}
          />
        </Hosted>
      </Variant>

      <Variant title="Active — Keep current, VERIFIED">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="KEEP_CURRENT_NUMBER"
            forwarding={{ status: 'VERIFIED', lastTestAt: 'Apr 28, 2:14 PM' }}
          />
        </Hosted>
      </Variant>

      <Variant title="Idle — LAST_TEST_FAILED with error">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_IDLE}
            summary={SUMMARY}
            publicNumberMode="KEEP_CURRENT_NUMBER"
            forwarding={{
              status: 'LAST_TEST_FAILED',
              lastTestErrorMessage: 'Carrier rejected the call after 3 retries.',
            }}
          />
        </Hosted>
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

function Hosted({ children }: { children: React.ReactNode }) {
  // Simulates the rail's natural width (~30% of a 1280 desktop = 360–400)
  return <View style={styles.hosted}>{children}</View>;
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
  hosted: {
    width: 380,
    maxWidth: '100%',
  },
});
