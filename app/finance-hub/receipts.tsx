import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';

const filters = ['All', 'Payments', 'Proposals', 'Approvals', 'Transfers'];

type ReceiptItem = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  accentColor: string;
  title: string;
  description: string;
  amount: string;
  time: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  category: string;
};

const receipts: ReceiptItem[] = [
  { icon: 'checkmark-circle', iconColor: Colors.semantic.success, accentColor: Colors.semantic.success, title: 'Payment processed', description: 'Apex Corp — Invoice #1847', amount: '+$4,200', time: '2h ago', badge: 'Success', badgeColor: Colors.semantic.success, badgeBg: Colors.semantic.successLight, category: 'Payments' },
  { icon: 'shield-checkmark', iconColor: Colors.accent.cyan, accentColor: Colors.accent.cyan, title: 'Proposal approved', description: 'Fund payroll buffer', amount: '$12,400', time: 'Yesterday', badge: 'Approved', badgeColor: Colors.accent.cyan, badgeBg: Colors.accent.cyanLight, category: 'Proposals' },
  { icon: 'checkmark-circle', iconColor: Colors.semantic.success, accentColor: Colors.semantic.success, title: 'Transfer completed', description: 'Checking → Emergency Fund', amount: '$3,000', time: 'Yesterday', badge: 'Success', badgeColor: Colors.semantic.success, badgeBg: Colors.semantic.successLight, category: 'Transfers' },
  { icon: 'close-circle', iconColor: Colors.semantic.error, accentColor: Colors.semantic.error, title: 'Payment declined', description: 'Vendor — Delta Partners', amount: '$3,200', time: 'Yesterday', badge: 'Failed', badgeColor: Colors.semantic.error, badgeBg: Colors.semantic.errorLight, category: 'Payments' },
  { icon: 'alert-circle', iconColor: Colors.accent.amber, accentColor: Colors.accent.amber, title: 'Proposal pending', description: 'Increase tax reserve', amount: '$2,500', time: '2 days ago', badge: 'Pending', badgeColor: Colors.accent.amber, badgeBg: Colors.accent.amberLight, category: 'Proposals' },
  { icon: 'checkmark-circle', iconColor: Colors.semantic.success, accentColor: Colors.semantic.success, title: 'Payroll processed', description: 'Jan 31 payroll run', amount: '$12,200', time: '3 days ago', badge: 'Success', badgeColor: Colors.semantic.success, badgeBg: Colors.semantic.successLight, category: 'Payments' },
  { icon: 'shield-checkmark', iconColor: Colors.accent.cyan, accentColor: Colors.accent.cyan, title: 'Approval granted', description: 'Vendor payment — Apex', amount: '$1,850', time: '3 days ago', badge: 'Approved', badgeColor: Colors.accent.cyan, badgeBg: Colors.accent.cyanLight, category: 'Approvals' },
  { icon: 'checkmark-circle', iconColor: Colors.semantic.success, accentColor: Colors.semantic.success, title: 'Payment processed', description: 'BlueSky Partners', amount: '+$2,100', time: '4 days ago', badge: 'Success', badgeColor: Colors.semantic.success, badgeBg: Colors.semantic.successLight, category: 'Payments' },
  { icon: 'checkmark-circle', iconColor: Colors.semantic.success, accentColor: Colors.semantic.success, title: 'Transfer completed', description: 'Savings → Checking', amount: '$5,000', time: '5 days ago', badge: 'Success', badgeColor: Colors.semantic.success, badgeBg: Colors.semantic.successLight, category: 'Transfers' },
  { icon: 'alert-circle', iconColor: Colors.accent.amber, accentColor: Colors.accent.amber, title: 'Proposal created', description: 'Collect overdue AR', amount: '$6,800', time: '5 days ago', badge: 'Pending', badgeColor: Colors.accent.amber, badgeBg: Colors.accent.amberLight, category: 'Proposals' },
];

const stats = [
  { label: '42 total receipts', color: Colors.text.secondary },
  { label: '38 successful', color: Colors.semantic.success },
  { label: '2 pending', color: Colors.accent.amber },
  { label: '2 failed', color: Colors.semantic.error },
];

const premiumCardStyle = {
  backgroundColor: CARD_BG,
  borderColor: CARD_BORDER,
};

export default function ReceiptsScreen() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = activeFilter === 'All' ? receipts : receipts.filter((r) => r.category === activeFilter);

  return (
    <FinanceHubShell>
      <View style={styles.headerRow}>
        <View>
          <Text style={[Typography.display, { color: Colors.text.primary, marginBottom: 4 }]}>Finance Receipts</Text>
          <Text style={[Typography.body, { color: Colors.text.tertiary }]}>Audit trail for all financial actions</Text>
        </View>
        <Pressable
          style={({ hovered }: any) => [
            styles.filterDropdown,
            { backgroundColor: CARD_BG, borderColor: CARD_BORDER },
            hovered && { borderColor: Colors.border.strong },
          ]}
        >
          <Ionicons name="filter" size={16} color={Colors.text.tertiary} />
          <Text style={styles.filterDropdownText}>Filter</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.text.muted} />
        </Pressable>
      </View>

      <View style={styles.filtersRow}>
        {filters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setActiveFilter(f)}
            style={({ hovered }: any) => [
              styles.filterPill,
              activeFilter === f && styles.filterPillActive,
              hovered && activeFilter !== f && styles.filterPillHover,
            ]}
          >
            <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.receiptsList}>
        {filtered.map((r, i) => (
          <Pressable
            key={`${r.title}-${i}`}
            style={({ hovered }: any) => [
              styles.receiptCard,
              premiumCardStyle as any,
              hovered && styles.receiptCardHover,
            ]}
          >
            {Platform.OS === 'web' && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', backgroundImage: svgPatterns.invoice(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '15% auto', opacity: 0.5 } as any} />
            )}
            <View style={[styles.accentBorder, { backgroundColor: r.accentColor }]} />
            <View style={[styles.receiptIcon, { backgroundColor: `${r.accentColor}15` }]}>
              <Ionicons name={r.icon} size={22} color={r.iconColor} />
            </View>
            <View style={styles.receiptContent}>
              <Text style={styles.receiptTitle}>{r.title}</Text>
              <Text style={styles.receiptDesc}>{r.description}</Text>
            </View>
            <Text style={styles.receiptAmount}>{r.amount}</Text>
            <Text style={styles.receiptTime}>{r.time}</Text>
            <View style={[styles.badge, { backgroundColor: r.badgeBg }, Platform.OS === 'web' && { boxShadow: `0 0 8px ${r.badgeColor}30` } as any]}>
              <Text style={[styles.badgeText, { color: r.badgeColor }]}>{r.badge}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={[styles.statsBar, premiumCardStyle as any]}>
        {Platform.OS === 'web' && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none', backgroundImage: svgPatterns.barChart(), backgroundRepeat: 'no-repeat', backgroundPosition: 'center center', backgroundSize: '60% auto', opacity: 0.4 } as any} />
        )}
        {stats.map((s, i) => (
          <View key={s.label} style={styles.statItem}>
            {i > 0 && <View style={styles.statDivider} />}
            <View style={[styles.statDot, { backgroundColor: s.color }]} />
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } : {}),
  },
  filterDropdownText: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}),
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  filterPillHover: {
    backgroundColor: '#1a1f2e',
  },
  filterPillText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  receiptsList: {
    gap: 8,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } as any : {}),
  },
  receiptCardHover: {
    backgroundColor: '#1a1f2e',
  },
  accentBorder: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginLeft: -16,
    marginRight: 4,
  },
  receiptIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptContent: {
    flex: 1,
  },
  receiptTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptDesc: {
    color: Colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
  receiptAmount: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  receiptTime: {
    color: Colors.text.muted,
    fontSize: 12,
    minWidth: 70,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 70,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginTop: 20,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeOrbStats: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: CARD_BORDER,
    marginRight: 8,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
