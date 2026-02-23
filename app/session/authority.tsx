import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable, ActivityIndicator, Animated, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '@/constants/tokens';
import { SessionAuthorityItem } from '@/types/session';
import { Toast } from '@/components/session/Toast';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';

const PANDADOC_SESSION_BASE = 'https://app.pandadoc.com/s/';

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

function mapAuthorityItem(item: any): SessionAuthorityItem {
  return {
    id: String(item.id),
    title: item.title || 'Finance Proposal',
    description: item.type || '',
    risk: mapRiskTier(item.risk_tier || 'yellow'),
    whyRequired: `${item.required_approval || 'admin'} approval required (${item.risk_tier || 'yellow'} tier)`,
    status: item.status || 'pending',
    evidence: item.inputs_hash ? [`inputs_hash: ${item.inputs_hash}`] : [],
    createdAt: new Date(item.createdAt),
    pandadocDocumentId: item.pandadocDocumentId || undefined,
  };
}

export default function AuthorityScreen() {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();
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
  const [signingSession, setSigningSession] = useState<{
    sessionId: string;
    documentName: string;
  } | null>(null);
  const [reviewPreview, setReviewPreview] = useState<{
    visible: boolean;
    documentName?: string;
    pandadocDocumentId?: string;
  }>({ visible: false });

  const fetchItems = useCallback(async (status: string): Promise<SessionAuthorityItem[]> => {
    try {
      const resp = await authenticatedFetch(`/api/authority-queue?domain=finance&status=${status}`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.items || []).map(mapAuthorityItem);
    } catch {
      return [];
    }
  }, [authenticatedFetch]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const [pending, resolved, denied] = await Promise.all([
      fetchItems('pending'),
      fetchItems('approved'),
      fetchItems('denied'),
    ]);
    setAuthorityItems([...pending, ...resolved, ...denied]);
    setLoading(false);
  }, [fetchItems]);

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

    try {
      const action = confirmModal.action;
      const resp = await authenticatedFetch(`/api/authority-queue/${itemId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'approve' ? { approvedBy: 'owner' } : { deniedBy: 'owner', reason: '' }),
      });
      if (resp.ok) {
        const responseData = await resp.json();
        const newStatus = action === 'approve' ? 'approved' : 'denied';
        setAuthorityItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, status: newStatus as any } : item
        ));

        // Check if the response contains a signing session (contract.sign flow)
        const sessionId = responseData?.data?.signing_session?.session_id;
        if (action === 'approve' && sessionId) {
          // Open signing modal instead of just showing a toast
          setSigningSession({
            sessionId,
            documentName: itemTitle,
          });
          setConfirmModal({ visible: false, action: 'approve', item: null });
          return; // Don't show toast yet — signing modal handles completion
        }

        setToastMessage(`${action === 'approve' ? 'Approved' : 'Denied'}: ${itemTitle}`);
        setToastType(action === 'approve' ? 'success' : 'error');
      } else {
        setToastMessage(`Failed to ${action}: ${itemTitle}`);
        setToastType('error');
      }
    } catch {
      setToastMessage(`Failed to ${confirmModal.action}: ${itemTitle}`);
      setToastType('error');
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

      <DocumentPreviewModal
        visible={reviewPreview.visible}
        onClose={() => setReviewPreview(prev => ({ ...prev, visible: false }))}
        type="contract"
        documentName={reviewPreview.documentName}
        pandadocDocumentId={reviewPreview.pandadocDocumentId}
      />

      {signingSession && (
        <SigningOverlay
          sessionId={signingSession.sessionId}
          documentName={signingSession.documentName}
          onComplete={() => {
            setSigningSession(null);
            setToastMessage(`Signed: ${signingSession.documentName}`);
            setToastType('success');
            setToastVisible(true);
            loadItems();
          }}
          onDismiss={() => {
            setSigningSession(null);
            setToastMessage('Signing session available — return to complete signing');
            setToastType('success');
            setToastVisible(true);
          }}
        />
      )}
      
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
                onReview={item.pandadocDocumentId ? () => setReviewPreview({
                  visible: true,
                  documentName: item.title,
                  pandadocDocumentId: item.pandadocDocumentId,
                }) : undefined}
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
  onDeny,
  onReview,
}: {
  item: SessionAuthorityItem;
  onApprove: () => void;
  onDeny: () => void;
  onReview?: () => void;
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
          {onReview && (
            <Pressable style={styles.reviewButton} onPress={onReview}>
              <Ionicons name="eye-outline" size={18} color={Colors.accent.cyan} />
              <Text style={styles.reviewText}>Review</Text>
            </Pressable>
          )}
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

// ── Signing Overlay — PandaDoc iframe after Authority Queue approval ────────

function SigningOverlay({
  sessionId,
  documentName,
  onComplete,
  onDismiss,
}: {
  sessionId: string;
  documentName: string;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0.96)).current;

  const pandadocUrl = `${PANDADOC_SESSION_BASE}${sessionId}`;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleIn, { toValue: 1, damping: 20, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, scaleIn]);

  // Listen for PandaDoc completion postMessage (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        (event.data.event === 'session_view.document.completed' ||
         event.data.type === 'session_view.document.completed')
      ) {
        setCompleted(true);
        setTimeout(onComplete, 1500);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onComplete]);

  if (completed) {
    return (
      <View style={signingStyles.overlay}>
        <View style={signingStyles.completedContainer}>
          <View style={signingStyles.completedIcon}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.semantic.success} />
          </View>
          <Text style={signingStyles.completedTitle}>Document Signed</Text>
          <Text style={signingStyles.completedBody}>
            {documentName} has been signed successfully.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={signingStyles.overlay}>
      <Animated.View style={[signingStyles.backdrop, { opacity: fadeIn }]}>
        <Pressable style={{ flex: 1 }} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close signing" />
      </Animated.View>

      <Animated.View
        style={[
          signingStyles.container,
          { opacity: fadeIn, transform: [{ scale: scaleIn }] },
        ]}
      >
        {/* Header */}
        <View style={signingStyles.header}>
          <View style={signingStyles.headerLeft}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.accent.cyan} />
            <Text style={signingStyles.headerTitle}>{documentName}</Text>
          </View>
          <Pressable
            onPress={onDismiss}
            style={signingStyles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={Colors.text.muted} />
          </Pressable>
        </View>

        {/* PandaDoc iframe */}
        <View style={signingStyles.iframeArea}>
          {Platform.OS === 'web' ? (
            <iframe
              src={pandadocUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 0,
                backgroundColor: '#ffffff',
              }}
              title="Sign Document"
              allow="camera; microphone"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <View style={signingStyles.nativeNotice}>
              <Ionicons name="open-outline" size={32} color={Colors.text.muted} />
              <Text style={signingStyles.nativeNoticeText}>
                Opening signing page in browser...
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={signingStyles.footer}>
          <Text style={signingStyles.footerText}>Secured by Aspire</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const signingStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as ViewStyle : {}),
  },
  container: {
    position: 'absolute',
    width: '90%' as any,
    maxWidth: 900,
    height: '85%' as any,
    maxHeight: 720,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05)',
    } as ViewStyle : Shadows.lg),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
  },
  iframeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  footer: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
  },
  footerText: {
    ...Typography.small,
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
  completedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 201,
  },
  completedIcon: {
    marginBottom: Spacing.lg,
  },
  completedTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  completedBody: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  nativeNotice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  nativeNoticeText: {
    ...Typography.body,
    color: Colors.text.muted,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});

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
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.cyanDark,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  reviewText: {
    ...Typography.body,
    color: Colors.accent.cyan,
    fontWeight: '600',
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
