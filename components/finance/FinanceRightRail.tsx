import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface ApprovalItem {
  title: string;
  amount: string;
  level: string;
  dotColor: string;
}

interface AlertItem {
  title: string;
  description: string;
  dotColor: string;
}

interface ProviderItem {
  name: string;
  status: string;
  dotColor: string;
}

interface Props {
  approvals?: ApprovalItem[];
  alerts?: AlertItem[];
  providers?: ProviderItem[];
}

export function FinanceRightRail({ approvals = [], alerts = [], providers = [] }: Props) {
  const router = useRouter();

  return (
    <View>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Approvals</Text>
          {approvals.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{approvals.length}</Text>
            </View>
          )}
        </View>
        {approvals.length > 0 ? (
          <>
            {approvals.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.approvalItem,
                  index < approvals.length - 1 && styles.approvalDivider,
                ]}
              >
                <View style={styles.approvalRow}>
                  <Text style={styles.approvalTitle}>{item.title}</Text>
                  <View style={[styles.dot, { backgroundColor: item.dotColor }]} />
                </View>
                <Text style={styles.approvalAmount}>{item.amount}</Text>
                <Text style={styles.approvalLevel}>{item.level}</Text>
              </View>
            ))}
            <Pressable
              style={({ hovered }: any) => [
                styles.linkButton,
                hovered && styles.linkButtonHover,
              ]}
              onPress={() => router.push('/inbox' as any)}
            >
              <Text style={styles.linkText}>View all in Inbox</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
            <Text style={styles.emptyHeadline}>Your approval queue is clear</Text>
            <Text style={styles.emptyBody}>
              When agents need your sign-off on invoices, payments, or contracts — they'll appear here.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {alerts.length > 0 && (
            <View style={styles.countBadgeAmber}>
              <Text style={styles.countBadgeText}>{alerts.length}</Text>
            </View>
          )}
        </View>
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <View key={alert.title} style={styles.alertItem}>
              <View style={[styles.dot, { backgroundColor: alert.dotColor }]} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
            <Text style={styles.emptyHeadline}>All clear — no financial alerts</Text>
            <Text style={styles.emptyBody}>
              Low cash warnings, overdue invoices, and sync issues will appear here.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Data Health</Text>
        </View>
        {providers.length > 0 ? (
          <>
            {providers.map((provider) => (
              <View key={provider.name} style={styles.providerRow}>
                <View style={[styles.dot, { backgroundColor: provider.dotColor }]} />
                <View style={styles.providerContent}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerStatus}>{provider.status}</Text>
                </View>
              </View>
            ))}
            <Pressable
              style={({ hovered }: any) => [
                styles.linkButton,
                hovered && styles.linkButtonHover,
              ]}
              onPress={() => router.push('/more/integrations' as any)}
            >
              <Text style={styles.linkText}>Manage connections</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="link-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
            <Text style={styles.emptyHeadline}>Connect your first service</Text>
            <Text style={styles.emptyBody}>
              Link your bank, payments, and accounting to see real-time data health.
            </Text>
            <Pressable
              style={({ hovered }: any) => [
                styles.linkButton,
                hovered && styles.linkButtonHover,
              ]}
              onPress={() => router.push('/finance-hub/connections' as any)}
            >
              <Text style={styles.emptyCta}>Connect accounts</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeAmber: {
    backgroundColor: Colors.accent.amber,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  approvalItem: {
    paddingVertical: 10,
  },
  approvalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  approvalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvalTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  approvalAmount: {
    color: Colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  approvalLevel: {
    color: Colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } : {}),
  },
  linkButtonHover: {
    opacity: 0.75,
  },
  linkText: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    minHeight: 120,
  },
  emptyStateIcon: {
    marginBottom: 8,
  },
  emptyHeadline: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyBody: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyCta: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  alertDescription: {
    color: Colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  providerContent: {
    flex: 1,
  },
  providerName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  providerStatus: {
    color: Colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
});
