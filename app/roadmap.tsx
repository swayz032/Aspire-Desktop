import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { getSuiteProfile } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';

// AI workforce — static config, not DB rows (these are governed skill pack workers)
const STAFF_ROSTER = [
  { id: 'staff-ava', name: 'Ava', role: 'Orchestrator', avatar: '', status: 'active' },
  { id: 'staff-eli', name: 'Eli', role: 'Inbox Manager', avatar: '', status: 'active' },
  { id: 'staff-quinn', name: 'Quinn', role: 'Invoicing', avatar: '', status: 'active' },
  { id: 'staff-nora', name: 'Nora', role: 'Conference', avatar: '', status: 'active' },
  { id: 'staff-adam', name: 'Adam', role: 'Research', avatar: '', status: 'active' },
  { id: 'staff-tec', name: 'Tec', role: 'Documents', avatar: '', status: 'active' },
  { id: 'staff-finn', name: 'Finn', role: 'Money Desk', avatar: '', status: 'active' },
  { id: 'staff-milo', name: 'Milo', role: 'Payroll', avatar: '', status: 'active' },
  { id: 'staff-teressa', name: 'Teressa', role: 'Bookkeeping', avatar: '', status: 'active' },
  { id: 'staff-clara', name: 'Clara', role: 'Legal', avatar: '', status: 'active' },
  { id: 'staff-sarah', name: 'Sarah', role: 'Front Desk', avatar: '', status: 'active' },
];

export default function RoadmapScreen() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const [score, setScore] = useState<any>({
    overall: 0,
    revenue: 0,
    cashFlow: 0,
    efficiency: 0,
    compliance: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
    accounts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSuiteProfile()
      .then((profile: any) => {
        setScore({
          overall: profile?.business_score ?? 0,
          revenue: profile?.revenue_score ?? 0,
          cashFlow: profile?.cash_flow_score ?? 0,
          efficiency: profile?.efficiency_score ?? 0,
          compliance: profile?.compliance_score ?? 0,
          monthlyRevenue: profile?.monthly_revenue ?? 0,
          monthlyExpenses: profile?.monthly_expenses ?? 0,
          netProfit: (profile?.monthly_revenue ?? 0) - (profile?.monthly_expenses ?? 0),
          accounts: profile?.accounts ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
  };

  const formatCurrencyFull = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStaffColor = (staffName?: string) => {
    const staff = STAFF_ROSTER.find(s => s.name === staffName);
    return (staff as any)?.avatarColor || '#3B82F6';
  };

  const totalOpportunityValue = (score.hiddenOpportunities ?? []).reduce((sum: number, opp: any) => sum + opp.dollarValue, 0);
  const totalTimeSavings = (score.efficiencyWins ?? []).reduce((sum: number, eff: any) => sum + eff.potentialSavingsHours, 0);

  const content = (
    <View style={styles.container}>
      {!isDesktop && (
        <View style={styles.customHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerBrand}>
            <View style={styles.headerLogoWrapper}>
              <View style={styles.headerLogoInner}>
                <Ionicons name="arrow-up" size={16} color="#3B82F6" />
              </View>
            </View>
            <View style={styles.headerDivider} />
            <Text style={styles.headerTitle}>Aspire Roadmap</Text>
          </View>
        </View>
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.valueHero}>
          <LinearGradient
            colors={['rgba(79, 172, 254, 0.12)', 'rgba(79, 172, 254, 0.06)', 'rgba(52, 199, 89, 0.04)', 'transparent']}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.valueHeroGradient}
          >
            <View style={styles.valueHeroHeader}>
              <View style={styles.valueHeroIcon}>
                <Ionicons name="analytics" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.valueHeroTitle}>Business Intelligence</Text>
                <Text style={styles.valueHeroSubtitle}>Actionable insights and revenue operations</Text>
              </View>
            </View>

            <View style={styles.valueMetrics}>
              <View style={styles.valueMetric}>
                <Text style={styles.valueMetricNumber}>{formatCurrency(score.cumulativeValue.totalRevenueSaved)}</Text>
                <Text style={styles.valueMetricLabel}>Revenue Secured</Text>
              </View>
              <View style={styles.valueMetricDivider} />
              <View style={styles.valueMetric}>
                <Text style={styles.valueMetricNumber}>{score.cumulativeValue.totalHoursSaved}h</Text>
                <Text style={styles.valueMetricLabel}>Operational Efficiency</Text>
              </View>
              <View style={styles.valueMetricDivider} />
              <View style={styles.valueMetric}>
                <Text style={styles.valueMetricNumber}>{score.cumulativeValue.daysSinceOnboarding}</Text>
                <Text style={styles.valueMetricLabel}>Days Active</Text>
              </View>
            </View>

            <View style={styles.sinceLastVisit}>
              <Text style={styles.sinceLastVisitLabel}>Recent performance:</Text>
              <View style={styles.sinceLastVisitStats}>
                <View style={styles.deltaChip}>
                  <Ionicons name="trending-up" size={12} color="#34c759" />
                  <Text style={styles.deltaChipText}>{formatCurrency(score.cumulativeValue.lastVisitDelta.revenueCollected)} collected</Text>
                </View>
                <View style={styles.deltaChip}>
                  <Ionicons name="mail-outline" size={12} color="#3B82F6" />
                  <Text style={styles.deltaChipText}>{score.cumulativeValue.lastVisitDelta.emailsCleared} items processed</Text>
                </View>
                <View style={styles.deltaChip}>
                  <Ionicons name="checkmark-circle-outline" size={12} color="#af52de" />
                  <Text style={styles.deltaChipText}>{score.cumulativeValue.lastVisitDelta.approvalsCompleted} completed</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="wallet" size={18} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Revenue Recovery</Text>
            </View>
            <View style={styles.sectionValueBadge}>
              <Text style={styles.sectionValueText}>{formatCurrency(totalOpportunityValue)} recoverable</Text>
            </View>
          </View>
          
          {(score.hiddenOpportunities ?? []).map((opp: any) => {
            const staffColor = getStaffColor(opp.staffOwner);
            return (
              <Card key={opp.id} variant="elevated" style={styles.opportunityCard}>
                <View style={styles.opportunityContent}>
                  <View style={styles.opportunityLeft}>
                    <View style={[styles.opportunityTypeIcon, { backgroundColor: `${staffColor}15` }]}>
                      <Ionicons 
                        name={opp.type === 'unbilled' ? 'document-text' : opp.type === 'overdue' ? 'time' : opp.type === 'expired_quote' ? 'pricetag' : 'arrow-up-circle'} 
                        size={16} 
                        color={staffColor} 
                      />
                    </View>
                    <View style={styles.opportunityInfo}>
                      <Text style={styles.opportunityTitle}>{opp.title}</Text>
                      <Text style={styles.opportunityDescription}>{opp.description}</Text>
                      <View style={styles.opportunityMeta}>
                        <View style={[styles.staffBadge, { backgroundColor: `${staffColor}15` }]}>
                          <View style={[styles.staffAvatar, { backgroundColor: staffColor }]}>
                            <Text style={styles.staffInitial}>{opp.staffOwner[0]}</Text>
                          </View>
                          <Text style={[styles.staffName, { color: staffColor }]}>{opp.staffOwner}</Text>
                        </View>
                        {opp.daysOld && (
                          <Text style={styles.opportunityAge}>{opp.daysOld} days</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.opportunityRight}>
                    <Text style={styles.opportunityValue}>{formatCurrency(opp.dollarValue)}</Text>
                    <TouchableOpacity style={styles.opportunityAction}>
                      <Text style={styles.opportunityActionText}>{opp.action}</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="rocket" size={18} color="#af52de" />
              <Text style={styles.sectionTitle}>Growth Forecast</Text>
            </View>
            <View style={[styles.sectionValueBadge, { backgroundColor: 'rgba(175, 82, 222, 0.1)' }]}>
              <Text style={[styles.sectionValueText, { color: '#af52de' }]}>+{score.growthForecast.momentum}% momentum</Text>
            </View>
          </View>

          <Card variant="elevated" style={styles.forecastCard}>
            <View style={styles.forecastHeader}>
              <View style={styles.forecastMetric}>
                <Text style={styles.forecastLabel}>Current Monthly</Text>
                <Text style={styles.forecastCurrent}>{formatCurrencyFull(score.growthForecast.currentMonthlyRevenue)}</Text>
              </View>
              <View style={styles.forecastArrow}>
                <Ionicons name="arrow-forward" size={20} color="#af52de" />
              </View>
              <View style={styles.forecastMetric}>
                <Text style={styles.forecastLabel}>Projected</Text>
                <Text style={styles.forecastProjected}>{formatCurrencyFull(score.growthForecast.projectedMonthlyRevenue)}</Text>
                <Text style={styles.forecastDate}>by {score.growthForecast.projectedDate}</Text>
              </View>
            </View>

            <View style={styles.forecastProgress}>
              <View style={styles.forecastProgressTrack}>
                <LinearGradient
                  colors={['#af52de', '#5856d6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.forecastProgressFill, { width: `${(score.growthForecast.currentMonthlyRevenue / score.growthForecast.projectedMonthlyRevenue) * 100}%` }]}
                />
              </View>
            </View>

            <View style={styles.pipelineStats}>
              <View style={styles.pipelineStat}>
                <Text style={styles.pipelineStatValue}>{formatCurrency(score.growthForecast.pipelineValue)}</Text>
                <Text style={styles.pipelineStatLabel}>in pipeline</Text>
              </View>
              <View style={styles.pipelineStat}>
                <Text style={styles.pipelineStatValue}>{score.growthForecast.dealsToClose}</Text>
                <Text style={styles.pipelineStatLabel}>deals to close</Text>
              </View>
            </View>
          </Card>

          <Text style={styles.scenariosTitle}>If you take action:</Text>
          {(score.growthForecast?.scenarios ?? []).map((scenario: any) => (
            <View key={scenario.id} style={styles.scenarioCard}>
              <View style={styles.scenarioLeft}>
                <View style={styles.scenarioCondition}>
                  <Text style={styles.scenarioConditionText}>{scenario.condition}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.text.muted} />
                  <Text style={styles.scenarioResultText}>{scenario.result}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.scenarioAction}>
                <Text style={styles.scenarioActionText}>{scenario.action}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="speedometer" size={18} color="#34c759" />
              <Text style={styles.sectionTitle}>Operational Efficiency</Text>
            </View>
            <View style={[styles.sectionValueBadge, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
              <Text style={[styles.sectionValueText, { color: '#34c759' }]}>{totalTimeSavings.toFixed(0)}h/week potential</Text>
            </View>
          </View>

          {(score.efficiencyWins ?? []).map((eff: any) => {
            const staffColor = getStaffColor(eff.staffOwner);
            const savingsPercent = (eff.potentialSavingsHours / eff.currentHoursPerWeek) * 100;
            return (
              <Card key={eff.id} variant="elevated" style={styles.efficiencyCard}>
                <View style={styles.efficiencyHeader}>
                  <View style={styles.efficiencyInfo}>
                    <Text style={styles.efficiencyTitle}>{eff.title}</Text>
                    <View style={styles.efficiencyStats}>
                      <Text style={styles.efficiencyCurrentTime}>{eff.currentHoursPerWeek}h/week currently</Text>
                      <Ionicons name="arrow-forward" size={12} color={Colors.text.muted} />
                      <Text style={styles.efficiencySavedTime}>{eff.potentialSavingsHours}h saved</Text>
                    </View>
                  </View>
                  <View style={styles.efficiencyRight}>
                    <Text style={styles.efficiencyPercent}>{eff.automationPercent}%</Text>
                    <Text style={styles.efficiencyPercentLabel}>automatable</Text>
                  </View>
                </View>
                <View style={styles.efficiencyProgressBar}>
                  <View style={[styles.efficiencyProgressFill, { width: `${savingsPercent}%` }]} />
                </View>
                <View style={styles.efficiencyFooter}>
                  <View style={[styles.staffBadge, { backgroundColor: `${staffColor}15` }]}>
                    <View style={[styles.staffAvatar, { backgroundColor: staffColor }]}>
                      <Text style={styles.staffInitial}>{eff.staffOwner[0]}</Text>
                    </View>
                    <Text style={[styles.staffName, { color: staffColor }]}>{eff.staffOwner} can handle this</Text>
                  </View>
                  <TouchableOpacity style={styles.efficiencyAction}>
                    <Text style={styles.efficiencyActionText}>{eff.action}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bar-chart" size={18} color="#ff9500" />
              <Text style={styles.sectionTitle}>Performance Metrics</Text>
            </View>
          </View>
          <Text style={styles.benchmarkSubtitle}>Industry comparison analysis</Text>

          {(score.benchmarks ?? []).map((bench: any) => {
            const userPercent = (bench.userValue / bench.topPerformers) * 100;
            const industryPercent = (bench.industryAverage / bench.topPerformers) * 100;
            const isWorseIsHigher = bench.unit === 'days' || bench.unit === 'hours';
            const isBetter = isWorseIsHigher ? bench.userValue < bench.industryAverage : bench.userValue > bench.industryAverage;
            
            return (
              <Card key={bench.id} variant="elevated" style={styles.benchmarkCard}>
                <View style={styles.benchmarkHeader}>
                  <Text style={styles.benchmarkName}>{bench.name}</Text>
                  <View style={[styles.benchmarkStatus, isBetter ? styles.benchmarkGood : styles.benchmarkNeedsWork]}>
                    <Ionicons 
                      name={isBetter ? 'checkmark-circle' : 'alert-circle'} 
                      size={12} 
                      color={isBetter ? '#34c759' : '#ff9500'} 
                    />
                    <Text style={[styles.benchmarkStatusText, { color: isBetter ? '#34c759' : '#ff9500' }]}>
                      {isBetter ? 'On track' : 'Needs attention'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.benchmarkValues}>
                  <View style={styles.benchmarkValue}>
                    <Text style={styles.benchmarkValueNumber}>{bench.userValue}{bench.unit === '%' ? '%' : ''}</Text>
                    <Text style={styles.benchmarkValueLabel}>You{bench.unit !== '%' ? ` ${bench.unit}` : ''}</Text>
                  </View>
                  <View style={styles.benchmarkValue}>
                    <Text style={styles.benchmarkValueNumber}>{bench.industryAverage}{bench.unit === '%' ? '%' : ''}</Text>
                    <Text style={styles.benchmarkValueLabel}>Industry avg</Text>
                  </View>
                  <View style={styles.benchmarkValue}>
                    <Text style={[styles.benchmarkValueNumber, styles.benchmarkTopValue]}>{bench.topPerformers}{bench.unit === '%' ? '%' : ''}</Text>
                    <Text style={styles.benchmarkValueLabel}>Top performers</Text>
                  </View>
                </View>

                <View style={styles.benchmarkBarContainer}>
                  <View style={styles.benchmarkBar}>
                    <View style={[styles.benchmarkUserMarker, { left: `${Math.min(userPercent, 100)}%` }]}>
                      <View style={styles.benchmarkMarkerDot} />
                      <Text style={styles.benchmarkMarkerLabel}>You</Text>
                    </View>
                    <View style={[styles.benchmarkIndustryMarker, { left: `${Math.min(industryPercent, 100)}%` }]} />
                  </View>
                </View>

                <TouchableOpacity style={styles.benchmarkAction}>
                  <Text style={styles.benchmarkActionText}>{bench.action}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.accent.cyan} />
                </TouchableOpacity>
              </Card>
            );
          })}
        </View>

        <View style={styles.section}>
          <Card variant="elevated" style={styles.growthSummaryCard}>
            <LinearGradient
              colors={['rgba(79, 172, 254, 0.1)', 'rgba(175, 82, 222, 0.05)']}
              style={styles.growthSummaryGradient}
            >
              <View style={styles.growthSummaryHeader}>
                <View style={styles.growthSummaryIcon}>
                  <Ionicons name="pulse" size={24} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.growthSummaryTitle}>Cumulative Impact</Text>
                  <Text style={styles.growthSummarySubtitle}>{score.cumulativeValue.daysSinceOnboarding} days of operations</Text>
                </View>
              </View>

              <View style={styles.cumulativeStats}>
                <View style={styles.cumulativeStat}>
                  <Text style={styles.cumulativeStatValue}>{formatCurrency(score.cumulativeValue.totalRevenueSaved)}</Text>
                  <Text style={styles.cumulativeStatLabel}>Total revenue impact</Text>
                </View>
                <View style={styles.cumulativeStat}>
                  <Text style={styles.cumulativeStatValue}>{score.cumulativeValue.totalHoursSaved}h</Text>
                  <Text style={styles.cumulativeStatLabel}>Total hours saved</Text>
                </View>
              </View>

              <View style={styles.capabilitiesSection}>
                <Text style={styles.capabilitiesTitle}>Active capabilities:</Text>
                <View style={styles.capabilitiesList}>
                  {(score.cumulativeValue?.capabilitiesUnlocked ?? []).map((cap: string, index: number) => (
                    <View key={index} style={styles.capabilityChip}>
                      <Ionicons name="checkmark-circle" size={12} color="#34c759" />
                      <Text style={styles.capabilityText}>{cap}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </LinearGradient>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time" size={18} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
          </View>
          
          <Card variant="elevated" style={styles.activityCard}>
            {(score.recentActivity ?? []).map((activity: any, index: number) => {
              const staffColor = getStaffColor(activity.staffOwner);
              const isLast = index === score.recentActivity.length - 1;
              return (
                <View key={activity.id} style={[styles.activityItem, !isLast && styles.activityItemBorder]}>
                  <View style={[styles.activityIconWrapper, { backgroundColor: `${staffColor}15` }]}>
                    <View style={[styles.activityAvatar, { backgroundColor: staffColor }]}>
                      <Text style={styles.activityAvatarText}>{activity.staffOwner[0]}</Text>
                    </View>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityAction}>{activity.action}</Text>
                    <Text style={styles.activityDescription}>{activity.description}</Text>
                  </View>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityTimestamp}>{activity.timestamp}</Text>
                    <Text style={styles.activityStaff}>{activity.staffOwner}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

      </ScrollView>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopPageWrapper scrollable={false}>
        {content}
      </DesktopPageWrapper>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    paddingTop: 110,
    paddingBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLogoWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.subtle,
  },
  headerTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  valueHero: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.2)',
    backgroundColor: Colors.background.elevated,
  },
  valueHeroGradient: {
    padding: Spacing.xl,
  },
  valueHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  valueHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueHeroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  valueHeroSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  valueMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.lg,
  },
  valueMetric: {
    alignItems: 'center',
  },
  valueMetricNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  valueMetricLabel: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginTop: 4,
    fontWeight: '500',
  },
  valueMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sinceLastVisit: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sinceLastVisitLabel: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
    fontWeight: '500',
  },
  sinceLastVisitStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  deltaChipText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  sectionValueBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  sectionValueText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
    color: '#f59e0b',
  },
  opportunityCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  opportunityContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opportunityLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: Spacing.md,
  },
  opportunityTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunityInfo: {
    flex: 1,
  },
  opportunityTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  opportunityDescription: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  opportunityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  staffAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  staffName: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '500',
  },
  opportunityAge: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  opportunityRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  opportunityValue: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: '#f59e0b',
  },
  opportunityAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  opportunityActionText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  forecastCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  forecastMetric: {
    flex: 1,
  },
  forecastLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  forecastCurrent: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  forecastArrow: {
    paddingHorizontal: Spacing.lg,
  },
  forecastProjected: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: '#af52de',
  },
  forecastDate: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginTop: 2,
  },
  forecastProgress: {
    marginBottom: Spacing.lg,
  },
  forecastProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  forecastProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  pipelineStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  pipelineStat: {
    alignItems: 'center',
  },
  pipelineStatValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pipelineStatLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  scenariosTitle: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scenarioLeft: {
    flex: 1,
  },
  scenarioCondition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  scenarioConditionText: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.secondary,
  },
  scenarioResultText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#34c759',
  },
  scenarioAction: {
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  scenarioActionText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  efficiencyCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  efficiencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  efficiencyInfo: {
    flex: 1,
  },
  efficiencyTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  efficiencyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  efficiencyCurrentTime: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
  },
  efficiencySavedTime: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#34c759',
  },
  efficiencyRight: {
    alignItems: 'flex-end',
  },
  efficiencyPercent: {
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
    color: '#34c759',
  },
  efficiencyPercentLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
  efficiencyProgressBar: {
    height: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  efficiencyProgressFill: {
    height: '100%',
    backgroundColor: '#34c759',
    borderRadius: 2,
  },
  efficiencyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  efficiencyAction: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  efficiencyActionText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#34c759',
  },
  benchmarkSubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  benchmarkCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  benchmarkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  benchmarkName: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  benchmarkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  benchmarkGood: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  benchmarkNeedsWork: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  benchmarkStatusText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '500',
  },
  benchmarkValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  benchmarkValue: {
    alignItems: 'center',
  },
  benchmarkValueNumber: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  benchmarkTopValue: {
    color: '#34c759',
  },
  benchmarkValueLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginTop: 2,
  },
  benchmarkBarContainer: {
    marginBottom: Spacing.md,
  },
  benchmarkBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    position: 'relative',
  },
  benchmarkUserMarker: {
    position: 'absolute',
    top: -16,
    alignItems: 'center',
    transform: [{ translateX: -12 }],
  },
  benchmarkMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginBottom: 2,
  },
  benchmarkMarkerLabel: {
    fontSize: 9,
    color: '#3B82F6',
    fontWeight: '600',
  },
  benchmarkIndustryMarker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  benchmarkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  benchmarkActionText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  growthSummaryCard: {
    overflow: 'hidden',
  },
  growthSummaryGradient: {
    padding: Spacing.lg,
  },
  growthSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  growthSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 172, 254, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthSummaryTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  growthSummarySubtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  cumulativeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cumulativeStat: {
    alignItems: 'center',
  },
  cumulativeStatValue: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
    color: '#3B82F6',
  },
  cumulativeStatLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginTop: 2,
  },
  capabilitiesSection: {},
  capabilitiesTitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  capabilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  capabilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  capabilityText: {
    fontSize: Typography.micro.fontSize,
    color: '#34c759',
    fontWeight: '500',
  },
  activityCard: {
    padding: 0,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  activityIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  activityTimestamp: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginBottom: 2,
  },
  activityStaff: {
    fontSize: Typography.micro.fontSize,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
});
