import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

const approvals = [
  { title: 'Fund payroll buffer', amount: '$12,400', level: 'Owner approval', dotColor: Colors.accent.amber },
  { title: 'Vendor payment — Delta', amount: '$3,200', level: 'Admin approval', dotColor: Colors.accent.cyan },
];

const alerts = [
  { title: 'Low cash buffer', description: 'Buffer drops below $5K after payroll', dotColor: Colors.semantic.error },
  { title: 'Overdue AR', description: '2 invoices past 30 days ($6,800)', dotColor: Colors.accent.amber },
  { title: 'QBO sync needed', description: 'Last sync: 4 hours ago', dotColor: Colors.accent.cyan },
];

const providers = [
  { name: 'Plaid', status: 'Connected · Synced 12m ago', dotColor: Colors.semantic.success },
  { name: 'QuickBooks', status: 'Connected · Synced 4h ago', dotColor: Colors.semantic.success },
  { name: 'Gusto', status: 'Needs attention · Reconnect', dotColor: Colors.accent.amber },
];

const promptChips = ['Runway', 'Payroll check', 'What changed?'];

type Props = {
  onOpenFinnDesk?: () => void;
};

export function FinanceRightRail({ onOpenFinnDesk }: Props = {}) {
  const router = useRouter();

  return (
    <View>
      <View style={styles.sectionCard}>
        <View style={styles.finnHeader}>
          <Ionicons name="sparkles" size={20} color={Colors.accent.cyan} />
          <Text style={styles.finnTitle}>Finn</Text>
        </View>
        <Pressable
          style={({ hovered }: any) => [
            styles.finnButton,
            hovered && styles.finnButtonHover,
          ]}
          onPress={onOpenFinnDesk}
        >
          <Text style={styles.finnButtonText}>Open Finn Desk</Text>
        </Pressable>
        <View style={styles.chipsRow}>
          {promptChips.map((chip) => (
            <Pressable
              key={chip}
              style={({ hovered }: any) => [
                styles.chip,
                hovered && styles.chipHover,
              ]}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Approvals</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{approvals.length}</Text>
          </View>
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
          <Text style={styles.emptyState}>No approvals pending</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          <View style={styles.countBadgeAmber}>
            <Text style={styles.countBadgeText}>{alerts.length}</Text>
          </View>
        </View>
        {alerts.map((alert) => (
          <View key={alert.title} style={styles.alertItem}>
            <View style={[styles.dot, { backgroundColor: alert.dotColor }]} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDescription}>{alert.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Data Health</Text>
        </View>
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
  finnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  finnTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  finnButton: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } : {}),
  },
  finnButtonHover: {
    opacity: 0.85,
  },
  finnButtonText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.surface.cardHover,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } : {}),
  },
  chipHover: {
    backgroundColor: Colors.border.default,
  },
  chipText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
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
  emptyState: {
    color: Colors.text.tertiary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
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
