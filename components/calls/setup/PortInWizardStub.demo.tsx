/**
 * PortInWizardStub.demo — default + registered (after notify-me) state.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { PortInWizardStub } from './PortInWizardStub';

export default function PortInWizardStubDemo() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Default — port-in advanced placeholder">
        <PortInWizardStub
          onNotifyMe={async () => {
            await new Promise((r) => setTimeout(r, 600));
          }}
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
