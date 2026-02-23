/**
 * Contract Detail -- Asymmetric layout with main content (2/3) + right rail (1/3).
 * Shows lifecycle timeline, signers, and action buttons.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import {
  getContract,
  sendContract,
  voidContract,
  downloadContract,
  createSigningSession,
} from '@/lib/api';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import {
  ContractTimeline,
  ContractStatusBadge,
  SignerStatusRow,
  LANE_META,
  type ContractStatus,
  type TemplateLane,
  type SignerData,
} from '@/components/finance/documents';

const webOnly = (s: Record<string, unknown>) => Platform.OS === 'web' ? s : {};

interface ContractDetail {
  id: string;
  display_id?: string;
  title: string;
  counterparty?: string;
  status: ContractStatus;
  lane?: TemplateLane;
  template_key?: string;
  created_at: string;
  updated_at?: string;
  signers?: SignerData[];
  pandadoc_id?: string;
  metadata?: Record<string, unknown>;
}

export default function ContractDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getContract(authenticatedFetch, id);
      setContract({
        id: String(data.id ?? id),
        display_id: data.display_id ? String(data.display_id) : undefined,
        title: String(data.title ?? data.name ?? 'Untitled'),
        counterparty: data.counterparty ? String(data.counterparty) : undefined,
        status: (String(data.status ?? 'draft') as ContractStatus),
        lane: data.lane as TemplateLane | undefined,
        template_key: data.template_key ? String(data.template_key) : undefined,
        created_at: String(data.created_at ?? new Date().toISOString()),
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
        signers: Array.isArray(data.signers) ? data.signers : [],
        pandadoc_id: data.pandadoc_id ? String(data.pandadoc_id) : undefined,
        metadata: data.metadata ?? {},
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load contract';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSend = useCallback(async () => {
    if (!contract) return;
    setActionLoading('send');
    try {
      await sendContract(authenticatedFetch, contract.id);
      await fetchDetail();
    } catch (_e) {
      // Error handled in UI via refetch
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, contract, fetchDetail]);

  const handleVoid = useCallback(async () => {
    if (!contract) return;
    setActionLoading('void');
    try {
      await voidContract(authenticatedFetch, contract.id);
      await fetchDetail();
    } catch (_e) {
      // Handled via refetch
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, contract, fetchDetail]);

  const handleDownload = useCallback(async () => {
    if (!contract) return;
    setActionLoading('download');
    try {
      const result = await downloadContract(authenticatedFetch, contract.id);
      if (result.download_url) {
        if (Platform.OS === 'web') {
          window.open(result.download_url, '_blank');
        } else {
          await Linking.openURL(result.download_url);
        }
      }
    } catch (_e) {
      // Silent fail
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, contract]);

  const handleSigningLink = useCallback(async () => {
    if (!contract?.signers?.[0]) return;
    setActionLoading('sign');
    try {
      const signer = contract.signers[0];
      const result = await createSigningSession(
        authenticatedFetch,
        contract.id,
        signer.email,
        signer.name,
      );
      if (result.signing_url) {
        if (Platform.OS === 'web') {
          window.open(result.signing_url, '_blank');
        } else {
          await Linking.openURL(result.signing_url);
        }
      }
    } catch (_e) {
      // Silent fail
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, contract]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_e) {
      return '';
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <FinanceHubShell>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.accent.cyan} />
          <Text style={styles.stateText}>Loading contract...</Text>
        </View>
      </FinanceHubShell>
    );
  }

  if (error || !contract) {
    return (
      <FinanceHubShell>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle" size={40} color={Colors.semantic.error} />
          <Text style={styles.stateText}>{error ?? 'Contract not found'}</Text>
          <Pressable
            style={[styles.retryBtn, webOnly({ cursor: 'pointer' })]}
            onPress={fetchDetail}
            accessibilityRole="button"
            accessibilityLabel="Retry loading contract"
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </FinanceHubShell>
    );
  }

  const laneMeta = contract.lane ? LANE_META[contract.lane] : undefined;
  const showSend = contract.status === 'reviewed' || contract.status === 'draft';
  const showVoid = contract.status === 'sent' || contract.status === 'reviewed';
  const showSign = contract.status === 'sent' && (contract.signers?.length ?? 0) > 0;
  const signers = contract.signers ?? [];

  return (
    <FinanceHubShell>
      <View style={styles.page}>
        {/* Back button */}
        <Pressable
          style={[styles.backBtn, webOnly({ cursor: 'pointer' })]}
          onPress={() => router.push('/finance-hub/documents' as any)}
          accessibilityRole="button"
          accessibilityLabel="Back to documents"
        >
          <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
          <Text style={styles.backBtnText}>Documents</Text>
        </Pressable>

        {/* Main layout: 2/3 + 1/3 */}
        <View style={styles.layout}>
          {/* Main column */}
          <View style={styles.mainCol}>
            {/* Title card */}
            <View style={styles.titleCard}>
              <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                  <Text style={styles.contractTitle}>{contract.title}</Text>
                  {contract.counterparty && (
                    <Text style={styles.counterparty}>{contract.counterparty}</Text>
                  )}
                </View>
                <ContractStatusBadge status={contract.status} size="md" />
              </View>

              {/* Lane + Template info */}
              <View style={styles.metaRow}>
                {laneMeta && (
                  <View style={[styles.metaPill, { backgroundColor: laneMeta.color + '15' }]}>
                    <Ionicons name={laneMeta.icon as any} size={14} color={laneMeta.color} />
                    <Text style={[styles.metaPillText, { color: laneMeta.color }]}>
                      {laneMeta.label}
                    </Text>
                  </View>
                )}
                {contract.template_key && (
                  <View style={styles.metaPill}>
                    <Ionicons name="copy-outline" size={14} color={Colors.text.muted} />
                    <Text style={styles.metaPillText}>
                      {contract.template_key.replace(/_/g, ' ')}
                    </Text>
                  </View>
                )}
                <Text style={styles.dateLabel}>
                  Created {formatDate(contract.created_at)}
                </Text>
              </View>
            </View>

            {/* Timeline */}
            <View style={styles.timelineCard}>
              <Text style={styles.sectionTitle}>Lifecycle</Text>
              <ContractTimeline currentStatus={contract.status} />
            </View>

            {/* Signers */}
            {signers.length > 0 && (
              <View style={styles.signersCard}>
                <Text style={[styles.sectionTitle, { paddingTop: 16, paddingLeft: 18 }]}>Signers</Text>
                {signers.map((signer, idx) => (
                  <SignerStatusRow key={idx} signer={signer} />
                ))}
              </View>
            )}
          </View>

          {/* Right rail */}
          <View style={styles.rightRail}>
            {/* Actions card */}
            <View style={styles.actionsCard}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsGrid}>
                {showSend && (
                  <ActionButton
                    icon="send-outline"
                    label="Send"
                    color="#3B82F6"
                    loading={actionLoading === 'send'}
                    onPress={handleSend}
                  />
                )}
                {showSign && (
                  <ActionButton
                    icon="create-outline"
                    label="Signing Link"
                    color="#34c759"
                    loading={actionLoading === 'sign'}
                    onPress={handleSigningLink}
                  />
                )}
                <ActionButton
                  icon="download-outline"
                  label="Download"
                  color={Colors.text.secondary}
                  loading={actionLoading === 'download'}
                  onPress={handleDownload}
                />
                {showVoid && (
                  <ActionButton
                    icon="close-circle-outline"
                    label="Void"
                    color="#ff3b30"
                    loading={actionLoading === 'void'}
                    onPress={handleVoid}
                  />
                )}
              </View>
            </View>

            {/* Details card */}
            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Details</Text>
              <DetailRow label="Contract ID" value={contract.display_id || contract.id.slice(0, 12)} />
              {contract.pandadoc_id && (
                <DetailRow label="PandaDoc ID" value={contract.pandadoc_id.slice(0, 12)} />
              )}
              <DetailRow label="Status" value={contract.status.charAt(0).toUpperCase() + contract.status.slice(1)} />
              <DetailRow label="Created" value={formatDate(contract.created_at)} />
              {contract.updated_at && (
                <DetailRow label="Updated" value={formatDate(contract.updated_at)} />
              )}
              <DetailRow label="Signers" value={String(signers.length)} />
            </View>
          </View>
        </View>
      </View>
    </FinanceHubShell>
  );
}

// ---- Sub-components ----

interface ActionButtonProps {
  icon: string;
  label: string;
  color: string;
  loading: boolean;
  onPress: () => void;
}

const ActionButton = React.memo(function ActionButtonInner({ icon, label, color, loading: isLoading, onPress }: ActionButtonProps) {
  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.actionBtn,
        hovered && styles.actionBtnHovered,
        webOnly({ cursor: 'pointer', transition: 'all 0.15s ease' }),
      ]}
      onPress={onPress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon as any} size={18} color={color} />
      )}
      <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
    </Pressable>
  );
});

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow = React.memo(function DetailRowInner({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
});

// ---- Styles ----

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  stateText: {
    color: Colors.text.tertiary,
    fontSize: 15,
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyanLight,
  },
  retryBtnText: {
    color: Colors.accent.cyan,
    fontWeight: '600',
    fontSize: 13,
  },

  // Back
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backBtnText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },

  // Layout
  layout: {
    flexDirection: 'row',
    gap: 20,
  },
  mainCol: {
    flex: 2,
    gap: 16,
  },
  rightRail: {
    flex: 1,
    gap: 16,
    maxWidth: 320,
  },

  // Title card
  titleCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleLeft: {
    flex: 1,
    marginRight: 16,
  },
  contractTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  counterparty: {
    fontSize: 15,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.text.muted,
  },

  // Timeline
  timelineCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 20,
  },

  // Signers
  signersCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 0,
  },

  // Section title
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // Actions card
  actionsCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
  },
  actionsGrid: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  actionBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Details card
  detailsCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
});
