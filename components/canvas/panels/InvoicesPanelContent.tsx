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

interface Invoice {
  id: string;
  invoice_number?: string;
  customer_name?: string;
  amount?: number;
  status?: string;
  due_date?: string;
  created_at?: string;
}

function statusStyle(status: string | undefined): { bg: string; bd: string; col: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s === 'paid')     return { bg: 'rgba(34,197,94,0.15)',  bd: 'rgba(34,197,94,0.5)',  col: C_GREEN, label: 'PAID'     };
  if (s === 'overdue')  return { bg: 'rgba(239,68,68,0.15)',  bd: 'rgba(239,68,68,0.5)',  col: C_RED,   label: 'OVERDUE'  };
  if (s === 'draft')    return { bg: 'rgba(255,255,255,0.08)',bd: 'rgba(255,255,255,0.2)',col: TS,      label: 'DRAFT'    };
  return                       { bg: 'rgba(245,158,11,0.15)', bd: 'rgba(245,158,11,0.5)', col: C_AMBER, label: 'PENDING'  };
}

function fmtAmt(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

interface InvCardProps {
  inv: Invoice;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onSend: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onVoid: (id: string) => void;
}

const InvCard = memo(function InvCard({ inv, isOpen, onToggle, onSend, onMarkPaid, onVoid }: InvCardProps) {
  const ss = statusStyle(inv.status);
  return (
    <Pressable onPress={() => onToggle(inv.id)} style={s.card}>
      <View style={s.cardMain}>
        <View style={[s.iconWrap, { backgroundColor: 'rgba(14,165,233,0.15)' }]}>
          <Ionicons name="document-text" size={20} color={BLUE} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardCustomer} numberOfLines={1}>{inv.customer_name || 'Customer'}</Text>
          <Text style={s.cardNum}>{inv.invoice_number || `#${inv.id.slice(0, 8)}`}</Text>
        </View>
        <View style={s.cardRight}>
          <Text style={s.cardAmt}>{fmtAmt(inv.amount)}</Text>
          <View style={[s.chip, { backgroundColor: ss.bg, borderColor: ss.bd }]}>
            <Text style={[s.chipText, { color: ss.col }]}>{ss.label}</Text>
          </View>
        </View>
      </View>
      {inv.due_date && (
        <Text style={s.cardTime}>Due {timeAgo(inv.due_date)}</Text>
      )}
      {isOpen && (
        <View style={s.actionRow}>
          {inv.status !== 'paid' && (
            <Pressable style={s.solidBtn} onPress={() => onMarkPaid(inv.id)}>
              <Text style={s.solidBtnText}>Mark Paid</Text>
            </Pressable>
          )}
          <Pressable style={s.ghostBtn} onPress={() => onSend(inv.id)}>
            <Ionicons name="send" size={12} color={BLUE} />
            <Text style={s.ghostBtnText}>Send</Text>
          </Pressable>
          {inv.status !== 'paid' && (
            <Pressable style={s.dangerBtn} onPress={() => onVoid(inv.id)}>
              <Text style={s.dangerBtnText}>Void</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
});

export default function InvoicesPanelContent(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/invoices?limit=30');
      const d   = await res.json();
      setInvoices(d.invoices || d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { load(); }, [load]);

  const handleToggle  = useCallback((id: string) => setExpanded(p => p === id ? null : id), []);
  const handleSend    = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/invoices/${id}/send`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);
  const handleMarkPaid = useCallback(async (id: string) => {
    try {
      await authenticatedFetch(`/api/invoices/${id}/mark-paid`, { method: 'POST' });
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' } : i));
    } catch { /* ignore */ }
  }, [authenticatedFetch]);
  const handleVoid = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/invoices/${id}/void`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const total   = invoices.length;
  const open    = invoices.filter(i => i.status === 'open'    || i.status === 'pending').length;
  const paid    = invoices.filter(i => i.status === 'paid').length;
  const overdue = invoices.filter(i => i.status === 'overdue').length;

  const sections: { label: string; items: Invoice[] }[] = [
    { label: 'OVERDUE',           items: invoices.filter(i => i.status === 'overdue') },
    { label: 'AWAITING PAYMENT',  items: invoices.filter(i => i.status === 'open' || i.status === 'pending' || i.status === 'draft') },
    { label: 'PAID',              items: invoices.filter(i => i.status === 'paid') },
  ].filter(s => s.items.length > 0);

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <View style={s.kpiGrid}>
          {[
            { label: 'Total',   value: total,   col: TP     },
            { label: 'Open',    value: open,    col: C_AMBER },
            { label: 'Paid',    value: paid,    col: C_GREEN },
            { label: 'Overdue', value: overdue, col: C_RED   },
          ].map(k => (
            <View key={k.label} style={s.kpiTile}>
              <Text style={[s.kpiNum, { color: k.col }]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading invoices…</Text>}
        {!loading && invoices.length === 0 && <Text style={s.emptyText}>No invoices found</Text>}
        {sections.map(sec => (
          <View key={sec.label}>
            <Text style={s.sectionLabel}>{sec.label}</Text>
            {sec.items.map(inv => (
              <InvCard
                key={inv.id} inv={inv}
                isOpen={expanded === inv.id}
                onToggle={handleToggle}
                onSend={handleSend}
                onMarkPaid={handleMarkPaid}
                onVoid={handleVoid}
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
  cardCustomer: { fontSize: 15, fontWeight: '700', color: TP },
  cardNum:      { fontSize: 11, color: TT, marginTop: 2 },
  cardRight:    { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  cardAmt:      { fontSize: 15, fontWeight: '700', color: TP },
  chip:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  cardTime:     { fontSize: 11, color: TT, marginTop: 6, paddingLeft: 52 },
  actionRow:    { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  solidBtn:     { flex: 1, height: 40, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  solidBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  ghostBtn:     { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: BLUE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ghostBtnText: { fontSize: 12, fontWeight: '600', color: BLUE },
  dangerBtn:    { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  dangerBtnText:{ fontSize: 12, fontWeight: '600', color: C_RED },
  bottomSpacer: { height: 32 },
});
