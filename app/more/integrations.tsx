import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { formatRelativeTime } from '@/lib/formatters';
import { supabase } from '@/lib/supabase';
import { Integration, IntegrationStatus } from '@/types/integrations';

const STATUS_COLORS: Record<IntegrationStatus, { bg: string; text: string }> = {
  'Connected': { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80' },
  'Not connected': { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF' },
  'Needs attention': { bg: 'rgba(251, 191, 36, 0.2)', text: '#FBBF24' },
};

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonInfo}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonBadge} />
      </View>
    </View>
  );
}

function IntegrationCard({ integration, onPress }: { integration: Integration; onPress: () => void }) {
  const statusColor = STATUS_COLORS[integration.status];
  
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={integration.icon as any} size={24} color={Colors.accent.cyan} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{integration.name}</Text>
          <Text style={styles.cardCategory}>{integration.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>{integration.status}</Text>
        </View>
      </View>
      {integration.lastSync && (
        <View style={styles.syncInfo}>
          <Ionicons name="sync" size={14} color={Colors.text.muted} />
          <Text style={styles.syncText}>Last sync: {formatRelativeTime(integration.lastSync)}</Text>
        </View>
      )}
      {integration.status !== 'Not connected' && (
        <View style={styles.healthRow}>
          <View style={styles.healthItem}>
            <Ionicons 
              name={integration.healthCheck.webhookVerified ? 'checkmark-circle' : 'close-circle'} 
              size={14} 
              color={integration.healthCheck.webhookVerified ? Colors.semantic.success : Colors.semantic.error} 
            />
            <Text style={styles.healthText}>Webhook</Text>
          </View>
          <View style={styles.healthItem}>
            <Ionicons 
              name={integration.healthCheck.tokenExpiry === 'ok' ? 'checkmark-circle' : integration.healthCheck.tokenExpiry === 'soon' ? 'warning' : 'close-circle'} 
              size={14} 
              color={integration.healthCheck.tokenExpiry === 'ok' ? Colors.semantic.success : integration.healthCheck.tokenExpiry === 'soon' ? Colors.semantic.warning : Colors.semantic.error} 
            />
            <Text style={styles.healthText}>Token</Text>
          </View>
          {integration.healthCheck.syncErrorCount > 0 && (
            <View style={styles.healthItem}>
              <Ionicons name="alert-circle" size={14} color={Colors.semantic.error} />
              <Text style={styles.healthText}>{integration.healthCheck.syncErrorCount} errors</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function IntegrationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const { data, error } = await supabase
          .from('oauth_tokens')
          .select('id, provider, scopes, expires_at, created_at, updated_at');
        if (error) throw error;
        const mapped: Integration[] = (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.provider ?? 'Unknown',
          category: 'Connected Service',
          icon: 'cloud' as const,
          status: 'Connected' as IntegrationStatus,
          lastSync: row.updated_at ?? row.created_at,
          createdAt: row.created_at ?? new Date().toISOString(),
          updatedAt: row.updated_at ?? new Date().toISOString(),
          healthCheck: {
            webhookVerified: true,
            tokenExpiry: row.expires_at && new Date(row.expires_at) > new Date() ? 'ok' as const : 'expired' as const,
            syncErrorCount: 0,
          },
        }));
        setIntegrations(mapped);
      } catch (e) {
        console.warn('Failed to load integrations:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, []);

  const connected = integrations.filter(i => i.status === 'Connected');
  const needsAttention = integrations.filter(i => i.status === 'Needs attention');
  const notConnected = integrations.filter(i => i.status === 'Not connected');

  const handlePress = (id: string) => {
    router.push(`/more/integration/${id}` as any);
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Integrations" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <>
            <View style={styles.skeletonSubtitleBar} />
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </>
        ) : (
        <>
        <Text style={styles.subtitle}>{integrations.length} integrations configured</Text>

        {needsAttention.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            {needsAttention.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} onPress={() => handlePress(integration.id)} />
            ))}
          </>
        )}

        {connected.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Connected</Text>
            {connected.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} onPress={() => handlePress(integration.id)} />
            ))}
          </>
        )}

        {notConnected.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Available</Text>
            {notConnected.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} onPress={() => handlePress(integration.id)} />
            ))}
          </>
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
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
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  cardCategory: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  syncText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: Spacing.xs,
  },
  healthRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  healthText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginLeft: 4,
  },
  skeletonCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.tertiary,
    marginRight: Spacing.md,
  },
  skeletonInfo: {
    flex: 1,
  },
  skeletonTitle: {
    width: '60%',
    height: 16,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 12,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
  },
  skeletonBadge: {
    width: 70,
    height: 24,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
  },
  skeletonSubtitleBar: {
    width: '50%',
    height: 16,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    marginBottom: Spacing.lg,
  },
});
