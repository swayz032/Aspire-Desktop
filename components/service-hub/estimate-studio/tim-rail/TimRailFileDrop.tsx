import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TimRailFileDrop() {
  return (
    <View style={styles.container} testID="tim-rail-file-drop">
      <View style={styles.dashed}>
        <Ionicons name="cloud-upload-outline" size={20} color="rgba(255,255,255,0.45)" />
        <Text style={styles.title}>Drop files here</Text>
        <Text style={styles.subtitle}>Photos, plans, PDFs · up to 50 MB</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  dashed: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
  },
});
