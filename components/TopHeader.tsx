import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { StatusDot } from './ui/Badge';
import { useTenant } from '@/providers';

interface TopHeaderProps {
  pageTitle?: string;
  showStatus?: boolean;
}

export function TopHeader({ pageTitle, showStatus = true }: TopHeaderProps) {
  const { tenant } = useTenant();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.identityBar}>
          <View style={styles.titleRow}>
            {showStatus && <StatusDot status="active" />}
            <Text style={styles.businessName}>{tenant?.businessName || 'Your Business'}</Text>
          </View>
          <Text style={styles.details}>
            {tenant?.suiteId ? `Suite ${tenant.suiteId}` : ''} {tenant?.officeId ? `• Office ${tenant.officeId}` : ''} {tenant?.role ? `Role: ${tenant.role}` : 'Role: Founder'}
          </Text>
        </View>
        {pageTitle && (
          <Text style={styles.pageTitle}>{pageTitle}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.background.primary,
  },
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background.primary,
  },
  identityBar: {
    marginBottom: Spacing.sm,
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
  pageTitle: {
    color: Colors.text.primary,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    marginTop: Spacing.lg,
  },
});
