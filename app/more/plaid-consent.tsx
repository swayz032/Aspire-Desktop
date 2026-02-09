import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { getPlaidConsent, setPlaidConsent } from '@/lib/security/plaidConsent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

export default function PlaidConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const existing = await getPlaidConsent();
      setAccepted(existing);
      setLoading(false);
    })();
  }, []);

  const onAccept = async () => {
    await setPlaidConsent(true);
    setAccepted(true);
    router.back();
  };

  const onRevoke = async () => {
    await setPlaidConsent(false);
    setAccepted(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title="Plaid Consent" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent.cyan} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader title="Plaid Consent" showBackButton />
      <ScrollView style={[styles.scroll, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consent to connect your bank account</Text>
          <Text style={styles.cardSubtitle}>
            Aspire uses Plaid Link to connect your financial institution and retrieve limited account data.
          </Text>

          <InfoBlock
            title="What we access (read-only)"
            body={`\u2022 Account identifiers (institution + last 4)\n\u2022 Balances\n\u2022 Transactions (if you enable transaction feed)`}
          />

          <InfoBlock
            title="What we do NOT do"
            body={`\u2022 We do not initiate bank transfers in the current MVP.\n\u2022 We do not store your bank login credentials.`}
          />

          <InfoBlock
            title="Your controls"
            body={`You can disconnect Plaid at any time from Finance \u2192 Connections. You can request data deletion from More \u2192 Data Retention.`}
          />

          <Text style={styles.legalNote}>
            By accepting, you authorize Aspire to access and process your Plaid data according to our Privacy Policy.
          </Text>

          <View style={styles.buttonRow}>
            <Button
              label={accepted ? 'Already accepted' : 'Accept'}
              onPress={onAccept}
              variant="primary"
              disabled={accepted}
              style={styles.buttonFlex}
            />
            <Button
              label="Revoke"
              onPress={onRevoke}
              variant="secondary"
              disabled={!accepted}
              style={styles.buttonFlex}
            />
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    ...Typography.body,
    color: Colors.text.muted,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  infoBlock: {
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  infoBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  legalNote: {
    ...Typography.small,
    color: Colors.text.muted,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonFlex: {
    flex: 1,
  },
});
