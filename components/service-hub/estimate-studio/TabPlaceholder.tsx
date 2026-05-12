import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabPlaceholderProps {
  tabName: string;
  phaseN: number;
  description?: string;
  icon?: IoniconsName;
}

export function TabPlaceholder({
  tabName,
  phaseN,
  description,
  icon = 'layers-outline',
}: TabPlaceholderProps) {
  return (
    <View style={styles.container} testID={`estimate-studio-tab-placeholder-${tabName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color="rgba(255,255,255,0.30)" />
      </View>
      <Text style={styles.title}>{tabName}</Text>
      <Text style={styles.subtitle}>
        {description || `Tab content lands in Phase ${phaseN}.`}
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
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 460,
  },
});
