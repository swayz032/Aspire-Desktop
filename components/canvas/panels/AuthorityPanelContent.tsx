import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type { PanelContentProps } from './types';
import { timeAgo } from './utils';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const BLUE    = '#0ea5e9';
const SURFACE = 'rgba(6,6,10,0.98)';
const GLASS   = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.11)';
const TP      = '#FFFFFF';
const TS      = 'rgba(255,255,255,0.45)';
const TT      = 'rgba(255,255,255,0.25)';
const C_GREEN = '#22c55e';
const C_RED   = '#ef4444';
const C_AMBER = '#f59e0b';

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

interface AuthItem {
  id: string;
  title?: string;
  description?: string;
  risk_tier?: string;
  evidence?: string;
  created_at?: string;
  proposed_action?: string;
}

function riskColor(tier: string | undefined): string {
  const t = (tier || '').toLowerCase();
  if (t === 'red'    || t === 'high')   return C_RED;
  if (t === 'yellow' || t === 'medium') return C_AMBER;
  return C_GREEN;
}

function riskLabel(tier: string | undefined): string {
  const t = (tier || '').toLowerCase();
  if (t === 'red'    || t === 'high')   return 'HIGH';
  if (t === 'yellow' || t === 'medium') return 'MED';
  return 'LOW';
}

interface CardProps {
  item: AuthItem;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onReview: (id: string) => void;
}

const AuthCard = memo(function AuthCard({ item, isOpen, onToggle, onApprove, onDeny, onReview }: CardProps) {
  const col = riskColor(item.risk_tier);
  const lbl = riskLabel(item.risk_tier);
  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={[s.card, { borderLeftColor: col, borderLeftWidth: 3 }]}
    >
      <View style={s.cardTop}>
        <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={isOpen ? 4 : 2}>
          {item.title || 'Decision Required'}
        </Text>
        <View style={[s.chip, { backgroundColor: `${col}18`, borderColor: `${col}50` }]}>
          <Text style={[s.chipText, { color: col }]}>{lbl}</Text>
        </View>
      </View>
      {item.created_at && (
        <Text style={s.cardTime}>{timeAgo(item.created_at)}</Text>
      )}
      {isOpen && (
        <>
          {item.proposed_action && (
            <Text style={s.propAction} numberOfLines={3}>Action: {item.proposed_action}</Text>
          )}
          {item.evidence && (
            <View style={s.evidenceBlock}>
              <Text style={s.evidenceLabel}>EVIDENCE</Text>
              <Text style={s.evidenceText} numberOfLines={4}>{item.evidence}</Text>
            </View>
          )}
          <View style={s.actionRow}>
            <Pressable style={s.approveBtn} onPress={() => onApprove(item.id)}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
              <Text style={s.approveBtnText}>Approve</Text>
            </Pressable>
            <Pressable style={s.denyBtn} onPress={() => onDeny(item.id)}>
              <Ionicons name="close" size={14} color={C_RED} />
              <Text style={s.denyBtnText}>Deny</Text>
            </Pressable>
            <Pressable style={s.reviewBtn} onPress={() => onReview(item.id)}>
              <Text style={s.reviewBtnText}>Review</Text>
            </Pressable>
          </View>
        </>
      )}
    </Pressable>
  );
});

function AuthorityPanelContentInner(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [items, setItems]       = useState<AuthItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/authority-queue');
      const d   = await res.json();
      setItems(d.items || d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { load(); }, [load]);

  const handleToggle  = useCallback((id: string) => setExpanded(prev => prev === id ? null : id), []);

  const handleApprove = useCallback(async (id: string) => {
    try {
      await authenticatedFetch(`/api/authority-queue/${id}/approve`, { method: 'POST' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const handleDeny = useCallback(async (id: string) => {
    try {
      await authenticatedFetch(`/api/authority-queue/${id}/deny`, { method: 'POST' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const handleReview = useCallback(async (id: string) => {
    try {
      await authenticatedFetch(`/api/authority-queue/${id}/defer`, { method: 'POST' });
    } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const pending = items.length;

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <Text style={s.heroLabel}>Authority Queue</Text>
        <Text style={s.heroNumber}>{pending}</Text>
        <Text style={s.heroSub}>Decision{pending !== 1 ? 's' : ''} Required</Text>
      </View>

      <Text style={s.sectionLabel}>PENDING DECISIONS</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading queue…</Text>}
        {!loading && items.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="shield-checkmark" size={40} color={BLUE} />
            <Text style={s.emptyStateTitle}>Queue clear</Text>
            <Text style={s.emptyStateSub}>No decisions awaiting review</Text>
          </View>
        )}
        {items.map(item => (
          <AuthCard
            key={item.id}
            item={item}
            isOpen={expanded === item.id}
            onToggle={handleToggle}
            onApprove={handleApprove}
            onDeny={handleDeny}
            onReview={handleReview}
          />
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: SURFACE },
  heroZone:        { alignItems: 'center', paddingTop: 28, paddingBottom: 24, position: 'relative', overflow: 'hidden' },
  orbBehind:       {
    position: 'absolute', top: -80, right: -60, width: 280, height: 280,
    borderRadius: 140, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } as any : {}),
  },
  heroLabel:       { fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', color: TS, marginBottom: 8 },
  heroNumber:      { fontSize: 56, fontWeight: '800', color: TP, letterSpacing: -2 },
  heroSub:         { fontSize: 13, color: TS, marginTop: 6 },
  sectionLabel:    { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  list:            { flex: 1 },
  emptyText:       { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  emptyState:      { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: TP, marginTop: 4 },
  emptyStateSub:   { fontSize: 13, color: TT },
  card:            {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: GLASS, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, ...GLASS_WEB,
  },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: TP, lineHeight: 21 },
  cardTime:        { fontSize: 11, color: TT, marginTop: 2 },
  chip:            { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, flexShrink: 0 },
  chipText:        { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  propAction:      { fontSize: 13, color: TS, marginTop: 10, lineHeight: 18 },
  evidenceBlock:   { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 12 },
  evidenceLabel:   { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: TT, marginBottom: 6 },
  evidenceText:    { fontSize: 12, color: TS, lineHeight: 18 },
  actionRow:       { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  approveBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: '#22c55e' },
  approveBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFF' },
  denyBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' },
  denyBtnText:     { fontSize: 13, fontWeight: '700', color: C_RED },
  reviewBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: BLUE },
  reviewBtnText:   { fontSize: 13, fontWeight: '600', color: BLUE },
  bottomSpacer:    { height: 32 },
});

export default function AuthorityPanelContent(props: any) {
  return (
    <PageErrorBoundary pageName="authority-panel-content">
      <AuthorityPanelContentInner {...props} />
    </PageErrorBoundary>
  );
}
