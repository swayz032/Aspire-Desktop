/**
 * Billing & Plans section.
 * Displays current subscription, usage metrics, and payment info.
 * TODO: Wire to Stripe customer portal when billing API is available.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

const PLAN_FEATURES = [
  { icon: 'people-outline' as const, label: 'Unlimited team members' },
  { icon: 'document-text-outline' as const, label: 'Contract generation & signing' },
  { icon: 'call-outline' as const, label: 'AI Front Desk (Sarah)' },
  { icon: 'analytics-outline' as const, label: 'Financial intelligence (Finn)' },
  { icon: 'shield-checkmark-outline' as const, label: 'Full governance & receipts' },
  { icon: 'cloud-outline' as const, label: 'Unlimited document storage' },
];

export default function BillingSection() {
  // TODO: Fetch from Stripe subscription API
  const plan = 'Professional';
  const billingCycle = 'Monthly';
  const nextBillingDate = 'Mar 15, 2026';
  const monthlyPrice = '$79';

  return (
    <View>
      <SectionHeader
        title="Billing & Plans"
        subtitle="Manage your subscription and payment methods"
        icon="card-outline"
        badge="Pro"
        badgeColor={SettingsColors.accent}
      />

      {/* Current Plan Card */}
      <View style={styles.planCard}>
        <View style={styles.planBadgeRow}>
          <View style={styles.planBadge}>
            <Ionicons name="diamond-outline" size={14} color={SettingsColors.accent} />
            <Text style={styles.planBadgeText}>CURRENT PLAN</Text>
          </View>
        </View>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planName}>{plan}</Text>
            <Text style={styles.planCycle}>{billingCycle} billing</Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.priceAmount}>{monthlyPrice}</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
        </View>

        <View style={styles.planDivider} />

        <View style={styles.featuresGrid}>
          {PLAN_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={f.icon} size={15} color="#34c759" />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planDivider} />

        <View style={styles.nextBillingRow}>
          <Ionicons name="calendar-outline" size={14} color="#6e6e73" />
          <Text style={styles.nextBillingText}>Next billing: {nextBillingDate}</Text>
        </View>
      </View>

      <Divider />

      {/* Payment Method */}
      <Text style={styles.groupTitle}>Payment Method</Text>
      <View style={styles.paymentCard}>
        <View style={styles.cardIconWrapper}>
          <Ionicons name="card" size={20} color={SettingsColors.accent} />
        </View>
        <View style={styles.cardInfo}>
          {/* TODO: Fetch from Stripe payment methods API */}
          <Text style={styles.cardBrand}>Visa ending in 4242</Text>
          <Text style={styles.cardExpiry}>Expires 12/2028</Text>
        </View>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.updateBtn,
            hovered && styles.updateBtnHover,
          ] as ViewStyle[]}
        >
          <Text style={styles.updateBtnText}>Update</Text>
        </Pressable>
      </View>

      <Divider />

      {/* Usage */}
      <Text style={styles.groupTitle}>Usage This Period</Text>
      <View style={styles.usageGrid}>
        {[
          { label: 'AI Conversations', value: '142', max: 'Unlimited', icon: 'chatbubbles-outline' as const },
          { label: 'Documents Created', value: '23', max: 'Unlimited', icon: 'document-outline' as const },
          { label: 'Calls Handled', value: '87', max: 'Unlimited', icon: 'call-outline' as const },
          { label: 'Storage Used', value: '2.4 GB', max: '50 GB', icon: 'cloud-outline' as const },
        ].map((item, i) => (
          <View key={i} style={styles.usageCard}>
            <Ionicons name={item.icon} size={18} color="#6e6e73" />
            <Text style={styles.usageValue}>{item.value}</Text>
            <Text style={styles.usageLabel}>{item.label}</Text>
            <Text style={styles.usageMax}>{item.max}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.portalBtn,
            hovered && styles.portalBtnHover,
          ] as ViewStyle[]}
        >
          <Ionicons name="open-outline" size={14} color={SettingsColors.accent} />
          <Text style={styles.portalBtnText}>Open Billing Portal</Text>
        </Pressable>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.invoiceBtn,
            hovered && styles.invoiceBtnHover,
          ] as ViewStyle[]}
        >
          <Ionicons name="receipt-outline" size={14} color="#a1a1a6" />
          <Text style={styles.invoiceBtnText}>View Invoices</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: '#111113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    padding: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 40px rgba(59,130,246,0.04)' } : {}),
  } as ViewStyle,
  planBadgeRow: {
    marginBottom: 16,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: SettingsColors.accent,
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  planName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f2f2f2',
    letterSpacing: -0.5,
  },
  planCycle: {
    fontSize: 13,
    color: '#6e6e73',
    marginTop: 2,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f2f2f2',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    color: '#6e6e73',
    marginLeft: 2,
  },
  planDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 20,
  },
  featuresGrid: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#d1d1d6',
  },
  nextBillingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextBillingText: {
    fontSize: 13,
    color: '#6e6e73',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 14,
  },
  cardIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SettingsColors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  cardExpiry: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  updateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
    backgroundColor: SettingsColors.accentBg,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  updateBtnHover: {
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  updateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: SettingsColors.accent,
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  usageCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    backgroundColor: '#111113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  usageValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f2f2f2',
    letterSpacing: -0.5,
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a1a1a6',
  },
  usageMax: {
    fontSize: 11,
    color: '#48484a',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  portalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  portalBtnHover: {
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  portalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: SettingsColors.accent,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  invoiceBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  invoiceBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1a6',
  },
});
