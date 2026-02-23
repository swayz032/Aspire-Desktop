import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/providers';

const BRIGHT_BG = '#0a0a0c';

const areaConfig: Record<string, { name: string; icon: string; color: string; description: string; gradientColors: string[] }> = {
  cashflow: {
    name: 'Cashflow',
    icon: 'wallet',
    color: '#3B82F6',
    description: 'Manage cash position, AR/AP, and financial health',
    gradientColors: ['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', '#0a1929'],
  },
  leads: {
    name: 'Leads',
    icon: 'mail',
    color: '#3B82F6',
    description: 'Track new inquiries and pipeline opportunities',
    gradientColors: ['#0a1620', '#0d2835', '#1a4a5a', '#0d3a4c', '#0a1520'],
  },
  ops: {
    name: 'Operations',
    icon: 'construct',
    color: '#34d399',
    description: 'Monitor returns, deliveries, and operational issues',
    gradientColors: ['#0a1614', '#0d2820', '#1a4a38', '#0d3a2c', '#0a1914'],
  },
  growth: {
    name: 'Growth Angles',
    icon: 'rocket',
    color: '#f472b6',
    description: 'Explore new opportunities and expansion ideas',
    gradientColors: ['#1a0a18', '#280d22', '#4a1a40', '#3a0d32', '#1a0a14'],
  },
  'ai-edge': {
    name: 'AI Edge',
    icon: 'sparkles',
    color: '#a78bfa',
    description: 'Automation opportunities and efficiency wins',
    gradientColors: ['#140a1a', '#1d0d28', '#3a1a4a', '#2c0d3a', '#140a1a'],
  },
};

interface Insight {
  id: string;
  title: string;
  evidence: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  riskTier: 'low' | 'medium' | 'high';
}

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'high': return '#34d399';
    case 'medium': return '#fbbf24';
    case 'low': return '#f87171';
    default: return Colors.text.muted;
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

export default function FocusScreen() {
  const router = useRouter();
  const { area } = useLocalSearchParams<{ area: string }>();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const config = areaConfig[area || 'cashflow'] || areaConfig.cashflow;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('receipts')
          .select('*')
          .like('action_type', 'adam.focus%')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!mounted) return;
        if (data && data.length > 0) {
          setInsights(data.map((r: any, idx: number) => {
            const p = r.payload ?? {};
            return {
              id: r.id ?? `insight-${idx}`,
              title: p.title ?? 'Focus insight',
              evidence: p.evidence ?? p.summary ?? p.description ?? '',
              action: p.action ?? p.cta ?? 'View Details',
              confidence: p.confidence ?? 'medium',
              riskTier: p.risk_tier ?? p.riskTier ?? 'low',
            };
          }));
        }
      } catch (err) {
        console.error('Failed to load focus insights:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [area]);

  if (loading || tenantLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={config.gradientColors as any}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <View style={styles.skeletonHeaderTitle} />
                <View style={styles.skeletonHeaderSubtitle} />
              </View>
            </View>
          </LinearGradient>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.skeletonInsights}>
            {[1, 2].map((i) => (
              <View key={i} style={styles.skeletonInsightCard} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!tenant?.onboardingCompleted) {
    return (
      <View style={styles.container}>
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={config.gradientColors as any}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{config.name}</Text>
                <Text style={styles.headerSubtitle}>{config.description}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyStateContainer}>
            <Ionicons name="person-circle-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyStateTitle}>Complete your profile to unlock Focus</Text>
            <Text style={styles.emptyStateDesc}>
              Once you finish onboarding, Adam will generate weekly focus goals tailored to your business.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroWrapper}>
        <LinearGradient
          colors={config.gradientColors as any}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={[styles.heroGlow, { backgroundColor: `${config.color}15` }]} />
          <View style={[styles.heroGlowSecondary, { backgroundColor: `${config.color}08` }]} />
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.canGoBack() ? router.back() : router.push('/founder-hub')}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerIconOuter}>
              <View style={[styles.headerIconGlow, { borderColor: `${config.color}30` }]} />
              <View style={[styles.headerIconInner, { backgroundColor: `${config.color}25` }]}>
                <Ionicons name={config.icon as any} size={16} color="#fff" />
              </View>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{config.name}</Text>
              <Text style={styles.headerSubtitle}>{config.description}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tenant?.businessGoals && tenant.businessGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Business Goals</Text>
            <View style={styles.goalsRow}>
              {tenant.businessGoals.map((goal, idx) => (
                <View key={idx} style={[styles.goalChip, { backgroundColor: `${config.color}15`, borderColor: `${config.color}25` }]}>
                  <Text style={[styles.goalChipText, { color: config.color }]}>{goal}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights & Priorities</Text>

          {insights.length === 0 ? (
            <Card variant="elevated" style={styles.emptyCard}>
              <Ionicons name="telescope-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.emptyCardTitle}>Your weekly focus goals will appear here once Adam generates them</Text>
              <Text style={styles.emptyCardText}>
                Adam analyzes your {tenant?.industry ?? 'business'} data weekly to surface what matters most.
              </Text>
            </Card>
          ) : (
            insights.map((insight) => (
              <View key={insight.id} style={styles.insightCardWrapper}>
                <LinearGradient
                  colors={config.gradientColors as any}
                  locations={[0, 0.2, 0.5, 0.8, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.insightCard}
                >
                  <View style={[styles.cardGlow, { backgroundColor: `${config.color}12` }]} />
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <View style={styles.insightBadges}>
                      <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(insight.confidence)}15`, borderColor: `${getConfidenceColor(insight.confidence)}25` }]}>
                        <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(insight.confidence) }]} />
                        <Text style={[styles.confidenceText, { color: getConfidenceColor(insight.confidence) }]}>
                          {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.insightEvidence}>{insight.evidence}</Text>
                  <View style={styles.riskRow}>
                    <View style={[styles.riskBadge, { backgroundColor: `${getRiskTierColor(insight.riskTier)}15`, borderColor: `${getRiskTierColor(insight.riskTier)}25` }]}>
                      <Text style={[styles.riskText, { color: getRiskTierColor(insight.riskTier) }]}>
                        {insight.riskTier.charAt(0).toUpperCase() + insight.riskTier.slice(1)} Risk
                      </Text>
                    </View>
                  </View>
                  <View style={styles.insightActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: `${config.color}12`, borderColor: `${config.color}25` }]}
                      accessibilityLabel={insight.action}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.actionText, { color: config.color }]}>{insight.action}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.seeWhyButton} accessibilityLabel="See why" accessibilityRole="button">
                      <Text style={styles.seeWhyText}>See why</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.text.muted} />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            ))
          )}
        </View>

        {area === 'ai-edge' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Skill Packs</Text>
            <Card variant="elevated" style={styles.skillPackCard}>
              <View style={styles.skillPackRow}>
                <View style={styles.skillPackIconOuter}>
                  <View style={styles.skillPackIconGlow} />
                  <View style={styles.skillPackIconInner}>
                    <Ionicons name="flash" size={14} color="#fff" />
                  </View>
                </View>
                <View style={styles.skillPackContent}>
                  <Text style={styles.skillPackTitle}>AR Collection Workflow</Text>
                  <Text style={styles.skillPackSubtitle}>Automated invoice follow-ups</Text>
                </View>
                <TouchableOpacity style={styles.enableButton} accessibilityLabel="Enable skill pack" accessibilityRole="button">
                  <Text style={styles.enableText}>Enable</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRIGHT_BG,
  },
  heroWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroGradient: {
    paddingBottom: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerIconInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
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
  scrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  goalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  goalChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  insightCardWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.2)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  insightCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg - 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  insightTitle: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  insightBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
  },
  insightEvidence: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  riskRow: {
    marginBottom: Spacing.md,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  riskText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
  },
  insightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  seeWhyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  seeWhyText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
  },
  emptyCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyCardTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyCardText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  skillPackCard: {
    padding: Spacing.md,
  },
  skillPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  skillPackIconOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  skillPackIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  skillPackIconInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillPackContent: {
    flex: 1,
  },
  skillPackTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  skillPackSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
  },
  enableButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    minHeight: 44,
    justifyContent: 'center',
  },
  enableText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Skeleton loading
  skeletonHeaderTitle: {
    width: 140,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  skeletonHeaderSubtitle: {
    width: 240,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonInsights: {
    gap: Spacing.md,
  },
  skeletonInsightCard: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Empty state
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 20,
  },
});
