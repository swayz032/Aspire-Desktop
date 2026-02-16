import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { DocumentThumbnail } from './DocumentThumbnail';
import { useRouter } from 'expo-router';

interface TodayPlanItem {
  id: string;
  time: string;
  action: string;
  details: string;
  status: string;
  staffRole: string;
  documents?: any[];
}


export function TodayPlanTabs({ planItems }: { planItems: TodayPlanItem[] }) {
  const router = useRouter();
  const displayedPlan = planItems.slice(0, 2);

  return (
    <Card variant="elevated" style={styles.container}>
      {displayedPlan.length > 0 ? (
        <TodayPlanContent items={displayedPlan} router={router} />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="sunny-outline" size={24} color={Colors.accent.cyan} style={styles.emptyStateIcon} />
          <Text style={styles.emptyHeadline}>Your morning plan builds itself</Text>
          <Text style={styles.emptyBody}>
            As your inbox, calls, and invoices are processed — your daily action list appears here. Start by connecting your first service.
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => router.push('/inbox' as any)}
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
  return (
    <View style={styles.planContainer}>
      {items.map((planItem, index) => (
        <View key={planItem.id} style={[
          styles.planItem,
          index > 0 && styles.planItemBorder
        ]}>
          <Badge 
            label={planItem.status === 'next' ? 'NEXT' : planItem.time.split('–')[0]} 
            variant={planItem.status === 'next' ? 'primary' : 'muted'} 
            size="sm" 
          />
          <View style={styles.planDetails}>
            <Text style={styles.planTime}>{planItem.time}</Text>
            <Text style={styles.planAction}>{planItem.action}</Text>
            <Text style={styles.planSubAction} numberOfLines={2}>{planItem.details}</Text>
            
            {planItem.documents && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.documentsScroll}
                contentContainerStyle={styles.documentsContent}
              >
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
                      {doc.amount && (
                        <Text style={styles.docAmount}>{doc.amount}</Text>
                      )}
                      {doc.value && (
                        <Text style={styles.docValue}>{doc.value}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      ))}

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
    padding: Spacing.md,
  },
  planItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  planItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  planDetails: {
    flex: 1,
  },
  planTime: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    marginBottom: 2,
  },
  planAction: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
  },
  planSubAction: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  documentsScroll: {
    marginTop: Spacing.sm,
    marginHorizontal: -Spacing.xs,
  },
  documentsContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
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
  moreDocsIndicator: {
    width: 32,
    height: 40,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreDocsText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
});
