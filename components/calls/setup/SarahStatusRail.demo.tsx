/**
 * SarahStatusRail.demo — Pass 19 update covers all 3 modes + dual-number
 * card (FORWARD_EXISTING) + the 4 verification states.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { SarahStatusRail } from './SarahStatusRail';
import type {
  SarahStatus,
  SetupSummaryItem,
  PublicNumberConfig,
} from './setup-types';

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
  { iconName: 'call-outline', label: 'Public number', value: 'Aspire — new' },
  { iconName: 'arrow-redo-outline', label: 'Catch calls', value: 'Ring both' },
  { iconName: 'time-outline', label: 'Open hours', value: 'Mon–Fri, 9:00–5:00' },
  { iconName: 'moon-outline', label: 'After hours', value: 'Take message' },
  { iconName: 'people-outline', label: 'Routing contacts', value: '3 configured' },
];

const FORWARD_CONFIG: PublicNumberConfig = {
  mode: 'FORWARD_EXISTING',
  selectedNumberId: '+14483331552',
  forwardedNumber: '(404) 555-0182',
};

const ASPIRE_CONFIG: PublicNumberConfig = {
  mode: 'ASPIRE_NEW_NUMBER',
  selectedNumberId: '+14483331552',
};

const PORT_CONFIG: PublicNumberConfig = {
  mode: 'PORT_IN',
};

export default function SarahStatusRailDemo() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="ASPIRE_NEW_NUMBER — verification not needed">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="ASPIRE_NEW_NUMBER"
            publicNumberConfig={ASPIRE_CONFIG}
          />
        </Hosted>
      </Variant>

      <Variant title="FORWARD_EXISTING — dual-number card visible, NOT_CONFIGURED">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="FORWARD_EXISTING"
            publicNumberConfig={FORWARD_CONFIG}
            forwarding={{ status: 'NOT_CONFIGURED' }}
          />
        </Hosted>
      </Variant>

      <Variant title="FORWARD_EXISTING — PENDING">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="FORWARD_EXISTING"
            publicNumberConfig={FORWARD_CONFIG}
            forwarding={{ status: 'PENDING' }}
          />
        </Hosted>
      </Variant>

      <Variant title="FORWARD_EXISTING — VERIFIED">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="FORWARD_EXISTING"
            publicNumberConfig={FORWARD_CONFIG}
            forwarding={{ status: 'VERIFIED', lastTestAt: 'Apr 28, 2:14 PM' }}
          />
        </Hosted>
      </Variant>

      <Variant title="FORWARD_EXISTING — LAST_TEST_FAILED">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_IDLE}
            summary={SUMMARY}
            publicNumberMode="FORWARD_EXISTING"
            publicNumberConfig={FORWARD_CONFIG}
            forwarding={{
              status: 'LAST_TEST_FAILED',
              lastTestErrorMessage: 'Carrier rejected the call after 3 retries.',
            }}
          />
        </Hosted>
      </Variant>

      <Variant title="PORT_IN — direct ownership">
        <Hosted>
          <SarahStatusRail
            sarah={SARAH_ACTIVE}
            summary={SUMMARY}
            publicNumberMode="PORT_IN"
            publicNumberConfig={PORT_CONFIG}
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
