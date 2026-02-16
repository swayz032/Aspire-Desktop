import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { CashPosition, PipelineStage, BusinessScore, FounderHubData } from '@/types';
import { useRouter } from 'expo-router';

interface OpsSnapshotTabsProps {
  cashData: CashPosition;
  pipelineStages: PipelineStage[];
  businessScore: BusinessScore;
  founderHubData?: FounderHubData;
}

const defaultFounderHubData: FounderHubData = {
  topPriorities: [],
  focusAreas: [
    { id: 'cashflow', name: 'Cashflow', icon: 'wallet', count: 0, label: 'items', color: '#4facfe' },
    { id: 'leads', name: 'Leads', icon: 'mail', count: 0, label: 'items', color: '#3B82F6' },
    { id: 'ops', name: 'Operations', icon: 'construct', count: 0, label: 'items', color: '#a78bfa' },
  ],
  preparedArtifacts: [],
  prioritiesCount: 0,
  preparedCount: 0,
};

export function OpsSnapshotTabs({ cashData, pipelineStages, businessScore, founderHubData }: OpsSnapshotTabsProps) {
  const [activeTab, setActiveTab] = useState<'cash' | 'hub'>('cash');
  const hubData = founderHubData || defaultFounderHubData;

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cash' && styles.activeTab]}
          onPress={() => setActiveTab('cash')}
        >
          <Text style={[styles.tabText, activeTab === 'cash' && styles.activeTabText]}>
            Finance Hub
          </Text>
          {activeTab === 'cash' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hub' && styles.activeTab]}
          onPress={() => setActiveTab('hub')}
        >
          <Text style={[styles.tabText, activeTab === 'hub' && styles.activeTabText]}>
            Founder Hub
          </Text>
          {activeTab === 'hub' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'cash' ? (
        <CashContent data={cashData} />
      ) : (
        <FounderHubContent data={hubData} />
      )}
    </Card>
  );
}

function CashContent({ data }: { data: CashPosition }) {
  const router = useRouter();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const netChange = data.expectedInflows7d - data.upcomingOutflows7d;
  const isPositive = netChange >= 0;

  return (
    <View style={styles.cashContainer}>
      <View style={styles.premiumCardWrapper}>
        <LinearGradient
          colors={['#0a1628', '#0d2847', '#1a4a6e', '#0d3a5c', '#0a1929']}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cashHero}
        >
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowSecondary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroMesh} />
          
          <View style={styles.cashHeroHeader}>
            <View style={styles.walletIconOuter}>
              <View style={styles.walletIconGlow} />
              <View style={styles.walletIconInner}>
                <Ionicons name="wallet" size={16} color="#fff" />
              </View>
            </View>
            <View style={[styles.trendBadge, isPositive ? styles.trendBadgePositive : styles.trendBadgeNegative]}>
              <Ionicons 
                name={isPositive ? "trending-up" : "trending-down"} 
                size={11} 
                color={isPositive ? '#34c759' : '#ff3b30'} 
              />
              <Text style={[styles.trendText, { color: isPositive ? '#34c759' : '#ff3b30' }]}>
                {isPositive ? '+' : ''}{formatCurrency(netChange)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.cashAmountLabel}>Total Balance</Text>
          <Text style={styles.cashAmount}>{formatCurrency(data.availableCash)}</Text>
          
          <View style={styles.projectedRow}>
            <View style={styles.projectedDot} />
            <Text style={styles.projectedLabel}>7-day forecast</Text>
            <Text style={styles.projectedAmount}>
              {formatCurrency(data.availableCash + netChange)}
            </Text>
          </View>
        </LinearGradient>
      </View>
      
      <View style={styles.flowSection}>
        <View style={styles.flowCard}>
          <View style={styles.flowIconWrapper}>
            <View style={[styles.flowIconBg, styles.inflowBg]}>
              <Ionicons name="arrow-down" size={12} color="#34c759" />
            </View>
          </View>
          <View style={styles.flowContent}>
            <Text style={styles.flowTitle}>Inflows</Text>
            <Text style={styles.flowAmount} numberOfLines={1}>+{formatCurrency(data.expectedInflows7d)}</Text>
          </View>
        </View>
        
        <View style={styles.flowDivider} />
        
        <View style={styles.flowCard}>
          <View style={styles.flowIconWrapper}>
            <View style={[styles.flowIconBg, styles.outflowBg]}>
              <Ionicons name="arrow-up" size={12} color="#ff3b30" />
            </View>
          </View>
          <View style={styles.flowContent}>
            <Text style={styles.flowTitle}>Outflows</Text>
            <Text style={styles.flowAmountOut} numberOfLines={1}>-{formatCurrency(data.upcomingOutflows7d)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.dashboardButton}
        onPress={() => router.push('/finance-hub' as any)}
        activeOpacity={0.8}
      >
        <View style={styles.dashboardButtonInner}>
          <Text style={styles.dashboardButtonText}>Open Dashboard</Text>
          <View style={styles.dashboardButtonIcon}>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function FounderHubContent({ data }: { data: FounderHubData }) {
  const router = useRouter();

  return (
    <View style={styles.hubContainer}>
      <View style={[styles.premiumCardWrapper, { borderColor: 'rgba(59, 130, 246, 0.25)' }]}>
        <LinearGradient
          colors={['#0c2d4d', '#0a1f35', '#061525', '#0a1f35', '#0c2d4d']}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cashHero}
        >
          <View style={[styles.heroGlowPrimary, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]} />
          <View style={[styles.heroGlowSecondary, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]} />
          <View style={[styles.heroGlowAccent, { backgroundColor: 'rgba(59, 130, 246, 0.05)' }]} />

          <View style={styles.cashHeroHeader}>
            <View style={[styles.walletIconOuter, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <View style={[styles.walletIconGlow, { borderColor: 'rgba(59, 130, 246, 0.3)' }]} />
              <View style={[styles.walletIconInner, { backgroundColor: 'rgba(59, 130, 246, 0.25)' }]}>
                <Ionicons name="sunny" size={16} color="#3B82F6" />
              </View>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
              <Text style={[styles.trendText, { color: '#3B82F6' }]}>
                Today's Brief
              </Text>
            </View>
          </View>

          <Text style={styles.hubHeadline}>Your business at a glance</Text>
          <Text style={styles.hubSubtitle}>AI-powered insights, strategy tools, and growth resources.</Text>
          
          <View style={styles.hubPillarsRow}>
            <View style={[styles.hubPillarChip, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Ionicons name="sunny" size={12} color="#3B82F6" />
              <Text style={[styles.hubPillarLabel, { color: '#3B82F6' }]}>Daily Brief</Text>
            </View>
            <View style={[styles.hubPillarChip, { backgroundColor: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.2)' }]}>
              <Ionicons name="bulb" size={12} color="#a78bfa" />
              <Text style={[styles.hubPillarLabel, { color: '#a78bfa' }]}>Studio</Text>
            </View>
            <View style={[styles.hubPillarChip, { backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.2)' }]}>
              <Ionicons name="people" size={12} color="#34d399" />
              <Text style={[styles.hubPillarLabel, { color: '#34d399' }]}>Masterminds</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <TouchableOpacity 
        style={styles.dashboardButton}
        onPress={() => router.push('/founder-hub' as any)}
        activeOpacity={0.8}
      >
        <View style={styles.dashboardButtonInner}>
          <Text style={styles.dashboardButtonText}>Enter Founder Hub</Text>
          <View style={styles.dashboardButtonIcon}>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: '#141414',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.xl,
    right: Spacing.xl,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  cashContainer: {
    padding: Spacing.md,
  },
  premiumCardWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.2)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  cashHero: {
    borderRadius: BorderRadius.lg - 1,
    padding: Spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  heroGlowAccent: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
  },
  heroMesh: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundColor: 'transparent',
  },
  cashHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  walletIconOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  walletIconGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },
  walletIconInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 172, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  trendBadgePositive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  trendBadgeNegative: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  trendText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cashAmountLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: '#A1A1AA',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hubHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    lineHeight: 22,
  },
  hubSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    marginBottom: 16,
    lineHeight: 17,
  },
  hubPillarsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  hubPillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  hubPillarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  hubPillarCount: {
    fontSize: 10,
    color: '#A1A1AA',
  },
  cashAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: Spacing.lg,
  },
  projectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  projectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4facfe',
  },
  projectedLabel: {
    fontSize: Typography.small.fontSize,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  projectedAmount: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: '#4facfe',
    marginLeft: 'auto',
  },
  flowSection: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  flowCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  flowIconWrapper: {
    
  },
  flowContent: {
    flex: 1,
  },
  flowIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inflowBg: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  outflowBg: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  flowTitle: {
    fontSize: Typography.micro.fontSize,
    color: '#A1A1AA',
    fontWeight: '500',
    marginBottom: 2,
  },
  flowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34c759',
    flexShrink: 0,
  },
  flowAmountOut: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff3b30',
    flexShrink: 0,
  },
  flowDivider: {
    width: 1,
    backgroundColor: '#2C2C2E',
    marginHorizontal: Spacing.md,
  },
  dashboardButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
  },
  dashboardButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dashboardButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.2,
  },
  dashboardButtonIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(79, 172, 254, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stageItem: {
    width: '30%',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  stageName: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.secondary,
  },
  stageCount: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.cyan,
    borderRadius: 2,
  },
  progressComplete: {
    backgroundColor: Colors.semantic.success,
  },
  connector: {
    position: 'absolute',
    right: -12,
    top: 8,
  },
  hubContainer: {
    padding: Spacing.md,
  },
  hubCardWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  hubHero: {
    borderRadius: BorderRadius.lg - 1,
    padding: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  hubGlowPrimary: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  hubGlowSecondary: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
  },
  hubGlowAccent: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  hubHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  hubLogoWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hubLogoGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  hubLogoInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubPriorityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  hubPriorityText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#a78bfa',
    letterSpacing: 0.2,
  },
  hubLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: '#A1A1AA',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  focusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  focusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#1C1C1E',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  focusBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBadgeName: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  focusBadgeNumber: {
    fontSize: Typography.small.fontSize,
    fontWeight: '700',
  },
  focusBadgeBright: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#242426',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: '#3C3C3E',
  },
  focusBadgeIconBright: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBadgeNameBright: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  focusBadgeNumberBright: {
    fontSize: Typography.small.fontSize,
    fontWeight: '700',
  },
  hubDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: Spacing.md,
  },
  hubPreparedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hubPreparedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubPreparedText: {
    fontSize: Typography.small.fontSize,
    color: '#D4D4D8',
    fontWeight: '500',
  },
  hubButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  hubButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  hubButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.2,
  },
  hubButtonIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
