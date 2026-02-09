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

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Terms of Service" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Terms of Service</Text>
          <Text style={styles.meta}>
            Aspire is a business operations platform. You are responsible for authorizing connections to third-party services (e.g., Plaid, QuickBooks). Aspire is not a bank.
          </Text>
        </View>

        <Section title="1. Account Security">
          You agree to use strong authentication (including MFA where available) and keep your credentials secure.
        </Section>

        <Section title="2. Data Access">
          When you connect a provider, you authorize Aspire to access the specific data scopes you approve in that provider's consent flow.
        </Section>

        <Section title="3. Acceptable Use">
          No fraud, abuse, scraping, credential stuffing, or unlawful activity.
        </Section>

        <Section title="4. Availability">
          Service is provided on an "as-is" basis; planned maintenance may occur.
        </Section>

        <Section title="5. Termination">
          You can stop using Aspire at any time. Aspire may suspend access for security, fraud, or policy violations.
        </Section>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.sectionBody}>Support: support@aspireos.app</Text>
          <Text style={styles.sectionBody}>Security: security@aspireos.app</Text>
        </View>

        <Text style={styles.disclaimer}>
          This in-app copy is a lightweight placeholder. Replace with attorney-reviewed terms before launch.
        </Text>
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
    marginBottom: Spacing.sm,
  },
  meta: {
    ...Typography.body,
    color: Colors.text.muted,
    lineHeight: 22,
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
  disclaimer: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
    paddingHorizontal: Spacing.xs,
  },
});
