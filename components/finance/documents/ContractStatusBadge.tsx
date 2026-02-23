/**
 * ContractStatusBadge -- Glass-morphism status badge for contract lifecycle.
 * Renders a pill with dot indicator and label, colored per CONTRACT_STATUS map.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { CONTRACT_STATUS, type ContractStatus } from './contractConstants';

interface ContractStatusBadgeProps {
  status: ContractStatus;
  size?: 'sm' | 'md';
}

function ContractStatusBadgeInner({ status, size = 'sm' }: ContractStatusBadgeProps) {
  const meta = CONTRACT_STATUS[status] ?? CONTRACT_STATUS.draft;
  const isMd = size === 'md';

  return (
    <View
      style={[
        styles.badge,
        isMd && styles.badgeMd,
        { backgroundColor: meta.bg },
        Platform.OS === 'web' ? {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any : {},
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${meta.label}`}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.label, isMd && styles.labelMd, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

export const ContractStatusBadge = React.memo(ContractStatusBadgeInner);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  badgeMd: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 13,
  },
});
