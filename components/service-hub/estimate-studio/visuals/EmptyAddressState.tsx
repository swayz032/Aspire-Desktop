/**
 * EmptyAddressState — premium empty hero shown when no address is set yet.
 *
 * Mirrors the inline state in `app/service-hub/estimate-studio/visuals.tsx`
 * but is exported as a standalone component for reuse in other tabs.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function EmptyAddressState() {
  return (
    <View style={styles.container} testID="empty-address-state">
      <View style={styles.iconWrap}>
        <Ionicons name="location-outline" size={28} color="rgba(255,255,255,0.45)" />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        Enter a property address
      </Text>
      <Text style={styles.subtitle}>
        Type an address above to see Street View, photos, and property facts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    minHeight: 480,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 460,
  },
});
