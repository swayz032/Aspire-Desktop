import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const BRIGHT_BG = '#0a0a0c';

interface PreparedArtifact {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  riskTier: string;
}

function mapReceiptToArtifact(receipt: any): PreparedArtifact {
  const actionType = receipt.action_type || '';
  let type = 'draft';
  if (actionType.includes('invoice') || actionType.includes('payment')) type = 'plan';
  else if (actionType.includes('email') || actionType.includes('message')) type = 'draft';
  else if (actionType.includes('contract') || actionType.includes('document')) type = 'template';
  else if (actionType.includes('meeting') || actionType.includes('calendar')) type = 'checklist';

  let status = 'needs_review';
  if (receipt.status === 'SUCCEEDED') status = 'approved';
  else if (receipt.status === 'FAILED') status = 'receipt_required';
  else if (receipt.status === 'DENIED') status = 'receipt_required';
  else if (receipt.status === 'PENDING') status = 'needs_review';

  const riskTier = receipt.risk_tier === 'red' ? 'high' : receipt.risk_tier === 'yellow' ? 'medium' : 'low';

  return {
    id: receipt.id,
    type,
    title: receipt.action_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Unnamed Action',
    status,
    createdAt: receipt.created_at,
    riskTier,
  };
}

const getArtifactIcon = (type: string) => {
  switch (type) {
    case 'draft': return 'document-text';
    case 'template': return 'grid';
    case 'plan': return 'map';
    case 'checklist': return 'checkbox';
    default: return 'document';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'drafted': return '#8e8e93';
    case 'needs_review': return '#fbbf24';
    case 'approved': return '#34d399';
    case 'receipt_required': return '#f472b6';
    case 'queued': return '#3B82F6';
    case 'executed': return '#34d399';
    default: return Colors.text.muted;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'drafted': return 'Draft';
    case 'needs_review': return 'Needs Review';
    case 'approved': return 'Approved';
    case 'receipt_required': return 'Receipt Required';
    case 'queued': return 'Queued';
    case 'executed': return 'Executed';
    default: return status;
  }
};

const getRiskTierColor = (tier: string) => {
  switch (tier) {
    case 'low': return '#34d399';
    case 'medium': return '#fbbf24';
    case 'high': return '#f87171';
    default: return Colors.text.muted;
  }
};

function PreparedContent() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<PreparedArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArtifacts() {
      try {
        const { data, error } = await supabase
          .from('receipts')
          .select('id, action_type, status, risk_tier, created_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Failed to fetch receipts:', error.message);
          return;
        }

        setArtifacts((data || []).map(mapReceiptToArtifact));
      } catch (err) {
        console.error('Unexpected error fetching receipts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchArtifacts();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', BRIGHT_BG]}
        locations={[0, 0.15, 0.35, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>What Aspire Prepared</Text>
            <Text style={styles.headerSubtitle}>{artifacts.length} artifacts ready for review</Text>
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {artifacts.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.text.muted} />
            <Text style={{ color: Colors.text.muted, marginTop: Spacing.md, fontSize: Typography.body.fontSize }}>
              No artifacts to review
            </Text>
          </View>
        ) : (
          artifacts.map((artifact) => (
            <TouchableOpacity
              key={artifact.id}
              style={styles.artifactCard}
              onPress={() => router.push(`/founder-hub/artifacts/${artifact.id}` as any)}
            >
              <View style={styles.artifactHeader}>
                <View style={styles.artifactIconOuter}>
                  <View style={styles.artifactIconGlow} />
                  <View style={styles.artifactIconInner}>
                    <Ionicons name={getArtifactIcon(artifact.type) as any} size={14} color="#3B82F6" />
                  </View>
                </View>
                <View style={styles.artifactMeta}>
                  <Text style={styles.artifactType}>
                    {artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)}
                  </Text>
                  <Text style={styles.artifactDate}>{formatDate(artifact.createdAt)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(artifact.status)}15`, borderColor: `${getStatusColor(artifact.status)}25` }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(artifact.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(artifact.status) }]}>
                    {getStatusLabel(artifact.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.artifactTitle}>{artifact.title}</Text>

              <View style={styles.artifactFooter}>
                <View style={[styles.riskBadge, { backgroundColor: `${getRiskTierColor(artifact.riskTier)}15`, borderColor: `${getRiskTierColor(artifact.riskTier)}25` }]}>
                  <Text style={[styles.riskText, { color: getRiskTierColor(artifact.riskTier) }]}>
                    {artifact.riskTier.charAt(0).toUpperCase() + artifact.riskTier.slice(1)} Risk
                  </Text>
                </View>
                <TouchableOpacity style={styles.reviewButton}>
                  <Text style={styles.reviewText}>Review</Text>
                  <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}


export default function PreparedScreen() {
  return (
    <PageErrorBoundary pageName="prepared">
      <PreparedContent />
    </PageErrorBoundary>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRIGHT_BG,
  },
  heroGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  filterButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
  },
  artifactCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#1a3a5c',
  },
  artifactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  artifactIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artifactIconOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  artifactIconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },
  artifactIconInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(79, 172, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artifactMeta: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  artifactType: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  artifactDate: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
  },
  artifactTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  artifactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  riskText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
