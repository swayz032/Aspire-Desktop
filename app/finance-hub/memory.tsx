import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';

export default function MemoryScreen() {
  return (
    <FinanceHubShell>
      <View style={styles.container}>
        <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.15)" />
        <Text style={styles.title}>Money Memory</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
  },
});
