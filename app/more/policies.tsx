import React from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PolicyLink = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
};

const legalLinks: PolicyLink[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How we collect and use your data',
    icon: 'shield',
    route: '/more/privacy-policy',
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    subtitle: 'Rules governing use of Aspire',
    icon: 'document-text',
    route: '/more/terms',
  },
  {
    id: 'data-retention',
    title: 'Data Retention & Deletion',
    subtitle: 'How long we keep data and how to request deletion',
    icon: 'time',
    route: '/more/data-retention',
  },
];

const plaidLinks: PolicyLink[] = [
  {
    id: 'plaid-consent',
    title: 'Plaid Consent',
    subtitle: 'Authorize bank data access via Plaid',
    icon: 'card',
    route: '/more/plaid-consent',
  },
  {
    id: 'security-practices',
    title: 'Security Practices',
    subtitle: 'How Aspire handles security',
    icon: 'lock-closed',
    route: '/more/security-practices',
  },
];

function LinkCard({ item, onPress }: { item: PolicyLink; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.linkCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkIcon}>
        <Ionicons name={item.icon as any} size={22} color={Colors.accent.cyan} />
      </View>
      <View style={styles.linkInfo}>
        <Text style={styles.linkTitle}>{item.title}</Text>
        <Text style={styles.linkSubtitle}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
    </TouchableOpacity>
  );
}

export default function PoliciesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Policies & Legal" showBackButton />

      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Review our legal documents and policies governing your use of Aspire.
        </Text>

        <Text style={styles.sectionLabel}>Legal</Text>
        {legalLinks.map((item) => (
          <LinkCard key={item.id} item={item} onPress={() => router.push(item.route as any)} />
        ))}

        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Plaid & Security</Text>
        {plaidLinks.map((item) => (
          <LinkCard key={item.id} item={item} onPress={() => router.push(item.route as any)} />
        ))}

        <View style={styles.footerNote}>
          <Ionicons name="information-circle" size={16} color={Colors.text.muted} />
          <Text style={styles.footerText}>
            These pages are also published publicly on aspireos.app for compliance and transparency.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.muted,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  sectionLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  linkSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  footerText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
