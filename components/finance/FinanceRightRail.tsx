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

/** Card padding uses 18 for a slightly more spacious desktop right-rail feel. */
const CARD_PADDING = 18;

/** Status dot diameter — 10px for comfortable visibility at a glance. */
const DOT_SIZE = 10;

/** Empty-state icon size — 28px balances presence without dominating. */
const EMPTY_ICON_SIZE = 28;

export function FinanceRightRail({ approvals = [], alerts = [], providers = [] }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* -- Approvals Card -- */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            Approvals
          </Text>
          {approvals.length > 0 && (
            <View style={styles.countBadge} accessibilityElementsHidden>
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
                  <View
                    style={[styles.dot, { backgroundColor: item.dotColor }]}
                    accessibilityElementsHidden
                  />
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
              accessibilityRole="link"
              accessibilityLabel="View all approvals in Inbox"
            >
              <Text style={styles.linkText}>View all in Inbox</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={EMPTY_ICON_SIZE}
              color={Colors.accent.cyan}
              style={styles.emptyStateIcon}
              accessibilityElementsHidden
            />
            <Text style={styles.emptyHeadline}>Your approval queue is clear</Text>
            <Text style={styles.emptyBody}>
              When agents need your sign-off on invoices, payments, or contracts — they'll appear here.
            </Text>
          </View>
        )}
      </View>

      {/* -- Alerts Card -- */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            Alerts
          </Text>
          {alerts.length > 0 && (
            <View style={styles.countBadgeAmber} accessibilityElementsHidden>
              <Text style={styles.countBadgeText}>{alerts.length}</Text>
            </View>
          )}
        </View>
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <View key={alert.title} style={styles.alertItem}>
              <View
                style={[styles.dot, { backgroundColor: alert.dotColor }]}
                accessibilityElementsHidden
              />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={EMPTY_ICON_SIZE}
              color={Colors.accent.cyan}
              style={styles.emptyStateIcon}
              accessibilityElementsHidden
            />
            <Text style={styles.emptyHeadline}>All clear — no financial alerts</Text>
            <Text style={styles.emptyBody}>
              Low cash warnings, overdue invoices, and sync issues will appear here.
            </Text>
          </View>
        )}
      </View>

      {/* -- Data Health Card -- */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            Data Health
          </Text>
        </View>
        {providers.length > 0 ? (
          <>
            {providers.map((provider) => (
              <Pressable
                key={provider.name}
                style={({ hovered }: any) => [
                  styles.providerRow,
                  hovered && styles.providerRowHover,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${provider.name}, ${provider.status}`}
              >
                <View
                  style={[styles.dot, { backgroundColor: provider.dotColor }]}
                  accessibilityElementsHidden
                />
                <View style={styles.providerContent}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerStatus}>{provider.status}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              style={({ hovered }: any) => [
                styles.linkButton,
                hovered && styles.linkButtonHover,
              ]}
              onPress={() => router.push('/more/integrations' as any)}
              accessibilityRole="link"
              accessibilityLabel="Manage provider connections"
            >
              <Text style={styles.linkText}>Manage connections</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="link-outline"
              size={EMPTY_ICON_SIZE}
              color={Colors.accent.cyan}
              style={styles.emptyStateIcon}
              accessibilityElementsHidden
            />
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
              accessibilityRole="link"
              accessibilityLabel="Connect accounts"
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
  container: {
    gap: Spacing.xxl, // 24 — matches the previous marginBottom cadence
  },
  sectionCard: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Colors.desktop.cardRadius, // 14 — aligns with desktop token
    padding: CARD_PADDING,
    gap: Spacing.xs, // 4 — subtle breathing room between header and content
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }
      : {}
    ),
  } as any,
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm, // 8
    marginBottom: Spacing.sm, // 8 — replaces old 12, combined with sectionCard gap:4 = 12 total visual separation
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, // 8
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeAmber: {
    backgroundColor: Colors.accent.amber,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm, // 8
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    color: Colors.text.primary,
    fontSize: Typography.small.fontSize, // 12
    fontWeight: '700',
  },

  /* -- Approval Items -- */
  approvalItem: {
    paddingVertical: Spacing.md, // 12 — bumped from 10 for more comfortable touch targets
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
    ...Typography.captionMedium, // 14 / 500
  },
  approvalAmount: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600', // bolder for scannability of monetary values
    marginTop: 2,
  },
  approvalLevel: {
    color: Colors.text.tertiary,
    ...Typography.small, // 12 / 400
    marginTop: 2,
  },

  /* -- Status Dot -- */
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  /* -- Link Buttons -- */
  linkButton: {
    marginTop: Spacing.md, // 12
    alignItems: 'center',
    paddingVertical: Spacing.sm, // 8 — increased from 6 for better tap target
    minHeight: 44, // a11y minimum
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer', transition: 'opacity 0.15s ease' }
      : {}
    ),
  } as any,
  linkButtonHover: {
    opacity: 0.75,
  },
  linkText: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '500',
  },

  /* -- Empty State -- */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg, // 16 — tightened from 20 to reduce dead space
    paddingHorizontal: Spacing.md, // 12
    minHeight: 100, // reduced from 120 — less dead space while still giving presence
  },
  emptyStateIcon: {
    marginBottom: Spacing.sm, // 8
  },
  emptyHeadline: {
    color: Colors.text.primary,
    ...Typography.captionMedium, // 14 / 500
    fontWeight: '600', // override to 600 for headline emphasis
    textAlign: 'center',
    marginBottom: Spacing.sm, // 8 — slightly more breathing room than previous 6
  },
  emptyBody: {
    color: Colors.text.tertiary,
    ...Typography.small, // 12 / 400
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyCta: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '600',
  },

  /* -- Alert Items -- */
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md, // 12 — slightly wider than previous 10 for dot breathing room
    paddingVertical: Spacing.sm, // 8
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: Colors.text.primary,
    ...Typography.captionMedium, // 14 / 500
  },
  alertDescription: {
    color: Colors.text.tertiary,
    ...Typography.small, // 12 / 400
    marginTop: 2,
  },

  /* -- Provider Rows -- */
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md, // 12 — slightly wider than previous 10
    paddingVertical: Spacing.sm, // 8
    paddingHorizontal: Spacing.xs, // 4 — allows hover highlight to extend slightly
    borderRadius: BorderRadius.sm, // 6 — subtle rounding for hover state
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer', transition: 'background-color 0.15s ease' }
      : {}
    ),
  } as any,
  providerRowHover: {
    backgroundColor: Colors.surface.cardHover, // #242426 — existing token
  },
  providerContent: {
    flex: 1,
  },
  providerName: {
    color: Colors.text.primary,
    ...Typography.captionMedium, // 14 / 500
  },
  providerStatus: {
    color: Colors.text.tertiary,
    ...Typography.small, // 12 / 400
    marginTop: 2,
  },
});
