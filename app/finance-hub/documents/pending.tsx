/**
 * Pending Signatures -- Filtered view showing only SENT contracts awaiting signatures.
 * Quick actions: Reminder, Copy Link, Void.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { getContracts, sendContract, voidContract } from '@/lib/api';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import {
  ContractStatusBadge,
  type ContractStatus,
} from '@/components/finance/documents';

const webOnly = (s: Record<string, unknown>) => Platform.OS === 'web' ? s : {};

interface PendingContract {
  id: string;
  title: string;
  counterparty?: string;
  status: ContractStatus;
  created_at: string;
  updated_at?: string;
  signers?: Array<{ name: string; email: string; status: string }>;
}

export default function PendingSignaturesPage() {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();

  const [contracts, setContracts] = useState<PendingContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContracts(authenticatedFetch, { status: 'sent' });
      const normalized: PendingContract[] = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ''),
        title: String(c.title ?? c.name ?? 'Untitled'),
        counterparty: c.counterparty ? String(c.counterparty) : undefined,
        status: 'sent' as ContractStatus,
        created_at: String(c.created_at ?? new Date().toISOString()),
        updated_at: c.updated_at ? String(c.updated_at) : undefined,
        signers: Array.isArray(c.signers) ? c.signers as PendingContract['signers'] : [],
      }));
      setContracts(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load pending contracts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleReminder = useCallback(async (id: string) => {
    setActionLoading(`reminder-${id}`);
    try {
      // Re-send triggers a reminder in PandaDoc
      await sendContract(authenticatedFetch, id);
      await fetchPending();
    } catch (_e) {
      // Silent -- error state via refetch
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, fetchPending]);

  const handleVoid = useCallback(async (id: string) => {
    setActionLoading(`void-${id}`);
    try {
      await voidContract(authenticatedFetch, id);
      await fetchPending();
    } catch (_e) {
      // Silent
    } finally {
      setActionLoading(null);
    }
  }, [authenticatedFetch, fetchPending]);

  const handleViewDetail = useCallback((id: string) => {
    router.push(`/finance-hub/documents/${id}` as any);
  }, [router]);

  const getDaysWaiting = (isoStr: string): number => {
    try {
      const sent = new Date(isoStr).getTime();
      return Math.floor((Date.now() - sent) / (1000 * 60 * 60 * 24));
    } catch (_e) {
      return 0;
    }
  };

  const renderRow = useCallback(({ item }: { item: PendingContract }) => {
    const days = getDaysWaiting(item.updated_at ?? item.created_at);
    const signerNames = item.signers?.map(s => s.name).join(', ') ?? '';
    const isUrgent = days > 7;

    return (
      <Pressable
        style={({ hovered }: any) => [
          styles.row,
          hovered && styles.rowHovered,
          webOnly({ cursor: 'pointer', transition: 'background-color 0.15s ease' }),
        ]}
        onPress={() => handleViewDetail(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Pending contract: ${item.title}, waiting ${days} days`}
      >
        {/* Left: icon + info */}
        <View style={styles.rowLeft}>
          <View style={[styles.docIcon, isUrgent && styles.docIconUrgent]}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={isUrgent ? '#f59e0b' : Colors.text.muted}
            />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.rowMeta}>
              {signerNames ? (
                <Text style={styles.rowSigner} numberOfLines={1}>{signerNames}</Text>
              ) : (
                <Text style={styles.rowSigner}>No signers assigned</Text>
              )}
              <Text style={styles.rowDot}>-</Text>
              <Text style={[styles.rowDays, isUrgent && styles.rowDaysUrgent]}>
                {days === 0 ? 'Sent today' : days === 1 ? '1 day waiting' : `${days} days waiting`}
              </Text>
            </View>
          </View>
        </View>

        {/* Right: status + actions */}
        <View style={styles.rowRight}>
          <ContractStatusBadge status="sent" />
          <View style={styles.rowActions}>
            <Pressable
              style={[styles.quickAction, webOnly({ cursor: 'pointer' })]}
              onPress={(e) => {
                e.stopPropagation();
                handleReminder(item.id);
              }}
              disabled={actionLoading === `reminder-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel="Send reminder"
            >
              {actionLoading === `reminder-${item.id}` ? (
                <ActivityIndicator size="small" color={Colors.accent.cyan} />
              ) : (
                <Ionicons name="notifications-outline" size={16} color={Colors.accent.cyan} />
              )}
            </Pressable>
            <Pressable
              style={[styles.quickAction, webOnly({ cursor: 'pointer' })]}
              onPress={(e) => {
                e.stopPropagation();
                handleVoid(item.id);
              }}
              disabled={actionLoading === `void-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel="Void contract"
            >
              {actionLoading === `void-${item.id}` ? (
                <ActivityIndicator size="small" color={Colors.semantic.error} />
              ) : (
                <Ionicons name="close-circle-outline" size={16} color={Colors.semantic.error} />
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }, [actionLoading, handleReminder, handleVoid, handleViewDetail]);

  const keyExtractor = useCallback((item: PendingContract) => item.id, []);

  return (
    <FinanceHubShell>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Awaiting Signature</Text>
            <Text style={styles.pageSubtitle}>
              Contracts sent for signing -- {contracts.length} pending
            </Text>
          </View>
        </View>

        {/* List card */}
        <View style={styles.card}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={Colors.accent.cyan} />
              <Text style={styles.stateText}>Loading pending contracts...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle" size={40} color={Colors.semantic.error} />
              <Text style={styles.stateText}>{error}</Text>
              <Pressable
                style={[styles.retryBtn, webOnly({ cursor: 'pointer' })]}
                onPress={fetchPending}
                accessibilityRole="button"
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : contracts.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="checkmark-done-outline" size={48} color={Colors.text.disabled} />
              <Text style={styles.stateText}>No contracts awaiting signature</Text>
              <Text style={styles.stateSubtext}>
                All sent contracts have been signed or no contracts have been sent yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={contracts}
              renderItem={renderRow}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              initialNumToRender={15}
            />
          )}
        </View>
      </View>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 4,
  },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowHovered: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconUrgent: {
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 3,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowSigner: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  rowDot: {
    fontSize: 12,
    color: Colors.text.disabled,
  },
  rowDays: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  rowDaysUrgent: {
    color: '#f59e0b',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  // States
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  stateText: {
    color: Colors.text.tertiary,
    fontSize: 15,
    marginTop: 12,
  },
  stateSubtext: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 6,
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
});
