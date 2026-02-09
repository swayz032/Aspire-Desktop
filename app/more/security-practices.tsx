import React from 'react';
import { StyleSheet, View, ScrollView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Practice({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.practiceCard}>
      <View style={styles.practiceIcon}>
        <Ionicons name={icon as any} size={22} color={Colors.accent.cyan} />
      </View>
      <View style={styles.practiceContent}>
        <Text style={styles.practiceTitle}>{title}</Text>
        <Text style={styles.practiceDesc}>{description}</Text>
      </View>
    </View>
  );
}

export default function SecurityPracticesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Security Practices" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>How Aspire handles security</Text>
          <Text style={styles.introBody}>
            This page describes the security practices Aspire currently implements. We aim to be accurate and avoid overclaims.
          </Text>
        </View>

        <Practice
          icon="lock-closed"
          title="Encryption in Transit"
          description="All connections between your browser, our servers, and third-party APIs use TLS 1.2+ (HTTPS). No data is transmitted in plaintext. API calls to Plaid, Stripe, QuickBooks, and Gusto are encrypted end-to-end."
        />

        <Practice
          icon="key"
          title="Secret Management"
          description="API keys, access tokens, and credentials are stored in server-side secret managers. Secrets are never committed to source control, logged, or exposed in client-side code. Plaid access tokens and Stripe API keys are stored encrypted at rest."
        />

        <Practice
          icon="shield-checkmark"
          title="Multi-Factor Authentication"
          description="Aspire supports TOTP-based MFA. MFA verification is required before connecting sensitive services like Plaid. We recommend enabling MFA for all accounts."
        />

        <Practice
          icon="person-circle"
          title="Access Controls"
          description="Production systems use role-based access with principle of least privilege. Database credentials and third-party tokens are scoped to minimum required permissions."
        />

        <Practice
          icon="card"
          title="Plaid Security (SOC 2 Type II)"
          description="Plaid is SOC 2 Type II certified and uses AES-256 encryption at rest. Aspire never stores your bank credentials — Plaid tokenizes all login information. Access tokens are stored server-side only. Link tokens are short-lived and session-scoped. Users can manage connections via Plaid Portal (my.plaid.com)."
        />

        <Practice
          icon="cash"
          title="Stripe Security (PCI DSS Level 1)"
          description="Stripe is PCI DSS Level 1 certified, the highest level of payment security certification. Aspire never processes or stores raw card numbers — all payment data is tokenized by Stripe. Card data never touches our servers."
        />

        <Practice
          icon="calculator"
          title="QuickBooks Security (Intuit)"
          description="QuickBooks Online uses OAuth 2.0 for secure authorization. Aspire stores only refresh tokens server-side and never accesses more data than the scopes you authorize. Intuit maintains SOC 1 and SOC 2 certifications."
        />

        <Practice
          icon="people"
          title="Gusto Security"
          description="Gusto uses OAuth 2.0 and maintains SOC 2 Type II certification. Payroll data is encrypted in transit and at rest. Aspire accesses only the payroll and HR scopes you explicitly authorize."
        />

        <Practice
          icon="server"
          title="Infrastructure"
          description="Aspire runs on managed cloud infrastructure with OS-level patching, DDoS mitigation, and physical security handled by the hosting provider. Application data is backed up regularly."
        />

        <Practice
          icon="trash-bin"
          title="Data Minimization"
          description="We store only the data needed to provide requested features. Where possible, we store derived summaries rather than raw data. Users can request deletion at any time via security@aspireos.app."
        />

        <Practice
          icon="code-slash"
          title="Dependency Management"
          description="Dependencies are tracked in lockfiles and updated regularly. We use automated tooling to detect known vulnerabilities in third-party packages."
        />

        <Practice
          icon="alert-circle"
          title="Incident Response"
          description="In the event of a security incident affecting your data, we will notify affected users within 72 hours via email. We maintain incident response procedures and conduct post-incident reviews."
        />

        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color={Colors.text.muted} />
          <Text style={styles.footerText}>
            Security is an ongoing process. For questions or to report a vulnerability, contact security@aspireos.app.
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
  intro: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  introTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  introBody: {
    ...Typography.body,
    color: Colors.text.muted,
    lineHeight: 22,
  },
  practiceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  practiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  practiceContent: {
    flex: 1,
  },
  practiceTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  practiceDesc: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
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
