import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface TimelineRowProps {
  event: {
    eventId: string;
    provider: string;
    eventType: string;
    occurredAt: string;
    amount: number | null;
    currency: string;
    status: string;
    entityRefs: any;
    metadata?: any;
    receiptId?: string;
  };
  onPress?: () => void;
  expanded?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  plaid: '#00C9A7',
  stripe: '#635BFF',
  qbo: '#2CA01C',
  gusto: '#F45D48',
};

const PROVIDER_LABELS: Record<string, string> = {
  plaid: 'Plaid',
  stripe: 'Stripe',
  qbo: 'QuickBooks',
  gusto: 'Gusto',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  bank_tx_posted: 'Bank Transaction Posted',
  bank_tx_pending: 'Bank Transaction Pending',
  invoice_paid: 'Invoice Paid',
  invoice_created: 'Invoice Created',
  invoice_sent: 'Invoice Sent',
  invoice_overdue: 'Invoice Overdue',
  payout_created: 'Payout Created',
  payout_paid: 'Payout Paid',
  payout_failed: 'Payout Failed',
  payment_received: 'Payment Received',
  payment_sent: 'Payment Sent',
  refund_issued: 'Refund Issued',
  charge_created: 'Charge Created',
  subscription_renewed: 'Subscription Renewed',
  expense_recorded: 'Expense Recorded',
  payroll_processed: 'Payroll Processed',
  tax_payment: 'Tax Payment',
  transfer_completed: 'Transfer Completed',
  reconciliation_adjustment: 'Reconciliation Adjustment',
};

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.semantic.warning,
  posted: Colors.semantic.success,
  failed: Colors.semantic.error,
  reversed: Colors.text.muted,
  completed: Colors.semantic.success,
  cancelled: Colors.text.muted,
};

const INFLOW_TYPES = new Set([
  'invoice_paid', 'payment_received', 'charge_created',
  'subscription_renewed', 'bank_tx_posted', 'bank_tx_pending',
]);

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAmount(amount: number | null, eventType: string): { text: string; color: string } {
  if (amount === null) return { text: '—', color: Colors.text.muted };
  const isInflow = INFLOW_TYPES.has(eventType) || amount > 0;
  const absVal = Math.abs(amount);
  const formatted = absVal >= 1000
    ? `$${(absVal / 1000).toFixed(absVal % 1000 === 0 ? 0 : 1)}K`
    : `$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return {
    text: isInflow ? `+${formatted}` : `-${formatted}`,
    color: isInflow ? Colors.semantic.success : Colors.semantic.error,
  };
}

function getEventLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] || eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TimelineRow({ event, onPress, expanded = false }: TimelineRowProps) {
  const providerColor = PROVIDER_COLORS[event.provider] || Colors.text.muted;
  const providerLabel = PROVIDER_LABELS[event.provider] || event.provider;
  const statusColor = STATUS_COLORS[event.status] || Colors.text.muted;
  const { text: amountText, color: amountColor } = formatAmount(event.amount, event.eventType);
  const label = getEventLabel(event.eventType);
  const relTime = getRelativeTime(event.occurredAt);

  const webHoverStyle = Platform.OS === 'web' ? { cursor: 'pointer' as any } : {};

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        style={({ hovered }: any) => [
          styles.row,
          Platform.OS === 'web' && hovered && styles.rowHovered,
          webHoverStyle,
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: providerColor + '1A' }]}>
          <Ionicons
            name={event.amount !== null && event.amount >= 0 ? 'arrow-down' : 'arrow-up'}
            size={14}
            color={providerColor}
          />
        </View>

        <View style={styles.center}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {providerLabel} · {relTime}
          </Text>
        </View>

        <View style={styles.rightSection}>
          <Text style={[styles.amount, { color: amountColor }]}>{amountText}</Text>
          <View style={[styles.statusChip, { backgroundColor: statusColor + '26' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Text>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expandedSection}>
          {event.eventId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Event ID</Text>
              <Text style={styles.detailValue}>{event.eventId}</Text>
            </View>
          )}
          {event.receiptId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Receipt ID</Text>
              <Text style={styles.detailValue}>{event.receiptId}</Text>
            </View>
          )}
          {event.entityRefs && typeof event.entityRefs === 'object' && (
            Object.entries(event.entityRefs).map(([key, val]) => (
              <View style={styles.detailRow} key={key}>
                <Text style={styles.detailLabel}>{key}</Text>
                <Text style={styles.detailValue}>{String(val)}</Text>
              </View>
            ))
          )}
          {event.metadata && typeof event.metadata === 'object' && (
            Object.entries(event.metadata).slice(0, 5).map(([key, val]) => (
              <View style={styles.detailRow} key={key}>
                <Text style={styles.detailLabel}>{key}</Text>
                <Text style={styles.detailValue}>{String(val)}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
  },
  rowHovered: {
    backgroundColor: Colors.surface.cardHover,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    ...Typography.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.micro,
  },
  expandedSection: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  detailValue: {
    ...Typography.caption,
    color: Colors.text.secondary,
    maxWidth: '60%' as any,
    textAlign: 'right',
  },
});
