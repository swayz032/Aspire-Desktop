import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { playApproveSound, playDenySound } from '@/lib/sounds';

type RiskTier = 'red' | 'yellow' | 'green';

interface ApprovalRequest {
  id: string;
  actionType: string;
  description: string;
  requester: string;
  amount?: number;
  riskTier: RiskTier;
  timestamp: string;
  correlationId: string;
}

interface AuthorityQueueWidgetProps {
  suiteId: string;
  officeId: string;
  onApprove?: (requestId: string) => void;
  onDeny?: (requestId: string) => void;
  onViewAll?: () => void;
}

const RISK_CONFIG: Record<RiskTier, { bg: string; border: string; text: string; label: string }> = {
  red:    { bg: 'rgba(239,68,68,0.15)',  border: '#EF4444', text: '#EF4444', label: 'HIGH RISK' },
  yellow: { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#F59E0B', label: 'MED RISK'  },
  green:  { bg: 'rgba(34,197,94,0.15)',  border: '#22C55E', text: '#22C55E', label: 'LOW RISK'  },
};

const AVATAR_COLORS: Record<string, string> = {
  Ava: '#A855F7',
  Eli: '#10B981',
  Finn: '#3B82F6',
  Nora: '#F59E0B',
  Quinn: '#6366F1',
};
function agentColor(name: string): string {
  return AVATAR_COLORS[name] ?? '#6B7280';
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DEMO_REQUESTS: ApprovalRequest[] = [
  { id: '1', actionType: 'PAYMENT', description: 'Pay vendor invoice #1042', requester: 'Finn', amount: 12400, riskTier: 'red', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), correlationId: 'corr-001' },
  { id: '2', actionType: 'CONTRACT', description: 'Sign Acme Corp renewal', requester: 'Ava', amount: undefined, riskTier: 'yellow', timestamp: new Date(Date.now() - 22 * 60000).toISOString(), correlationId: 'corr-002' },
  { id: '3', actionType: 'REFUND', description: 'Issue refund to customer #8821', requester: 'Eli', amount: 850, riskTier: 'yellow', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), correlationId: 'corr-003' },
  { id: '4', actionType: 'EMAIL', description: 'Send pricing proposal to prospect', requester: 'Nora', amount: undefined, riskTier: 'green', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), correlationId: 'corr-004' },
];

export function AuthorityQueueWidget({ suiteId, officeId, onApprove, onDeny }: AuthorityQueueWidgetProps) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, 'approving' | 'denying'>>({});

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('authority_queue')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      const mapped: ApprovalRequest[] = (data ?? []).map((row: any) => ({
        id: row.id,
        actionType: row.action_type || 'ACTION',
        description: row.description || row.action_type,
        requester: row.requester || row.agent_id || 'Agent',
        amount: row.amount ?? undefined,
        riskTier: (row.risk_tier?.toLowerCase() as RiskTier) || 'yellow',
        timestamp: row.created_at,
        correlationId: row.correlation_id || row.id,
      }));
      setRequests(mapped.length > 0 ? mapped : DEMO_REQUESTS);
    } catch {
      setRequests(DEMO_REQUESTS);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const channel = supabase
      .channel(`aq-widget-${suiteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'authority_queue',
        filter: `suite_id=eq.${suiteId}`,
      }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [suiteId, fetchRequests]);

  const handleApprove = useCallback(async (req: ApprovalRequest) => {
    if (processing[req.id]) return;
    setProcessing(p => ({ ...p, [req.id]: 'approving' }));
    playApproveSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await supabase.from('authority_queue').update({ status: 'APPROVED' }).eq('id', req.id);
      onApprove?.(req.id);
    } catch {}
    setProcessing(p => { const n = { ...p }; delete n[req.id]; return n; });
  }, [processing, onApprove]);

  const handleDeny = useCallback(async (req: ApprovalRequest) => {
    if (processing[req.id]) return;
    setProcessing(p => ({ ...p, [req.id]: 'denying' }));
    playDenySound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await supabase.from('authority_queue').update({ status: 'DENIED' }).eq('id', req.id);
      onDeny?.(req.id);
    } catch {}
    setProcessing(p => { const n = { ...p }; delete n[req.id]; return n; });
  }, [processing, onDeny]);

  const pendingCount = requests.length;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Pending Approvals</Text>
        {pendingCount > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Request list */}
      <FlatList
        data={requests}
        keyExtractor={r => r.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✓</Text>
            <Text style={s.emptyTitle}>All clear</Text>
            <Text style={s.emptyText}>{loading ? 'Loading…' : 'No pending approvals'}</Text>
          </View>
        }
        renderItem={({ item: req }) => {
          const risk = RISK_CONFIG[req.riskTier];
          const color = agentColor(req.requester);
          const isProcessing = !!processing[req.id];
          return (
            <View style={s.reqRow}>
              {/* Top row */}
              <View style={s.reqTopRow}>
                <View style={[s.agentCircle, { backgroundColor: color }]}>
                  <Text style={s.agentInitial}>{req.requester[0]}</Text>
                </View>
                <View style={s.reqInfo}>
                  <View style={s.reqTitleRow}>
                    <Text style={s.reqRequester}>{req.requester}</Text>
                    <View style={[s.riskChip, { backgroundColor: risk.bg, borderColor: risk.border }]}>
                      <Text style={[s.riskText, { color: risk.text }]}>{risk.label}</Text>
                    </View>
                  </View>
                  <Text style={s.reqDesc} numberOfLines={2}>{req.description}</Text>
                  <View style={s.reqMeta}>
                    <Text style={s.reqTime}>{relativeTime(req.timestamp)}</Text>
                    {req.amount !== undefined && (
                      <Text style={s.reqAmount}>${req.amount.toLocaleString()}</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Inline Approve / Reject — THE UNFORGETTABLE ELEMENT */}
              <View style={s.actionRow}>
                <Pressable
                  style={[s.approveBtn, isProcessing && s.btnDisabled]}
                  onPress={() => handleApprove(req)}
                  disabled={isProcessing}
                >
                  <Text style={s.approveBtnText}>
                    {processing[req.id] === 'approving' ? '…' : 'Approve'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.denyBtn, isProcessing && s.btnDisabled]}
                  onPress={() => handleDeny(req)}
                  disabled={isProcessing}
                >
                  <Text style={s.denyBtnText}>
                    {processing[req.id] === 'denying' ? '…' : 'Reject'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    flex: 1,
  } as any,
  countBadge: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  } as any,
  reqRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  reqTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  agentCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  agentInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  reqInfo: { flex: 1, gap: 4 },
  reqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reqRequester: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  riskChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  } as any,
  reqDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  reqMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reqTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  reqAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  } as any,
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 54,
  },
  approveBtn: {
    flex: 1,
    height: 36,
    backgroundColor: '#22C55E',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  denyBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  denyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  } as any,
  btnDisabled: {
    opacity: 0.5,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
    color: '#22C55E',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  } as any,
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
});
