import React from 'react';
import { StyleSheet, View, ScrollView, Text, Linking } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function Link({ url, label }: { url: string; label: string }) {
  return (
    <Text
      style={styles.link}
      onPress={() => Linking.openURL(`https://${url}`)}
    >
      {label}
    </Text>
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
          <Text style={styles.effectiveDate}>Effective Date: February 8, 2025</Text>
          <Text style={styles.intro}>
            These Terms govern your use of Aspire, a business operations platform. By using Aspire, you agree to these Terms.
          </Text>
        </View>

        <Section title="1. Acceptance of Terms">
          <Text style={styles.sectionBody}>
            By accessing or using Aspire, you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use the service. You must be at least 18 years of age or an authorized representative of a business entity to use Aspire.
          </Text>
        </Section>

        <Section title="2. Description of Service">
          <Text style={styles.sectionBody}>
            Aspire connects to third-party providers including Plaid, Stripe, QuickBooks, and Gusto to aggregate financial data, process payments, manage accounting, and handle payroll on your behalf.
          </Text>
          <Text style={[styles.sectionBody, styles.emphasis]}>
            Aspire is NOT a bank, financial advisor, or payment processor.
          </Text>
        </Section>

        <Section title="3. Account Security">
          <Text style={styles.sectionBody}>
            You are responsible for maintaining the confidentiality of your account credentials. You must use strong passwords, enable multi-factor authentication (MFA) where available, and notify us immediately of any unauthorized access to your account. You are responsible for all activity that occurs under your account.
          </Text>
        </Section>

        <Section title="4. Third-Party Provider Authorization">
          <Text style={styles.sectionBody}>
            When you connect third-party providers through Aspire, you authorize Aspire to access the specific data scopes approved in each provider's consent flow. Each provider maintains its own terms of service:
          </Text>
          <View style={styles.linkList}>
            <Text style={styles.sectionBody}>
              • Plaid: <Link url="plaid.com/legal" label="plaid.com/legal" />
            </Text>
            <Text style={styles.sectionBody}>
              • Stripe: <Link url="stripe.com/legal" label="stripe.com/legal" />
            </Text>
            <Text style={styles.sectionBody}>
              • QuickBooks: <Link url="quickbooks.intuit.com/legal" label="quickbooks.intuit.com/legal" />
            </Text>
            <Text style={styles.sectionBody}>
              • Gusto: <Link url="gusto.com/terms" label="gusto.com/terms" />
            </Text>
          </View>
          <Text style={styles.sectionBody}>
            You may revoke access to any connected provider at any time through your account settings.
          </Text>
        </Section>

        <Section title="5. Data Processing">
          <Text style={styles.sectionBody}>
            Aspire processes your data in accordance with our Privacy Policy. By using Aspire, you consent to your data being shared with the listed third-party providers solely for the purposes stated in each integration's consent flow. Aspire does not sell your data. Please refer to our Privacy Policy for full details on how your data is collected, used, and protected.
          </Text>
        </Section>

        <Section title="6. Acceptable Use">
          <Text style={styles.sectionBody}>
            You agree not to engage in any of the following prohibited activities:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Fraud, abuse, or deceptive practices</Text>
            <Text style={styles.bulletItem}>• Scraping, crawling, or automated data extraction</Text>
            <Text style={styles.bulletItem}>• Credential stuffing or brute-force attacks</Text>
            <Text style={styles.bulletItem}>• Reverse engineering or decompiling any part of the service</Text>
            <Text style={styles.bulletItem}>• Unauthorized access to systems or data</Text>
            <Text style={styles.bulletItem}>• Circumventing security measures or access controls</Text>
            <Text style={styles.bulletItem}>• Any unlawful activity or violation of applicable laws</Text>
            <Text style={styles.bulletItem}>• Using Aspire in a manner that violates any third-party provider's terms of service</Text>
          </View>
        </Section>

        <Section title="7. Intellectual Property">
          <Text style={styles.sectionBody}>
            Aspire and all associated content, features, and functionality are owned by Aspire and are protected by intellectual property laws. You retain full ownership of your data. By using Aspire, you grant Aspire a limited, non-exclusive license to process your data solely for the purpose of delivering the service.
          </Text>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <Text style={styles.sectionBody}>
            THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. ASPIRE MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE ACCURACY, COMPLETENESS, OR RELIABILITY OF THE SERVICE, OR THAT ACCESS WILL BE UNINTERRUPTED OR ERROR-FREE. ASPIRE IS NOT RESPONSIBLE FOR OUTAGES, DOWNTIME, OR SERVICE DISRUPTIONS CAUSED BY THIRD-PARTY PROVIDERS.
          </Text>
        </Section>

        <Section title="9. Limitation of Liability">
          <Text style={styles.sectionBody}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, ASPIRE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. ASPIRE'S TOTAL LIABILITY SHALL NOT EXCEED THE AGGREGATE FEES PAID BY YOU TO ASPIRE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
          </Text>
        </Section>

        <Section title="10. Indemnification">
          <Text style={styles.sectionBody}>
            You agree to indemnify, defend, and hold harmless Aspire and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising from your use of the service, your violation of these Terms, or any unauthorized access to your account.
          </Text>
        </Section>

        <Section title="11. Termination">
          <Text style={styles.sectionBody}>
            You may stop using Aspire at any time. Aspire reserves the right to suspend or terminate your access to the service for reasons including, but not limited to, security concerns, suspected fraud, policy violations, or legal requirements. Upon termination, your data will be handled in accordance with our Data Retention policy.
          </Text>
        </Section>

        <Section title="12. Governing Law">
          <Text style={styles.sectionBody}>
            These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms shall be resolved through binding arbitration, except that either party may seek injunctive or equitable relief in a court of competent jurisdiction.
          </Text>
        </Section>

        <Section title="13. Changes to Terms">
          <Text style={styles.sectionBody}>
            We may update these Terms from time to time. Material changes will be communicated to you in-app and via email with at least thirty (30) days' notice prior to the changes taking effect. Your continued use of Aspire after the effective date of any changes constitutes your acceptance of the updated Terms.
          </Text>
        </Section>

        <Section title="14. Contact">
          <Text style={styles.sectionBody}>
            If you have questions, concerns, or need to report a security issue, contact us at:
          </Text>
          <Text style={[styles.sectionBody, styles.contactEmail]}>
            security@aspireos.app
          </Text>
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
  effectiveDate: {
    ...Typography.caption,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  intro: {
    ...Typography.body,
    color: Colors.text.secondary,
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
  emphasis: {
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  link: {
    ...Typography.body,
    color: Colors.accent.cyan,
    textDecorationLine: 'underline',
  },
  linkList: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
    gap: Spacing.xs,
  },
  bulletList: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
    gap: Spacing.xs,
  },
  bulletItem: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  contactEmail: {
    color: Colors.accent.cyan,
    fontWeight: '500',
    marginTop: Spacing.sm,
  },
});
