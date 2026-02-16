import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { FinnDeskPanel } from '@/components/finance/FinnDeskPanel';
import { FinanceRightRail } from '@/components/finance/FinanceRightRail';

export default function FinnScreen() {
  return (
    <FinanceHubShell rightRail={<FinanceRightRail />}>
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
