import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocumentThumbnail } from '@/components/DocumentThumbnail';
import { Toast } from '@/components/session/Toast';
import { getOutboxJobs, getAuthorityQueue } from '@/lib/api';
import { useDesktop } from '@/lib/useDesktop';

export default function FullPlanScreen() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const [todaysPlan, setTodaysPlan] = useState<any[]>([]);
  const [atRiskItems, setAtRiskItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    Promise.all([getOutboxJobs(20), getAuthorityQueue()])
      .then(([jobs, queue]) => {
        setTodaysPlan(jobs.map((j: any, i: number) => ({
          id: j.id ?? `plan-${i}`,
          title: j.action_type ?? j.title ?? 'Pending task',
          time: j.queued_at ?? j.created_at ?? '',
          status: j.status === 'completed' ? 'completed' : j.status === 'failed' ? 'blocked' : 'pending',
          priority: j.priority ?? 'medium',
          agent: j.provider ?? 'ava',
          description: j.description ?? '',
        })));
        setAtRiskItems(queue.filter((q: any) => q.risk_level === 'high' || q.risk_tier === 'red').map((q: any, i: number) => ({
          id: q.id ?? `risk-${i}`,
          title: q.action_type ?? q.title ?? 'At-risk item',
          risk: q.risk_level ?? q.risk_tier ?? 'high',
          description: q.description ?? '',
          actions: ['Review', 'Defer', 'Delegate'],
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [dismissedRiskItems, setDismissedRiskItems] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleAction = (action: string, itemId: string) => {
    switch (action) {
      case 'Review':
        showToast('Opening for review...', 'info');
        break;
      case 'Defer':
        setDismissedRiskItems(prev => [...prev, itemId]);
        showToast('Deferred to tomorrow', 'success');
        break;
      case 'Delegate':
        showToast('Delegated to Quinn', 'success');
        break;
      default:
        showToast(`${action} completed`, 'success');
    }
  };

  const visibleRiskItems = atRiskItems.filter(item => !dismissedRiskItems.includes(item.id));

  return (
    <View style={styles.container}>
      <View style={[styles.contentWrapper, isDesktop && styles.desktopWrapper]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Today's Plan</Text>
            <Text style={styles.headerSubtitle}>{todaysPlan.length} tasks scheduled</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {visibleRiskItems.length > 0 && (
          <Card variant="elevated" style={styles.atRiskCard}>
            <View style={styles.atRiskHeader}>
              <Badge label="At Risk" variant="warning" size="sm" />
              <Text style={styles.atRiskTitle}>{visibleRiskItems[0].title}</Text>
            </View>
            <Text style={styles.atRiskDescription}>
              {visibleRiskItems[0].description}
            </Text>
            <View style={styles.atRiskActions}>
              {visibleRiskItems[0].actions.map((action) => (
                <Button 
                  key={action}
                  label={action} 
                  variant="secondary" 
                  size="sm" 
                  onPress={() => handleAction(action, visibleRiskItems[0].id)} 
                  style={styles.actionButton} 
                />
              ))}
            </View>
          </Card>
        )}

        {todaysPlan.map((planItem, index) => (
          <Card key={planItem.id} variant="elevated" style={styles.planCard}>
            <View style={styles.planHeader}>
              <Badge 
                label={planItem.status === 'next' ? 'NEXT' : planItem.time.split('–')[0]} 
                variant={planItem.status === 'next' ? 'info' : 'muted'} 
                size="sm" 
              />
              <Text style={styles.planTime}>{planItem.time}</Text>
            </View>
            
            <Text style={styles.planAction}>{planItem.action}</Text>
            <Text style={styles.planDetails}>{planItem.details}</Text>
            
            {planItem.documents && (
              <View style={styles.documentsSection}>
                <Text style={styles.documentsLabel}>Documents</Text>
                {planItem.documents.map((doc: any, docIndex: number) => (
                  <View key={docIndex} style={styles.docCard}>
                    <DocumentThumbnail 
                      type={doc.type || 'invoice'}
                      size="md"
                      variant={docIndex}
                    />
                    <View style={styles.docMeta}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                      {doc.contactName && (
                        <Text style={styles.docContact}>{doc.contactName}</Text>
                      )}
                      {doc.amount && (
                        <Text style={styles.docAmount}>{doc.amount}</Text>
                      )}
                      {doc.value && (
                        <Text style={styles.docValue}>{doc.value}</Text>
                      )}
                      {doc.expiresIn && (
                        <Text style={styles.docExpiry}>Expires: {doc.expiresIn}</Text>
                      )}
                      {doc.daysOverdue > 0 && (
                        <Badge 
                          label={`${doc.daysOverdue}d overdue`} 
                          variant="warning" 
                          size="sm" 
                        />
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
                  </View>
                ))}
              </View>
            )}
          </Card>
        ))}
        </ScrollView>
      </View>
      
      <Toast 
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
  desktopWrapper: {
    maxWidth: 1100,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.title.fontWeight,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  atRiskCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.background.tertiary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.warning,
  },
  atRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  atRiskTitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.secondary,
    flex: 1,
  },
  atRiskDescription: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.tertiary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  atRiskActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  planCard: {
    marginBottom: Spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  planTime: {
    fontSize: Typography.caption.fontSize,
    color: Colors.text.tertiary,
  },
  planAction: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  planDetails: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
    lineHeight: 18,
  },
  documentsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  documentsLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  docMeta: {
    flex: 1,
  },
  docName: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  docContact: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
    marginTop: 1,
  },
  docAmount: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: Colors.semantic.success,
    marginTop: 2,
  },
  docValue: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    color: Colors.accent.cyan,
    marginTop: 2,
  },
  docExpiry: {
    fontSize: Typography.micro.fontSize,
    color: Colors.semantic.warning,
    marginTop: 2,
  },
});
