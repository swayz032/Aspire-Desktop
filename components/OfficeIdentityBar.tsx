import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { StatusDot } from './ui/Badge';
import { Tenant } from '@/types';

interface OfficeIdentityBarProps {
  tenant: Tenant;
  showStatus?: boolean;
}

export function OfficeIdentityBar({ tenant, showStatus = true }: OfficeIdentityBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {showStatus && <StatusDot status="active" />}
        <Text style={styles.businessName}>{tenant.businessName}</Text>
      </View>
      <Text style={styles.details}>
        Suite {tenant.suiteId} • Office {tenant.officeId} Role: {tenant.role}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  businessName: {
    color: Colors.text.primary,
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.title.fontWeight,
  },
  details: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    marginLeft: Spacing.lg + Spacing.xs,
  },
});
