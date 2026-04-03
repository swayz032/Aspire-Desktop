import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { DocumentThumbnail } from './DocumentThumbnail';
import { useRouter } from 'expo-router';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSupabase } from '@/providers';

const calendarHero = require('../assets/images/calendar-hero.jpg');

interface TodayPlanItem {
  id: string;
  time: string;
  action: string;
  details: string;
  status: string;
  staffRole: string;
  documents?: any[];
  _type?: 'calendar' | 'approval';
}


function TodayPlanTabsInner({ planItems }: { planItems: TodayPlanItem[] }) {
  const router = useRouter();
  const { session } = useSupabase();
  const displayedPlan = planItems.slice(0, 4);
  const [isInboxSetup, setIsInboxSetup] = useState<boolean | null>(null);

  useEffect(() => {
    // Wait for session to be available before checking onboarding status
    if (!session?.access_token) return;
    const checkOnboarding = async () => {
      try {
        const resp = await fetch('/api/onboarding/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setIsInboxSetup(!!data.inbox_configured || !!data.email_connected);
        }
      } catch {
        // Silent fail — show CTA as fallback
      }
    };
    checkOnboarding();
  }, [session?.access_token]);

  return (
    <Card variant="elevated" style={styles.container}>
      {displayedPlan.length > 0 ? (
        <TodayPlanContent items={displayedPlan} router={router} />
      ) : isInboxSetup ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sunny-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
          <Text style={styles.emptyHeadline}>Your plan builds as your day progresses</Text>
          <Text style={styles.emptyBody}>
            Incoming emails, calls, and invoices will populate your action list here.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="sunny-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
          <Text style={styles.emptyHeadline}>Your morning plan builds itself</Text>
          <Text style={styles.emptyBody}>
            As your inbox, calls, and invoices are processed — your daily action list appears here. Start by connecting your first service.
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => router.push('/inbox/setup' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyCtaText}>Set up your inbox</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

function TodayPlanContent({ items, router }: { items: TodayPlanItem[]; router: any }) {
  const getBarColor = (item: TodayPlanItem) => {
    if (item.status === 'next') return Colors.accent.cyan;
    if (item._type === 'approval') return Colors.semantic.warning;
    return '#8B5CF6';
  };

  return (
    <View style={styles.planContainer}>
      {items.map((planItem, index) => {
        const isCalendar = planItem._type === 'calendar';
        const isApproval = planItem._type === 'approval';
        const barColor = getBarColor(planItem);
        const timeNum = planItem.time.split(':')[0].replace(/^0/, '') + ':' + (planItem.time.split(':')[1] || '00').replace(/ .*/,'');
        const timePeriod = planItem.time.includes('PM') ? 'PM' : planItem.time.includes('AM') ? 'AM' : '';

        return (
          <View key={planItem.id} style={[styles.planItem, index > 0 && styles.planItemBorder]}>
            {/* Time slot on the left */}
            <View style={styles.timeCol}>
              <Text style={[styles.timeNum, planItem.status === 'next' && styles.timeNumActive]}>
                {timeNum}
              </Text>
              <Text style={styles.timePeriod}>{timePeriod}</Text>
            </View>

            {/* Colored bar */}
            <View style={[styles.itemBar, { backgroundColor: barColor }]} />

            {/* Content card */}
            <View style={styles.itemContent}>
              {/* Hero image for calendar tasks */}
              {isCalendar && (
                <View style={styles.heroImageContainer}>
                  <Image source={calendarHero} style={styles.heroImage} resizeMode="cover" />
                  <View style={styles.heroOverlay} />
                  <View style={styles.heroTextOverlay}>
                    <Text style={styles.heroTitle} numberOfLines={1}>{planItem.action}</Text>
                    {planItem.details ? (
                      <Text style={styles.heroSubtitle} numberOfLines={1}>{planItem.details}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Document card for approvals */}
              {isApproval && planItem.documents && planItem.documents.length > 0 && (
                <View style={styles.docRow}>
                  {planItem.documents.slice(0, 1).map((doc: any, docIndex: number) => (
                    <View key={docIndex} style={styles.docPreviewCard}>
                      <DocumentThumbnail
                        type={doc.type || 'invoice'}
                        size="xl"
                        variant={docIndex}
                        context="todayplan"
                      />
                      <View style={styles.docPreviewMeta}>
                        <Text style={styles.docName} numberOfLines={1}>{doc.name?.split(' - ')[0]}</Text>
                        {doc.amount && <Text style={styles.docAmount}>{doc.amount}</Text>}
                        {doc.value && <Text style={styles.docValue}>{doc.value}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Text details (always shown for approvals, shown below hero for calendar without image) */}
              {!isCalendar && (
                <View style={styles.textDetails}>
                  <Text style={styles.planAction}>{planItem.action}</Text>
                  <Text style={styles.planSubAction} numberOfLines={2}>{planItem.details}</Text>
                </View>
              )}

              {/* Status badge */}
              {planItem.status === 'next' && (
                <View style={styles.nextBadge}>
                  <Text style={styles.nextBadgeText}>NEXT</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 180,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  emptyStateIcon: {
    marginBottom: 8,
  },
  emptyHeadline: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyBody: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  emptyCta: {
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  emptyCtaText: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  planContainer: {
    padding: Spacing.sm,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.sm,
    minHeight: 80,
  },
  planItemBorder: {},
  timeCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Spacing.xs,
  },
  timeNum: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: -0.5,
  },
  timeNumActive: {
    color: Colors.accent.cyan,
  },
  timePeriod: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  itemBar: {
    width: 3,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  itemContent: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroImageContainer: {
    height: 100,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroTextOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  heroSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  textDetails: {
    padding: Spacing.sm,
  },
  planAction: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
  },
  planSubAction: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  nextBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  nextBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.8,
  },
  docRow: {
    padding: Spacing.sm,
  },
  docPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  docPreviewMeta: {
    maxWidth: 80,
  },
  docName: {
    color: Colors.text.secondary,
    fontSize: Typography.micro.fontSize,
    fontWeight: '500',
  },
  docAmount: {
    color: Colors.semantic.success,
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
    marginTop: 1,
  },
  docValue: {
    color: Colors.accent.cyan,
    fontSize: Typography.micro.fontSize,
    fontWeight: '500',
    marginTop: 1,
  },
});

export function TodayPlanTabs(props: any) {
  return (
    <PageErrorBoundary pageName="today-plan-tabs">
      <TodayPlanTabsInner {...props} />
    </PageErrorBoundary>
  );
}
