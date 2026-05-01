/**
 * ForwardingInstructionsCard.demo — covers AT&T, Verizon, T-Mobile, Other,
 * + the testing-busy state.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { ForwardingInstructionsCard } from './ForwardingInstructionsCard';
import type { ForwardingCodeSet, CarrierName } from './setup-types';

const ATT_CODES: ForwardingCodeSet = {
  always: '**21*+14045550182#',
  busy: '**67*+14045550182#',
  noAnswer: '**61*+14045550182#',
  unreachable: '**62*+14045550182#',
};

const VERIZON_CODES: ForwardingCodeSet = {
  always: '*72 14045550182',
  busy: '*71 14045550182',
  noAnswer: '*71 14045550182',
  unreachable: '*72 14045550182',
};

const TMOBILE_CODES: ForwardingCodeSet = {
  always: '**21*+14045550182#',
  busy: '**67*+14045550182#',
  noAnswer: '**61*+14045550182#',
  unreachable: '**62*+14045550182#',
};

const OTHER_CODES: ForwardingCodeSet = {
  always: '**21*+14045550182#',
  busy: '**67*+14045550182#',
  noAnswer: '**61*+14045550182#',
  unreachable: '**62*+14045550182#',
};

const ASPIRE_TARGET = '(404) 555-0182';

export default function ForwardingInstructionsCardDemo() {
  const [busy, setBusy] = useState(false);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="AT&T">
        <ForwardingInstructionsCard
          carrierName={'AT&T' as CarrierName}
          codes={ATT_CODES}
          aspireForwardTarget={ASPIRE_TARGET}
          helpUrl="https://www.att.com/support/article/wireless/KM1009099/"
          onTestForwarding={() => {
            setBusy(true);
            setTimeout(() => setBusy(false), 1600);
          }}
          isTesting={busy}
        />
      </Variant>

      <Variant title="Verizon">
        <ForwardingInstructionsCard
          carrierName={'Verizon' as CarrierName}
          codes={VERIZON_CODES}
          aspireForwardTarget={ASPIRE_TARGET}
        />
      </Variant>

      <Variant title="T-Mobile (with carrier docs link)">
        <ForwardingInstructionsCard
          carrierName={'T-Mobile' as CarrierName}
          codes={TMOBILE_CODES}
          aspireForwardTarget={ASPIRE_TARGET}
          helpUrl="https://www.t-mobile.com/support/devices/call-forwarding"
        />
      </Variant>

      <Variant title="Other / unrecognized carrier — Test busy state">
        <ForwardingInstructionsCard
          carrierName={'Other' as CarrierName}
          codes={OTHER_CODES}
          aspireForwardTarget={ASPIRE_TARGET}
          isTesting
          onTestForwarding={() => {}}
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
  content: { padding: 32, gap: 28 },
  variant: { gap: 12 },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
