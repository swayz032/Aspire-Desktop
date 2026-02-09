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
          title="Encryption in transit"
          description="All connections between your browser, our servers, and third-party APIs use TLS (HTTPS). No plaintext data is transmitted over the network."
        />

        <Practice
          icon="key"
          title="Secret management"
          description="API keys, access tokens, and other credentials are stored in server-side secret managers. They are never committed to source control or exposed in client-side code."
        />

        <Practice
          icon="shield-checkmark"
          title="Multi-factor authentication"
          description="Aspire supports TOTP-based MFA. MFA verification is required before connecting sensitive third-party services like Plaid."
        />

        <Practice
          icon="person-circle"
          title="Access controls"
          description="Production systems use role-based access. Database credentials and third-party tokens are scoped to the minimum permissions needed."
        />

        <Practice
          icon="server"
          title="Infrastructure"
          description="Aspire runs on managed cloud infrastructure. The hosting provider handles OS-level patching, DDoS mitigation, and physical security."
        />

        <Practice
          icon="document-lock"
          title="Plaid token handling"
          description="Plaid access tokens are stored server-side only. Link tokens are short-lived and scoped to a single session. Public tokens are exchanged immediately and not persisted."
        />

        <Practice
          icon="trash-bin"
          title="Data minimization"
          description="We store only the data needed to provide requested features. Where possible, we store derived summaries rather than raw data. Users can request deletion."
        />

        <Practice
          icon="code-slash"
          title="Dependency management"
          description="Dependencies are tracked in lockfiles and updated periodically. We use automated tooling to detect known vulnerabilities in third-party packages."
        />

        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color={Colors.text.muted} />
          <Text style={styles.footerText}>
            Security is an ongoing process. If you discover a vulnerability, contact security@aspireos.app.
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
    backgroundColor: Colors.accent.cyanDark,
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
