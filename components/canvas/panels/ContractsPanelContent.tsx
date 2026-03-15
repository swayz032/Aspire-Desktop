import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type { PanelContentProps } from './types';
import { timeAgo } from './utils';

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

interface Contract {
  id: string;
  contract_number?: string;
  client_name?: string;
  value?: number;
  status?: string;
  end_date?: string;
  created_at?: string;
}

function statusStyle(status: string | undefined): { bg: string; bd: string; col: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s === 'active')   return { bg: 'rgba(34,197,94,0.15)',  bd: 'rgba(34,197,94,0.5)',  col: C_GREEN, label: 'ACTIVE'   };
  if (s === 'expired')  return { bg: 'rgba(239,68,68,0.15)',  bd: 'rgba(239,68,68,0.5)',  col: C_RED,   label: 'EXPIRED'  };
  if (s === 'pending')  return { bg: 'rgba(245,158,11,0.15)', bd: 'rgba(245,158,11,0.5)', col: C_AMBER, label: 'PENDING'  };
  return                       { bg: 'rgba(14,165,233,0.15)', bd: 'rgba(14,165,233,0.5)', col: BLUE,    label: 'DRAFT'    };
}

function fmtAmt(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

interface ContractCardProps {
  contract: Contract;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onSign: (id: string) => void;
  onView: (id: string) => void;
}

const ContractCard = memo(function ContractCard({ contract, isOpen, onToggle, onSign, onView }: ContractCardProps) {
  const ss = statusStyle(contract.status);
  const needsSign = contract.status === 'pending' || contract.status === 'draft';
  return (
    <Pressable onPress={() => onToggle(contract.id)} style={s.card}>
      <View style={s.cardMain}>
        <View style={[s.iconWrap, { backgroundColor: 'rgba(14,165,233,0.15)' }]}>
          <Ionicons name="document-lock" size={20} color={BLUE} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardClient} numberOfLines={1}>{contract.client_name || 'Client'}</Text>
          <Text style={s.cardNum}>{contract.contract_number || `C-${contract.id.slice(0, 6)}`}</Text>
        </View>
        <View style={s.cardRight}>
          <Text style={s.cardVal}>{fmtAmt(contract.value)}</Text>
          <View style={[s.chip, { backgroundColor: ss.bg, borderColor: ss.bd }]}>
            <Text style={[s.chipText, { color: ss.col }]}>{ss.label}</Text>
          </View>
        </View>
      </View>
      {contract.end_date && (
        <Text style={s.cardTime}>Ends {timeAgo(contract.end_date)}</Text>
      )}
      {isOpen && (
        <View style={s.actionRow}>
          {needsSign && (
            <Pressable style={s.solidBtn} onPress={() => onSign(contract.id)}>
              <Ionicons name="pencil" size={13} color="#FFF" />
              <Text style={s.solidBtnText}>Sign Now</Text>
            </Pressable>
          )}
          <Pressable style={s.ghostBtn} onPress={() => onView(contract.id)}>
            <Ionicons name="eye" size={13} color={BLUE} />
            <Text style={s.ghostBtnText}>View</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
});

export default function ContractsPanelContent(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/contracts?limit=30');
      const d   = await res.json();
      setContracts(d.contracts || d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = useCallback((id: string) => setExpanded(p => p === id ? null : id), []);
  const handleSign   = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/contracts/${id}/sign`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);
  const handleView   = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/contracts/${id}/view`); } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const total   = contracts.length;
  const active  = contracts.filter(c => c.status === 'active').length;
  const pending = contracts.filter(c => c.status === 'pending' || c.status === 'draft').length;
  const expired = contracts.filter(c => c.status === 'expired').length;

  const sections = [
    { label: 'ACTIVE',             items: contracts.filter(c => c.status === 'active') },
    { label: 'PENDING SIGNATURE',  items: contracts.filter(c => c.status === 'pending' || c.status === 'draft') },
    { label: 'EXPIRED',            items: contracts.filter(c => c.status === 'expired') },
  ].filter(sec => sec.items.length > 0);

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <View style={s.kpiGrid}>
          {[
            { label: 'Total',   value: total,   col: TP     },
            { label: 'Active',  value: active,  col: C_GREEN },
            { label: 'Pending', value: pending, col: C_AMBER },
            { label: 'Expired', value: expired, col: C_RED   },
          ].map(k => (
            <View key={k.label} style={s.kpiTile}>
              <Text style={[s.kpiNum, { color: k.col }]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading contracts…</Text>}
        {!loading && contracts.length === 0 && <Text style={s.emptyText}>No contracts found</Text>}
        {sections.map(sec => (
          <View key={sec.label}>
            <Text style={s.sectionLabel}>{sec.label}</Text>
            {sec.items.map(c => (
              <ContractCard
                key={c.id} contract={c}
                isOpen={expanded === c.id}
                onToggle={handleToggle}
                onSign={handleSign}
                onView={handleView}
              />
            ))}
          </View>
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: SURFACE },
  heroZone:     { paddingTop: 20, paddingBottom: 16, position: 'relative', overflow: 'hidden' },
  orbBehind:    {
    position: 'absolute', top: -80, right: -60, width: 260, height: 260,
    borderRadius: 130, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } : {}),
  },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  kpiTile:      { flex: 1, minWidth: '40%', backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, alignItems: 'center', ...GLASS_WEB },
  kpiNum:       { fontSize: 28, fontWeight: '800' },
  kpiLabel:     { fontSize: 10, color: TT, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  list:         { flex: 1 },
  emptyText:    { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  card:         { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, ...GLASS_WEB },
  cardMain:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:     { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:     { flex: 1 },
  cardClient:   { fontSize: 15, fontWeight: '700', color: TP },
  cardNum:      { fontSize: 11, color: TT, marginTop: 2 },
  cardRight:    { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  cardVal:      { fontSize: 15, fontWeight: '700', color: TP },
  chip:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  cardTime:     { fontSize: 11, color: TT, marginTop: 6, paddingLeft: 52 },
  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  solidBtn:     { flex: 1, height: 44, borderRadius: 12, backgroundColor: BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  solidBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  ghostBtn:     { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ghostBtnText: { fontSize: 13, fontWeight: '600', color: BLUE },
  bottomSpacer: { height: 32 },
});
