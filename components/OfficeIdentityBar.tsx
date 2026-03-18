import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { StatusDot } from './ui/Badge';
import { Tenant } from '@/types';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface OfficeIdentityBarProps {
  tenant: Tenant;
  showStatus?: boolean;
}

function OfficeIdentityBarInner({ tenant, showStatus = true }: OfficeIdentityBarProps) {
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

export function OfficeIdentityBar(props: any) {
  return (
    <PageErrorBoundary pageName="office-identity-bar">
      <OfficeIdentityBarInner {...props} />
    </PageErrorBoundary>
  );
}
