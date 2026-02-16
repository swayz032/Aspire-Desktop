import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import SourceBadge from './SourceBadge';

interface ReconcileCardProps {
  mismatch: {
    id: string;
    type: 'settlement_timing' | 'payout_matching' | 'cash_vs_books' | 'missing_entry';
    title: string;
    description: string;
    reasonCode: string;
    severity: 'info' | 'warning' | 'critical';
    amounts: { expected: number; actual: number; difference: number };
    providers: string[];
    nextStep: string;
    relatedEventIds: string[];
  };
  onAction?: () => void;
  onDismiss?: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: Colors.semantic.info,
  warning: Colors.semantic.warning,
  critical: Colors.semantic.error,
};

const SEVERITY_BG: Record<string, string> = {
  info: Colors.semantic.infoLight,
  warning: Colors.semantic.warningLight,
  critical: Colors.semantic.errorLight,
};

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

function formatCurrency(amount: number | null | undefined): string {
  const abs = Math.abs(amount ?? 0);
  return `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReconcileCard({ mismatch, onAction, onDismiss }: ReconcileCardProps) {
  const severityColor = SEVERITY_COLORS[mismatch.severity];
  const severityBg = SEVERITY_BG[mismatch.severity];
  const diffColor = mismatch.amounts.difference >= 0 ? Colors.semantic.success : Colors.semantic.error;

  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.card,
        Platform.OS === 'web' && hovered && styles.cardHovered,
        Platform.OS === 'web' && ({ cursor: 'default' } as any),
      ]}
    >
      <View style={[styles.accentStripe, { backgroundColor: severityColor }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{mismatch.title}</Text>
          <View style={[styles.severityChip, { backgroundColor: severityBg }]}>
            <Text style={[styles.severityText, { color: severityColor }]}>
              {SEVERITY_LABELS[mismatch.severity]}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{mismatch.description}</Text>

        <View style={styles.amountsRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Expected</Text>
            <Text style={styles.amountValue}>{formatCurrency(mismatch.amounts.expected)}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Actual</Text>
            <Text style={styles.amountValue}>{formatCurrency(mismatch.amounts.actual)}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Difference</Text>
            <Text style={[styles.amountDiff, { color: diffColor }]}>
              {mismatch.amounts.difference >= 0 ? '+' : '-'}{formatCurrency(mismatch.amounts.difference)}
            </Text>
          </View>
        </View>

        {mismatch.providers.length > 0 && (
          <View style={styles.providersRow}>
            {mismatch.providers.map((p) => (
              <SourceBadge
                key={p}
                source={p as any}
                lastSyncAt={null}
                confidence="none"
                compact
              />
            ))}
          </View>
        )}

        <Text style={styles.reasonCode}>Reason: {mismatch.reasonCode}</Text>

        <View style={styles.nextStepRow}>
          <Ionicons name="arrow-forward-circle-outline" size={16} color={Colors.semantic.info} />
          <Text style={styles.nextStepText}>{mismatch.nextStep}</Text>
        </View>

        <View style={styles.actionsRow}>
          {onDismiss && (
            <Pressable onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          )}
          {onAction && (
            <Pressable
              onPress={onAction}
              style={({ hovered }: any) => [
                styles.actionButton,
                Platform.OS === 'web' && hovered && styles.actionButtonHovered,
              ]}
            >
              <Text style={styles.actionText}>Take Action</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardHovered: {
    backgroundColor: Colors.surface.cardHover,
  },
  accentStripe: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
    flex: 1,
  },
  severityChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  severityText: {
    ...Typography.micro,
  },
  description: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  amountsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  amountCol: {
    flex: 1,
    gap: 2,
  },
  amountLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  amountDiff: {
    ...Typography.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  providersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  reasonCode: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.semantic.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  nextStepText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  dismissButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    ...Typography.captionMedium,
    color: Colors.text.muted,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  actionButtonHovered: {
    backgroundColor: Colors.accent.cyanDark,
  },
  actionText: {
    ...Typography.captionMedium,
    color: '#ffffff',
  },
});
