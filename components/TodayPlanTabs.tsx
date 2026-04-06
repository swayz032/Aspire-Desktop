import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { DocumentThumbnail } from './DocumentThumbnail';
import { useRouter } from 'expo-router';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSupabase } from '@/providers';

// Photo thumbnails for non-document item types
const PHOTO_THUMBNAILS: Record<string, any> = {
  calendar: require('../assets/images/calendar-hero.jpg'),
  call: require('../assets/images/plan-call.jpg'),
  email: require('../assets/images/calls-hero.jpg'),
};

// Document types rendered by DocumentThumbnail (procedural)
const DOC_TYPES = new Set(['invoice', 'quote', 'contract', 'document', 'report']);

interface TodayPlanItem {
  id: string;
  time: string;
  action: string;
  details: string;
  status: string;
  staffRole: string;
  documents?: any[];
  _type?: 'calendar' | 'approval' | 'call' | 'email';
}


function TodayPlanTabsInner({ planItems }: { planItems: TodayPlanItem[] }) {
  const router = useRouter();
  const { session } = useSupabase();
  const displayedPlan = planItems.slice(0, 6);
  const [isInboxSetup, setIsInboxSetup] = useState<boolean | null>(null);

  useEffect(() => {
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
          <Ionicons name="checkmark-circle-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
          <Text style={styles.emptyHeadline}>All caught up</Text>
          <Text style={styles.emptyBody}>
            No pending items right now. New emails, calls, and invoices will appear here automatically.
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
    if (item._type === 'call') return '#22c55e';
    if (item._type === 'email') return '#3b82f6';
    return '#8B5CF6'; // calendar
  };

  return (
    <View style={styles.planContainer}>
      {items.map((planItem, index) => {
        const barColor = getBarColor(planItem);
        const doc = planItem.documents?.[0];
        const docType = doc?.type || 'document';

        // Determine thumbnail: photo or DocumentThumbnail
        const isPhotoType = !DOC_TYPES.has(docType);
        const photoSource = isPhotoType ? PHOTO_THUMBNAILS[docType] : null;

        // Time column: clock time vs due-date label
        const isDueLabel = !planItem.time.includes(':');
        const timeNum = isDueLabel
          ? ''
          : planItem.time.split(':')[0].replace(/^0/, '') + ':' + (planItem.time.split(':')[1] || '00').replace(/ .*/, '');
        const timePeriod = isDueLabel
          ? ''
          : planItem.time.includes('PM') ? 'PM' : planItem.time.includes('AM') ? 'AM' : '';

        return (
          <View key={planItem.id} style={[styles.planItem, index > 0 && styles.planItemBorder]}>
            {/* Time column */}
            <View style={styles.timeCol}>
              {isDueLabel ? (
                <Text style={[
                  styles.dueLabel,
                  planItem.status === 'next' && styles.dueLabelActive,
                  planItem.time === 'Due now' && styles.dueLabelUrgent,
                ]}>
                  {planItem.time}
                </Text>
              ) : (
                <>
                  <Text style={[styles.timeNum, planItem.status === 'next' && styles.timeNumActive]}>
                    {timeNum}
                  </Text>
                  <Text style={styles.timePeriod}>{timePeriod}</Text>
                </>
              )}
            </View>

            {/* Colored bar */}
            <View style={[styles.itemBar, { backgroundColor: barColor }]} />

            {/* Content card — UNIFIED for all types */}
            <View style={styles.itemContent}>
              <View style={styles.cardRow}>
                {/* Thumbnail */}
                {isPhotoType && photoSource ? (
                  <Image source={photoSource} style={styles.photoThumbnail} resizeMode="cover" />
                ) : (
                  <DocumentThumbnail
                    type={docType as any}
                    size="xl"
                    variant={0}
                    context="todayplan"
                    previewEnabled={false}
                  />
                )}

                {/* Text metadata */}
                <View style={styles.cardMeta}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{planItem.action}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>{planItem.details}</Text>
                  {doc?.amount ? <Text style={styles.cardAmount}>{doc.amount}</Text> : null}
                  {doc?.value ? <Text style={styles.cardValue} numberOfLines={1}>{doc.value}</Text> : null}
                  {planItem.staffRole ? (
                    <Text style={styles.cardStaff}>{planItem.staffRole}</Text>
                  ) : null}
                </View>
              </View>

              {/* NEXT badge */}
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
  planItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: Spacing.sm,
  },
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
  dueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  dueLabelActive: {
    color: Colors.accent.cyan,
  },
  dueLabelUrgent: {
    color: Colors.semantic.warning,
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
    position: 'relative',
  },
  cardRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  photoThumbnail: {
    width: 100,
    height: 130,
    borderRadius: BorderRadius.xs + 1,
  },
  cardMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    lineHeight: 16,
    marginBottom: 4,
  },
  cardAmount: {
    color: Colors.semantic.success,
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },
  cardValue: {
    color: Colors.accent.cyan,
    fontSize: Typography.micro.fontSize,
    fontWeight: '500',
    marginTop: 1,
  },
  cardStaff: {
    color: Colors.text.tertiary,
    fontSize: Typography.micro.fontSize,
    marginTop: 4,
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
});

export function TodayPlanTabs(props: { planItems: TodayPlanItem[] }) {
  return (
    <PageErrorBoundary pageName="today-plan-tabs">
      <TodayPlanTabsInner {...props} />
    </PageErrorBoundary>
  );
}
