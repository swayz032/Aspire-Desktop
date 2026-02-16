import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { SessionAuthorityItem } from '@/types/session';
import { Toast } from '@/components/session/Toast';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { SUITE_ID } from '@/types/common';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
  Medium: { bg: 'rgba(251, 191, 36, 0.2)', text: Colors.semantic.warning },
  High: { bg: 'rgba(239, 68, 68, 0.2)', text: Colors.semantic.error },
  green: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
  yellow: { bg: 'rgba(251, 191, 36, 0.2)', text: Colors.semantic.warning },
  red: { bg: 'rgba(239, 68, 68, 0.2)', text: Colors.semantic.error },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(251, 191, 36, 0.2)', text: Colors.semantic.warning },
  approved: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
  denied: { bg: 'rgba(239, 68, 68, 0.2)', text: Colors.semantic.error },
};

function mapRiskTier(tier: string): 'Low' | 'Medium' | 'High' {
  if (tier === 'green') return 'Low';
  if (tier === 'red') return 'High';
  return 'Medium';
}

async function fetchAuthorityItems(status: string = 'pending'): Promise<SessionAuthorityItem[]> {
  try {
    const resp = await fetch(`/api/authority-queue?domain=finance&status=${status}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.items || []).map((item: any) => ({
      id: String(item.id),
      title: item.title || 'Finance Proposal',
      description: item.type || '',
      risk: mapRiskTier(item.risk_tier || 'yellow'),
      whyRequired: `${item.required_approval || 'admin'} approval required (${item.risk_tier || 'yellow'} tier)`,
      status: item.status || 'pending',
      evidence: item.inputs_hash ? [`inputs_hash: ${item.inputs_hash}`] : [],
      createdAt: new Date(item.createdAt),
    }));
  } catch {
    return [];
  }
}

async function serverApprove(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/authority-queue/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Suite-Id': SUITE_ID },
      body: JSON.stringify({ approvedBy: 'owner' }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function serverDeny(id: string, reason?: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/authority-queue/${id}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Suite-Id': SUITE_ID },
      body: JSON.stringify({ deniedBy: 'owner', reason: reason || '' }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export default function AuthorityScreen() {
  const router = useRouter();
  const [authorityItems, setAuthorityItems] = useState<SessionAuthorityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    action: 'approve' | 'deny';
    item: SessionAuthorityItem | null;
  }>({ visible: false, action: 'approve', item: null });

  const loadItems = useCallback(async () => {
    setLoading(true);
    const [pending, resolved] = await Promise.all([
      fetchAuthorityItems('pending'),
      fetchAuthorityItems('approved'),
    ]);
    // Also fetch denied
    const denied = await fetchAuthorityItems('denied');
    setAuthorityItems([...pending, ...resolved, ...denied]);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const pendingItems = authorityItems.filter(i => i.status === 'pending');
  const resolvedItems = authorityItems.filter(i => i.status !== 'pending');

  const handleApprove = (item: SessionAuthorityItem) => {
    setConfirmModal({ visible: true, action: 'approve', item });
  };

  const handleDeny = (item: SessionAuthorityItem) => {
    setConfirmModal({ visible: true, action: 'deny', item });
  };

  const executeAction = async () => {
    if (!confirmModal.item) return;

    const itemId = confirmModal.item.id;
    const itemTitle = confirmModal.item.title;

    if (confirmModal.action === 'approve') {
      const ok = await serverApprove(itemId);
      if (ok) {
        setAuthorityItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, status: 'approved' as const } : item
        ));
        setToastMessage(`Approved: ${itemTitle}`);
        setToastType('success');
      } else {
        setToastMessage(`Failed to approve: ${itemTitle}`);
        setToastType('error');
      }
    } else {
      const ok = await serverDeny(itemId);
      if (ok) {
        setAuthorityItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, status: 'denied' as const } : item
        ));
        setToastMessage(`Denied: ${itemTitle}`);
        setToastType('error');
      } else {
        setToastMessage(`Failed to deny: ${itemTitle}`);
        setToastType('error');
      }
    }

    setToastVisible(true);
    setConfirmModal({ visible: false, action: 'approve', item: null });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />
      
      <ConfirmationModal
        visible={confirmModal.visible}
        onClose={() => setConfirmModal({ ...confirmModal, visible: false })}
        onConfirm={executeAction}
        title={confirmModal.action === 'approve' ? 'Approve Request' : 'Deny Request'}
        message={`Are you sure you want to ${confirmModal.action} "${confirmModal.item?.title}"?`}
        confirmLabel={confirmModal.action === 'approve' ? 'Approve' : 'Deny'}
        destructive={confirmModal.action === 'deny'}
        icon={confirmModal.action === 'approve' ? 'checkmark-circle' : 'close-circle'}
      />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.secondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Authority Queue</Text>
          <Text style={styles.headerSubtitle}>{pendingItems.length} pending approval</Text>
        </View>
        <Pressable style={styles.backButton} onPress={loadItems}>
          <Ionicons name="refresh" size={22} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={Colors.accent.cyan} />
            <Text style={[styles.headerSubtitle, { marginTop: 12 }]}>Loading authority queue...</Text>
          </View>
        )}
        {!loading && pendingItems.length === 0 && resolvedItems.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.text.muted} />
            <Text style={[styles.headerSubtitle, { marginTop: 12 }]}>No items in the authority queue</Text>
          </View>
        )}
        {pendingItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Approval</Text>
            {pendingItems.map((item) => (
              <AuthorityCard 
                key={item.id} 
                item={item}
                onApprove={() => handleApprove(item)}
                onDeny={() => handleDeny(item)}
              />
            ))}
          </>
        )}
        
        {resolvedItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Resolved</Text>
            {resolvedItems.map((item) => (
              <AuthorityCard 
                key={item.id} 
                item={item}
                onApprove={() => {}}
                onDeny={() => {}}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthorityCard({ 
  item, 
  onApprove, 
  onDeny 
}: { 
  item: SessionAuthorityItem;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const riskColor = RISK_COLORS[item.risk];
  const statusColor = STATUS_COLORS[item.status];

  return (
    <Pressable 
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.riskBadge, { backgroundColor: riskColor.bg }]}>
            <Text style={[styles.riskText, { color: riskColor.text }]}>{item.risk}</Text>
          </View>
        </View>
        <Text style={styles.cardDescription}>{item.description}</Text>
      </View>

      <View style={styles.whyContainer}>
        <Ionicons name="information-circle" size={16} color={Colors.accent.cyan} />
        <Text style={styles.whyText}>{item.whyRequired}</Text>
      </View>

      {expanded && item.evidence && item.evidence.length > 0 && (
        <View style={styles.evidenceContainer}>
          <Text style={styles.evidenceTitle}>Evidence Attached</Text>
          {item.evidence.map((e, index) => (
            <View key={index} style={styles.evidenceItem}>
              <Ionicons name="document-attach" size={14} color={Colors.text.muted} />
              <Text style={styles.evidenceText}>{e}</Text>
            </View>
          ))}
        </View>
      )}

      {item.status === 'pending' ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.denyButton} onPress={onDeny}>
            <Ionicons name="close" size={18} color={Colors.semantic.error} />
            <Text style={styles.denyText}>Deny</Text>
          </Pressable>
          <Pressable style={styles.approveButton} onPress={onApprove}>
            <Ionicons name="checkmark" size={18} color={Colors.semantic.success} />
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Ionicons 
            name={item.status === 'approved' ? 'checkmark-circle' : 'close-circle'} 
            size={16} 
            color={statusColor.text} 
          />
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHeader: {
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  riskText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  cardDescription: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  whyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accent.cyanDark,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  whyText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    flex: 1,
  },
  evidenceContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  evidenceTitle: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  evidenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  evidenceText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.errorDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  denyText: {
    ...Typography.body,
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.semantic.successDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  approveText: {
    ...Typography.body,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '600',
  },
});
