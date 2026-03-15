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

function ProviderCard({ name, purpose, data, location, controls }: {
  name: string;
  purpose: string;
  data: string;
  location: string;
  controls: string;
}) {
  return (
    <View style={styles.providerCard}>
      <Text style={styles.providerName}>{name}</Text>
      <View style={styles.providerRow}>
        <Text style={styles.providerLabel}>Purpose</Text>
        <Text style={styles.providerValue}>{purpose}</Text>
      </View>
      <View style={styles.providerRow}>
        <Text style={styles.providerLabel}>Data Shared</Text>
        <Text style={styles.providerValue}>{data}</Text>
      </View>
      <View style={styles.providerRow}>
        <Text style={styles.providerLabel}>Location</Text>
        <Text style={styles.providerValue}>{location}</Text>
      </View>
      <View style={styles.providerRow}>
        <Text style={styles.providerLabel}>User Controls</Text>
        <Text style={styles.providerValue}>{controls}</Text>
      </View>
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

        <Section title="1. About Aspire">
          Aspire is a business operations and finance platform designed for founders and teams. Aspire consolidates financial data, payment processing, accounting, payroll, and business intelligence into a single workspace, enabling users to manage their business operations efficiently through integrated third-party service connections.
        </Section>

        <Section title="2. Data We Collect">
          <View>
            <Text style={styles.sectionBody}>We collect the following categories of data depending on which features and integrations you use:</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Account Information — Name, email address, business name, and authentication credentials you provide during registration.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Financial Data via Plaid — Bank account numbers (tokenized), account balances, transaction history, and account owner information you authorize through Plaid.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Payment Data via Stripe — Card details (tokenized by Stripe), billing address, email, and transaction amounts processed through Stripe.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Accounting Data via QuickBooks — Invoices, expenses, chart of accounts, tax identification numbers, and transaction records synced from your QuickBooks account.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Payroll Data via Gusto — Employee names, compensation data, tax filings, and benefits information synced from your Gusto account.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Application Telemetry — Device information, app version, error logs, and usage analytics collected to maintain and improve the platform.</Text>
          </View>
        </Section>

        <Section title="3. Third-Party Service Providers">
          <View>
            <Text style={styles.sectionBody}>Aspire integrates with the following third-party service providers to deliver its functionality. Each provider receives only the data necessary to perform its stated purpose.</Text>
            <ProviderCard
              name="Plaid"
              purpose="Financial data aggregation"
              data="Account credentials (tokenized), balances, transactions, account owner info"
              location="US (AWS)"
              controls="Disconnect in-app or via Plaid Portal (my.plaid.com)"
            />
            <ProviderCard
              name="Stripe"
              purpose="Payment processing"
              data="Card details (tokenized), billing address, email, transaction amounts"
              location="US / EU"
              controls="Contact security@aspireos.app"
            />
            <ProviderCard
              name="QuickBooks (Intuit)"
              purpose="Accounting & invoicing"
              data="Customer names, invoice data, transaction amounts, chart of accounts"
              location="US"
              controls="Disconnect in Finance Hub"
            />
            <ProviderCard
              name="Gusto"
              purpose="Payroll & HR"
              data="Employee names, compensation data, tax filings, benefits"
              location="US"
              controls="Disconnect in Finance Hub"
            />
          </View>
        </Section>

        <Section title="4. How We Use Your Data">
          <View>
            <Text style={styles.sectionBody}>Your data is used for the following purposes:</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Service Delivery — Displaying account balances, transactions, invoices, and payroll information within the Aspire platform.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Financial Reporting — Generating cash position summaries, financial dashboards, and business intelligence insights.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Payment Processing — Facilitating payments, billing, and transaction reconciliation through Stripe.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Payroll Management — Processing payroll runs, tax filings, and employee compensation through Gusto.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Security & Fraud Prevention — Detecting unauthorized access, preventing fraudulent activity, and maintaining platform integrity.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Legal Compliance — Meeting regulatory, tax, and audit obligations as required by applicable law.</Text>
          </View>
        </Section>

        <Section title="5. Data Sharing">
          <View>
            <Text style={styles.sectionBody}>We do NOT sell your personal or financial data. We share data only in the following circumstances:</Text>
            <Text style={styles.bulletItem}>{'\u2022'} With the third-party service providers listed in Section 3, solely for their stated purposes.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} As required by law, regulation, legal process, or enforceable governmental request.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} In connection with a merger, acquisition, or sale of assets, in which case you will be notified of any change in ownership or use of your data.</Text>
          </View>
        </Section>

        <Section title="6. Your Rights">
          <View>
            <Text style={styles.sectionBody}>You have the following rights regarding your data:</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Access your data — Request a copy of the personal and financial data we hold about you.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Request deletion — Ask us to delete your data, subject to legal and regulatory retention requirements.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Revoke third-party connections — Disconnect any integrated service at any time through the Aspire app.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Data portability — Request your data in a structured, machine-readable format.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Plaid-specific controls — Manage or revoke Plaid access via the Plaid Portal at my.plaid.com.</Text>
            <Text style={styles.sectionBody}>To exercise any of these rights, contact security@aspireos.app.</Text>
          </View>
        </Section>

        <Section title="7. Security">
          <View>
            <Text style={styles.sectionBody}>We implement industry-standard security measures to protect your data:</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Encryption in Transit — All data transmitted between your device and our servers is encrypted using TLS.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Tokenized Credentials — We never store raw bank passwords or card numbers. All sensitive credentials are tokenized by the respective provider (Plaid, Stripe).</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Server-Side Secret Management — API keys, access tokens, and service credentials are stored in secure server-side secret managers and are never committed to source control.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Multi-Factor Authentication (MFA) — We support MFA to add an additional layer of protection to your account.</Text>
            <Text style={styles.bulletItem}>{'\u2022'} Role-Based Access Controls — Access to data and systems is restricted based on user roles and the principle of least privilege.</Text>
            <Text style={styles.sectionBody}>For more details, refer to the Security Practices page in More → Policies.</Text>
          </View>
        </Section>

        <Section title="8. Data Retention">
          We retain your data only as long as necessary to provide our services and comply with legal, tax, and regulatory obligations. Retention periods vary by data category and provider. For detailed per-provider retention schedules, refer to the Data Retention page in More → Policies.
        </Section>

        <Section title="9. Cross-Border Transfers">
          Your data is primarily processed in the United States. Third-party service providers (Plaid, Stripe, QuickBooks, Gusto) may process data in the US and/or EU in accordance with their respective privacy policies and applicable data protection regulations.
        </Section>

        <Section title="10. Children's Privacy">
          Aspire is not directed at individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have inadvertently collected such information, we will take steps to delete it promptly.
        </Section>

        <Section title="11. Changes to This Policy">
          We may update this Privacy Policy from time to time. Material changes will be communicated in-app and via email to your registered address. Your continued use of Aspire after such changes constitutes your acceptance of the updated policy.
        </Section>

        <Section title="12. Contact">
          For all privacy inquiries, data requests, or concerns regarding this policy, contact us at security@aspireos.app.
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
  bulletItem: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  providerCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  providerName: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  providerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  providerLabel: {
    ...Typography.caption,
    color: Colors.text.muted,
    width: 110,
    fontWeight: '500',
  },
  providerValue: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
});
