import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { dailyBrief } from '@/data/founderHub/palletMock';
import { getHubImage } from '@/data/founderHub/imageHelper';

const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#111111',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.12)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.70)',
    muted: 'rgba(255,255,255,0.45)',
  },
};

const pastBriefs = [
  { id: '1', date: '2026-01-21', title: 'Fuel costs are climbing—hedge with Q2 contracts now', read: true },
  { id: '2', date: '2026-01-20', title: 'Your top customer hasn\'t reordered in 14 days', read: true },
  { id: '3', date: '2026-01-19', title: 'Competitor pricing dropped 8% on Grade B pallets', read: false },
  { id: '4', date: '2026-01-18', title: 'Cash position strong—consider equipment upgrade', read: true },
  { id: '5', date: '2026-01-17', title: 'New EPA regulations coming for treated lumber', read: false },
];

const aiInsights = [
  { id: '1', icon: 'trending-up-outline' as const, title: 'Revenue Opportunity', desc: 'Lumber prices are at 6-month lows. Lock in Q2 supply now for 12% margin boost.' },
  { id: '2', icon: 'warning-outline' as const, title: 'Risk Alert', desc: 'ABC Logistics payment is 8 days overdue. Consider follow-up before Friday.' },
  { id: '3', icon: 'bulb-outline' as const, title: 'Strategic Insight', desc: 'Your repair-grade pallets outperform new sales by 23%. Consider expansion.' },
];

export default function DailyBriefScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>Past Briefs</Text>
      <View style={styles.pastBriefsList}>
        {pastBriefs.map((brief) => (
          <Pressable
            key={brief.id}
            style={[
              styles.pastBriefItem,
              hoveredItem === `brief-${brief.id}` && styles.pastBriefItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`brief-${brief.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.pastBriefLeft}>
              <Text style={styles.pastBriefDate}>{formatShortDate(brief.date)}</Text>
              {!brief.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.pastBriefTitle} numberOfLines={2}>{brief.title}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>AI Insights</Text>
      <View style={styles.insightsList}>
        {aiInsights.map((insight) => (
          <View key={insight.id} style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <Ionicons name={insight.icon} size={16} color={THEME.accent} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDesc}>{insight.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Daily Brief</Text>
        <Text style={styles.pageSubtitle}>AI-curated intelligence for your business</Text>
      </View>

      <View style={styles.todayCard}>
        <ImageBackground
          source={getHubImage(dailyBrief.imageKey)}
          style={styles.heroImage}
          imageStyle={styles.heroImageStyle}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.98)']}
            style={styles.heroOverlay}
          >
            <View style={styles.todayBadge}>
              <Ionicons name="sunny" size={14} color={THEME.accent} />
              <Text style={styles.todayBadgeText}>Today's Brief</Text>
            </View>
            <Text style={styles.heroDate}>{formatDate(dailyBrief.date)}</Text>
            <Text style={styles.heroTitle}>{dailyBrief.title}</Text>
            
            <View style={styles.bulletsList}>
              {dailyBrief.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.whyMatters}>{dailyBrief.whyItMatters}</Text>

            <View style={styles.heroActions}>
              <Pressable
                style={[styles.primaryBtn, hoveredItem === 'discuss' && styles.primaryBtnHover]}
                onHoverIn={() => setHoveredItem('discuss')}
                onHoverOut={() => setHoveredItem(null)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Discuss with Ava</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, hoveredItem === 'save' && styles.secondaryBtnHover]}
                onHoverIn={() => setHoveredItem('save')}
                onHoverOut={() => setHoveredItem(null)}
              >
                <Ionicons name="bookmark-outline" size={16} color={THEME.accent} />
                <Text style={styles.secondaryBtnText}>Save takeaway</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Metrics Today</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Cash Position</Text>
            <Text style={styles.metricValue}>$127,450</Text>
            <Text style={[styles.metricChange, { color: '#34d399' }]}>+$4,200 today</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Open Orders</Text>
            <Text style={styles.metricValue}>23</Text>
            <Text style={styles.metricChange}>5 shipping today</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Receivables</Text>
            <Text style={styles.metricValue}>$42,800</Text>
            <Text style={[styles.metricChange, { color: '#fbbf24' }]}>2 overdue</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Inventory</Text>
            <Text style={styles.metricValue}>1,240</Text>
            <Text style={styles.metricChange}>pallets in stock</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Focus Areas</Text>
        <View style={styles.focusGrid}>
          <Pressable
            style={[styles.focusCard, hoveredItem === 'focus-1' && styles.focusCardHover]}
            onHoverIn={() => setHoveredItem('focus-1')}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={[styles.focusIcon, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="call-outline" size={20} color={THEME.accent} />
            </View>
            <Text style={styles.focusTitle}>Follow up with ABC Logistics</Text>
            <Text style={styles.focusDesc}>Overdue payment of $4,200</Text>
          </Pressable>
          <Pressable
            style={[styles.focusCard, hoveredItem === 'focus-2' && styles.focusCardHover]}
            onHoverIn={() => setHoveredItem('focus-2')}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={[styles.focusIcon, { backgroundColor: 'rgba(251, 191, 36, 0.12)' }]}>
              <Ionicons name="pricetag-outline" size={20} color="#fbbf24" />
            </View>
            <Text style={styles.focusTitle}>Review Grade B pricing</Text>
            <Text style={styles.focusDesc}>Competitor undercut by 8%</Text>
          </Pressable>
          <Pressable
            style={[styles.focusCard, hoveredItem === 'focus-3' && styles.focusCardHover]}
            onHoverIn={() => setHoveredItem('focus-3')}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={[styles.focusIcon, { backgroundColor: 'rgba(52, 211, 153, 0.12)' }]}>
              <Ionicons name="cube-outline" size={20} color="#34d399" />
            </View>
            <Text style={styles.focusTitle}>Lock in lumber supply</Text>
            <Text style={styles.focusDesc}>Prices at 6-month low</Text>
          </Pressable>
        </View>
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: THEME.text.muted,
  },
  todayCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  heroImage: {
    width: '100%',
    minHeight: 380,
  },
  heroImageStyle: {
    borderRadius: 16,
  },
  heroOverlay: {
    flex: 1,
    padding: 32,
    justifyContent: 'flex-end',
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroDate: {
    fontSize: 13,
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: THEME.text.primary,
    lineHeight: 34,
    marginBottom: 20,
    maxWidth: 600,
  },
  bulletsList: {
    gap: 12,
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.accent,
    marginTop: 7,
  },
  bulletText: {
    fontSize: 15,
    color: THEME.text.secondary,
    lineHeight: 22,
    flex: 1,
  },
  whyMatters: {
    fontSize: 14,
    color: THEME.text.muted,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnHover: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  secondaryBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.accent,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 13,
    color: THEME.text.muted,
  },
  focusGrid: {
    gap: 12,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  focusCardHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  focusIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 2,
  },
  focusDesc: {
    fontSize: 13,
    color: THEME.text.muted,
  },
  railContent: {
    gap: 24,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pastBriefsList: {
    gap: 8,
  },
  pastBriefItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: THEME.surface,
  },
  pastBriefItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  pastBriefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  pastBriefDate: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.accent,
  },
  pastBriefTitle: {
    flex: 1,
    fontSize: 13,
    color: THEME.text.secondary,
    lineHeight: 18,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  insightsList: {
    gap: 12,
  },
  insightCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: THEME.surface,
    borderRadius: 10,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 4,
  },
  insightDesc: {
    fontSize: 12,
    color: THEME.text.muted,
    lineHeight: 16,
  },
});
