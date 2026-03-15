import React from 'react';
import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof children === 'string' ? (
        <Text style={styles.sectionBody}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function ProviderBlock({ name, items }: { name: string; items: string[] }) {
  return (
    <View style={styles.providerBlock}>
      <Text style={styles.providerName}>{name}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>{'\u2022'}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>{'\u2022'}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function DataRetentionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Data Retention & Deletion" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerMeta}>
          <Text style={styles.effectiveDate}>Effective Date: February 9, 2026</Text>
          <Text style={styles.contactLine}>Contact: security@aspireos.app</Text>
        </View>

        <Section title="1. Retention Principles">
          <Text style={styles.sectionBody}>
            We retain data only as long as necessary for service delivery, legal obligations, and legitimate business purposes. We minimize data collection and prefer derived summaries over raw data where possible.
          </Text>
        </Section>

        <Section title="2. Per-Provider Retention Schedules">
          <ProviderBlock
            name="Plaid"
            items={[
              'Access tokens stored server-side, refreshed as needed.',
              'Transaction/balance data retained while connection is active.',
              'Cached data purged within 30 days of disconnection.',
              'Raw credentials never stored (tokenized by Plaid).',
            ]}
          />
          <ProviderBlock
            name="Stripe"
            items={[
              'Payment records retained for 7 years per financial regulation requirements.',
              'Tokenized card data managed by Stripe (PCI DSS compliant).',
              'Transaction history retained for dispute resolution and accounting.',
            ]}
          />
          <ProviderBlock
            name="QuickBooks"
            items={[
              'Accounting records synchronized while connected.',
              'Invoice and expense data retained for 7 years per tax/accounting compliance (IRS requirements).',
              'Disconnection stops new syncs; existing records retained per legal obligation.',
            ]}
          />
          <ProviderBlock
            name="Gusto"
            items={[
              'Payroll records retained for minimum 4 years per IRS requirements, up to 7 years for full tax compliance.',
              'Employee data retained while employment relationship active.',
              'Tax filings retained indefinitely per federal/state requirements.',
            ]}
          />
        </Section>

        <Section title="3. Account Data">
          <BulletList items={[
            'Account info (name, email, business) retained while account active.',
            'Application telemetry retained for 90 days.',
            'Session data and temporary tokens expire automatically.',
          ]} />
        </Section>

        <Section title="4. Deletion Requests">
          <Text style={styles.sectionBody}>
            You can request deletion by contacting security@aspireos.app.
          </Text>
          <Text style={[styles.sectionBody, { marginTop: Spacing.sm }]}>Upon request:</Text>
          <BulletList items={[
            'Account data deleted within 30 days.',
            'Third-party connections revoked immediately.',
            'Provider-specific data subject to their retention policies.',
            'Data required by law (tax, accounting records) retained until legal obligation expires.',
          ]} />
          <Text style={[styles.sectionBody, { marginTop: Spacing.sm }]}>
            Automated self-service deletion coming soon.
          </Text>
        </Section>

        <Section title="5. Disconnecting Providers">
          <BulletList items={[
            'You can disconnect any provider at any time in Finance Hub.',
            'Disconnection immediately stops new data pulls.',
            'Cached/synced data handled per retention schedules above.',
            'For Plaid, you can also revoke access via Plaid Portal (my.plaid.com).',
          ]} />
        </Section>

        <Section title="6. Legal Hold Exceptions">
          <Text style={styles.sectionBody}>
            Data may be retained beyond normal schedules if subject to legal hold, regulatory investigation, pending litigation, or audit requirements.
          </Text>
        </Section>

        <Section title="7. Policy Review">
          <Text style={styles.sectionBody}>
            This policy is reviewed quarterly and updated when product scope or regulatory requirements change. Material changes communicated in-app.
          </Text>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Questions about data retention? Contact security@aspireos.app
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
  headerMeta: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  effectiveDate: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  contactLine: {
    ...Typography.caption,
    color: Colors.text.tertiary,
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
  providerBlock: {
    marginBottom: Spacing.md,
  },
  providerName: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  bullet: {
    ...Typography.body,
    color: Colors.text.tertiary,
    marginRight: Spacing.sm,
    lineHeight: 22,
  },
  bulletText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
    flex: 1,
  },
  footer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    alignItems: 'center',
  },
  footerText: {
    ...Typography.caption,
    color: Colors.text.muted,
    textAlign: 'center',
  },
});
