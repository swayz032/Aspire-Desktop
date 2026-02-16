import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Card } from './ui/Card';
import { CashPosition } from '@/types';

interface CashPositionCardProps {
  data: CashPosition;
  onPress?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CashPositionCard({ data, onPress }: CashPositionCardProps) {
  const netChange = data.expectedInflows7d - data.upcomingOutflows7d;
  const isPositive = netChange >= 0;

  return (
    <Card variant="elevated" onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="wallet-outline" size={20} color={Colors.accent.cyan} />
        </View>
        <Text style={styles.headerTitle}>Cash Position</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </View>

      <View style={styles.mainAmount}>
        <Text style={styles.amount}>{formatCurrency(data.availableCash)}</Text>
        <Text style={styles.amountLabel}>Available</Text>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.breakdownItem}>
          <View style={styles.breakdownRow}>
            <Ionicons name="arrow-down" size={14} color={Colors.semantic.success} />
            <Text style={styles.breakdownValue}>+{formatCurrency(data.expectedInflows7d)}</Text>
          </View>
          <Text style={styles.breakdownLabel}>Expected (7d)</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.breakdownItem}>
          <View style={styles.breakdownRow}>
            <Ionicons name="arrow-up" size={14} color={Colors.semantic.error} />
            <Text style={styles.breakdownValue}>-{formatCurrency(data.upcomingOutflows7d)}</Text>
          </View>
          <Text style={styles.breakdownLabel}>Outflows (7d)</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.netBadge, isPositive ? styles.netPositive : styles.netNegative]}>
          <Text style={[styles.netText, isPositive ? styles.netTextPositive : styles.netTextNegative]}>
            Net: {isPositive ? '+' : ''}{formatCurrency(netChange)}
          </Text>
        </View>
        <Text style={styles.accountsText}>
          {data.accountsConnected} account{data.accountsConnected !== 1 ? 's' : ''} connected
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: Typography.captionMedium.fontWeight,
  },
  mainAmount: {
    marginBottom: Spacing.lg,
  },
  amount: {
    color: Colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  amountLabel: {
    color: Colors.text.tertiary,
    fontSize: Typography.small.fontSize,
    marginTop: Spacing.xs,
  },
  breakdown: {
    flexDirection: 'row',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  breakdownValue: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
  },
  breakdownLabel: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    marginTop: Spacing.xs,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  netPositive: {
    backgroundColor: Colors.semantic.successLight,
  },
  netNegative: {
    backgroundColor: Colors.semantic.errorLight,
  },
  netText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  netTextPositive: {
    color: Colors.semantic.success,
  },
  netTextNegative: {
    color: Colors.semantic.error,
  },
  accountsText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
});
