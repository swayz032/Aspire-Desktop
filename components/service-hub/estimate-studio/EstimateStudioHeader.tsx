import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EstimateStudioHeaderProps {
  title?: string;
  subtitle?: string;
  showBetaBadge?: boolean;
}

export function EstimateStudioHeader({
  title = 'Estimate Studio',
  subtitle = 'Visual estimating workbench for residential and commercial jobs.',
  showBetaBadge = true,
}: EstimateStudioHeaderProps) {
  return (
    <View style={styles.container} testID="estimate-studio-header">
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {showBetaBadge && (
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  betaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.30)',
  },
  betaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#fbbf24',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
});
