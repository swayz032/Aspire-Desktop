import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { FinnDeskPanel } from '@/components/finance/FinnDeskPanel';

export default function FinnScreen() {
  return (
    <FinanceHubShell>
      <View style={finnStyles.container}>
        <FinnDeskPanel />
      </View>
    </FinanceHubShell>
  );
}

const finnStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as any,
});
