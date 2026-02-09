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

export default function DataRetentionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  return (
    <View style={styles.container}>
      <PageHeader title="Data Retention & Deletion" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <Section title="Retention approach">
          Aspire retains only the data required to provide the requested features. Where possible, we store derived summaries and receipt metadata instead of raw data.
        </Section>

        <Section title="Plaid data retention">
          {`\u2022 Access tokens are stored server-side only.\n\u2022 Transaction and balance data is stored for a limited time needed for user-visible history and accounting sync.\n\u2022 You can disconnect Plaid to stop future pulls.`}
        </Section>

        <Section title="Deletion">
          {`You can request deletion of your account and associated data. For now, deletion requests are handled via support. Once the automated flow is implemented, this page will link to the self-serve deletion control.\n\nEmail: privacy@aspireos.app`}
        </Section>

        <Section title="Policy review cadence">
          This policy is reviewed periodically and updated when product scope or regulatory requirements change.
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
