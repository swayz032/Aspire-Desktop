import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'expo-router';

const BRIGHT_BG = '#0a0a0c';

const mockArtifacts = [
  { id: '1', type: 'draft', title: '7/14/21 Follow-Up Scripts', status: 'needs_review', createdAt: '2026-01-20T10:00:00Z', riskTier: 'medium' },
  { id: '2', type: 'template', title: 'Delivery Price Capture Spreadsheet', status: 'approved', createdAt: '2026-01-19T14:30:00Z', riskTier: 'low' },
  { id: '3', type: 'plan', title: '30-Day AR Recovery Plan', status: 'needs_review', createdAt: '2026-01-20T09:15:00Z', riskTier: 'medium' },
  { id: '4', type: 'checklist', title: 'New Client Onboarding Checklist', status: 'approved', createdAt: '2026-01-18T16:45:00Z', riskTier: 'low' },
  { id: '5', type: 'draft', title: 'Quarterly Review Email', status: 'drafted', createdAt: '2026-01-20T11:30:00Z', riskTier: 'medium' },
  { id: '6', type: 'plan', title: 'Broker Pilot Program', status: 'receipt_required', createdAt: '2026-01-17T09:00:00Z', riskTier: 'high' },
];

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

export default function PreparedScreen() {
  const router = useRouter();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
            <Text style={styles.headerSubtitle}>{mockArtifacts.length} artifacts ready for review</Text>
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
        {mockArtifacts.map((artifact) => (
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
        ))}
      </ScrollView>
    </View>
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
