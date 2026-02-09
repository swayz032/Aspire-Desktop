import React from 'react';
import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Privacy Policy" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Aspire Privacy Policy</Text>
          <Text style={styles.meta}>Effective date: 2025-02-08</Text>
          <Text style={styles.meta}>Contact: security@aspireos.app</Text>
        </View>

        <Section title="1. What Aspire is">
          Aspire is a business operations and finance hub that lets users connect third-party services (for example, banking data through Plaid) to view balances, transactions, and related insights.
        </Section>

        <Section title="2. Data we collect">
          {`We collect:\n\n\u2022 Account information you provide (e.g., name, email).\n\u2022 Application telemetry (basic diagnostics, device/app version, error logs).\n\u2022 If you choose to connect Plaid: limited financial data you authorize (for example balances and/or transactions).`}
        </Section>

        <Section title="3. How we use Plaid data">
          {`Plaid data is used to:\n\n\u2022 Show account balances and transactions inside Aspire.\n\u2022 Power cash position and basic financial reporting features.\n\u2022 Improve reliability (e.g., reconcile sync status).\n\nWe do not sell your banking data.`}
        </Section>

        <Section title="4. Consent and controls">
          You control what you connect. You can disconnect Plaid at any time inside Aspire. When disconnected, Aspire will stop new data pulls and will follow the retention/deletion settings described below.
        </Section>

        <Section title="5. Data retention and deletion">
          We minimize data and retain it only as long as necessary for providing the service and meeting legal/accounting obligations. You can request deletion by contacting security@aspireos.app. See the Data Retention page in More → Policies.
        </Section>

        <Section title="6. Security">
          We use encryption in transit (TLS) and apply access controls to production systems. Sensitive secrets (API keys, access tokens) are stored in server-side secret managers and are never committed to source control.
        </Section>

        <Section title="7. Changes">
          We may update this policy. Material changes will be communicated in-app and on our website.
        </Section>
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
  header: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  pageTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  meta: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  section: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sectionTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
});
