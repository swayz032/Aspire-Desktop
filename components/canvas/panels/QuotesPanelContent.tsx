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

interface Quote {
  id: string;
  quote_number?: string;
  client_name?: string;
  amount?: number;
  status?: string;
  valid_until?: string;
  created_at?: string;
}

function statusStyle(status: string | undefined): { bg: string; bd: string; col: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s === 'accepted') return { bg: 'rgba(34,197,94,0.15)',  bd: 'rgba(34,197,94,0.5)',  col: C_GREEN, label: 'ACCEPTED' };
  if (s === 'expired')  return { bg: 'rgba(239,68,68,0.15)',  bd: 'rgba(239,68,68,0.5)',  col: C_RED,   label: 'EXPIRED'  };
  return                       { bg: 'rgba(245,158,11,0.15)', bd: 'rgba(245,158,11,0.5)', col: C_AMBER, label: 'OPEN'     };
}

function fmtAmt(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

interface QuoteCardProps {
  quote: Quote;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onConvert: (id: string) => void;
  onSend: (id: string) => void;
  onVoid: (id: string) => void;
}

const QuoteCard = memo(function QuoteCard({ quote, isOpen, onToggle, onConvert, onSend, onVoid }: QuoteCardProps) {
  const ss = statusStyle(quote.status);
  return (
    <Pressable onPress={() => onToggle(quote.id)} style={s.card}>
      <View style={s.cardMain}>
        <View style={[s.iconWrap, { backgroundColor: 'rgba(14,165,233,0.15)' }]}>
          <Ionicons name="receipt" size={20} color={BLUE} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardClient} numberOfLines={1}>{quote.client_name || 'Client'}</Text>
          <Text style={s.cardNum}>{quote.quote_number || `Q-${quote.id.slice(0, 6)}`}</Text>
        </View>
        <View style={s.cardRight}>
          <Text style={s.cardAmt}>{fmtAmt(quote.amount)}</Text>
          <View style={[s.chip, { backgroundColor: ss.bg, borderColor: ss.bd }]}>
            <Text style={[s.chipText, { color: ss.col }]}>{ss.label}</Text>
          </View>
        </View>
      </View>
      {quote.valid_until && (
        <Text style={s.cardTime}>Valid until {timeAgo(quote.valid_until)}</Text>
      )}
      {isOpen && (
        <View style={s.actionRow}>
          {quote.status !== 'accepted' && (
            <Pressable style={s.solidBtn} onPress={() => onConvert(quote.id)}>
              <Text style={s.solidBtnText}>→ Invoice</Text>
            </Pressable>
          )}
          <Pressable style={s.ghostBtn} onPress={() => onSend(quote.id)}>
            <Ionicons name="send" size={12} color={BLUE} />
            <Text style={s.ghostBtnText}>Send</Text>
          </Pressable>
          {quote.status !== 'accepted' && (
            <Pressable style={s.dangerBtn} onPress={() => onVoid(quote.id)}>
              <Text style={s.dangerBtnText}>Void</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
});

function QuotesPanelContentInner(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [quotes, setQuotes]     = useState<Quote[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/quotes?limit=30');
      const d   = await res.json();
      setQuotes(d.quotes || d || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { load(); }, [load]);

  const handleToggle  = useCallback((id: string) => setExpanded(p => p === id ? null : id), []);
  const handleConvert = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/quotes/${id}/convert`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);
  const handleSend = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/quotes/${id}/send`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);
  const handleVoid = useCallback(async (id: string) => {
    try { await authenticatedFetch(`/api/quotes/${id}/void`, { method: 'POST' }); } catch { /* ignore */ }
  }, [authenticatedFetch]);

  const total    = quotes.length;
  const open     = quotes.filter(q => q.status === 'open'  || q.status === 'draft' || !q.status).length;
  const accepted = quotes.filter(q => q.status === 'accepted').length;
  const expired  = quotes.filter(q => q.status === 'expired').length;

  const sections = [
    { label: 'OPEN',     items: quotes.filter(q => q.status === 'open' || q.status === 'draft' || !q.status) },
    { label: 'ACCEPTED', items: quotes.filter(q => q.status === 'accepted') },
    { label: 'EXPIRED',  items: quotes.filter(q => q.status === 'expired') },
  ].filter(sec => sec.items.length > 0);

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <View style={s.kpiGrid}>
          {[
            { label: 'Total',    value: total,    col: TP     },
            { label: 'Open',     value: open,     col: C_AMBER },
            { label: 'Accepted', value: accepted, col: C_GREEN },
            { label: 'Expired',  value: expired,  col: C_RED   },
          ].map(k => (
            <View key={k.label} style={s.kpiTile}>
              <Text style={[s.kpiNum, { color: k.col }]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading quotes…</Text>}
        {!loading && quotes.length === 0 && <Text style={s.emptyText}>No quotes found</Text>}
        {sections.map(sec => (
          <View key={sec.label}>
            <Text style={s.sectionLabel}>{sec.label}</Text>
            {sec.items.map(q => (
              <QuoteCard
                key={q.id} quote={q}
                isOpen={expanded === q.id}
                onToggle={handleToggle}
                onConvert={handleConvert}
                onSend={handleSend}
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
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } as any : {}),
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

export default function QuotesPanelContent(props: any) {
  return (
    <PageErrorBoundary pageName="quotes-panel-content">
      <QuotesPanelContentInner {...props} />
    </PageErrorBoundary>
  );
}
