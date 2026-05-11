import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FrontDeskShell } from '@/components/front-desk/FrontDeskShell';

export default function FrontDeskRoute() {
  return (
    <FrontDeskShell>
      <View style={styles.blank} />
    </FrontDeskShell>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    minHeight: 400,
    backgroundColor: '#0a0a0a',
  },
});
