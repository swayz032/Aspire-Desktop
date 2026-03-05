import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
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

interface FinanceData {
  balance?: number;
  revenue?: number;
  expenses?: number;
  trend?: number;
}
interface Txn {
  id: string;
  merchant?: string;
  amount?: number;
  type?: string;
  created_at?: string;
  category?: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function TrendChip({ pct }: { pct: number }) {
  const up  = pct >= 0;
  const col = up ? C_GREEN : C_RED;
  return (
    <View style={[s.trendChip, { backgroundColor: `${col}18`, borderColor: `${col}50` }]}>
      <Ionicons name={up ? 'trending-up' : 'trending-down'} size={12} color={col} />
      <Text style={[s.trendText, { color: col }]}>{up ? '+' : ''}{pct.toFixed(1)}%</Text>
    </View>
  );
}

function IncomeBar({ revenue, expenses }: { revenue: number; expenses: number }) {
  const total  = (revenue + expenses) || 1;
  const revPct = Math.round((revenue  / total) * 100);
  const expPct = Math.round((expenses / total) * 100);
  return (
    <View style={s.barCard}>
      <View style={s.barHeader}>
        <View style={s.barLegendRow}>
          <View style={[s.barDot, { backgroundColor: C_GREEN }]} />
          <Text style={s.barLegendLabel}>Income</Text>
          <Text style={[s.barLegendAmt, { color: C_GREEN }]}>{fmt(revenue)}</Text>
        </View>
        <View style={s.barLegendRow}>
          <View style={[s.barDot, { backgroundColor: C_RED }]} />
          <Text style={s.barLegendLabel}>Expenses</Text>
          <Text style={[s.barLegendAmt, { color: C_RED }]}>{fmt(expenses)}</Text>
        </View>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { flex: revPct, backgroundColor: C_GREEN }]} />
        <View style={[s.barFill, { flex: expPct, backgroundColor: C_RED   }]} />
      </View>
    </View>
  );
}

export default function FinancePanelContent(_props: PanelContentProps) {
  const { authenticatedFetch } = useAuthFetch();
  const [finance, setFinance] = useState<FinanceData>({});
  const [txns, setTxns]       = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [fRes, tRes] = await Promise.allSettled([
        authenticatedFetch('/api/finance/summary'),
        authenticatedFetch('/api/finance/transactions?limit=20'),
      ]);
      if (fRes.status === 'fulfilled') {
        const d = await fRes.value.json();
        setFinance(d || {});
      }
      if (tRes.status === 'fulfilled') {
        const d = await tRes.value.json();
        setTxns(d.transactions || d || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => { load(); }, [load]);

  const balance  = finance.balance  ?? 0;
  const revenue  = finance.revenue  ?? 0;
  const expenses = finance.expenses ?? 0;
  const trend    = finance.trend    ?? 0;

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <Text style={s.heroLabel}>Total Balance</Text>
        <Text style={s.heroNumber}>{fmtFull(balance)}</Text>
        <TrendChip pct={trend} />
      </View>

      <View style={s.kpiRow}>
        <View style={[s.kpiCard, { borderColor: `${C_GREEN}40` }]}>
          <Ionicons name="arrow-down-circle" size={20} color={C_GREEN} style={{ marginBottom: 8 }} />
          <Text style={s.kpiNum}>{fmt(revenue)}</Text>
          <Text style={s.kpiLbl}>Revenue</Text>
        </View>
        <View style={[s.kpiCard, { borderColor: `${C_RED}40` }]}>
          <Ionicons name="arrow-up-circle" size={20} color={C_RED} style={{ marginBottom: 8 }} />
          <Text style={s.kpiNum}>{fmt(expenses)}</Text>
          <Text style={s.kpiLbl}>Expenses</Text>
        </View>
      </View>

      {(revenue > 0 || expenses > 0) && (
        <IncomeBar revenue={revenue} expenses={expenses} />
      )}

      <Text style={s.sectionLabel}>RECENT TRANSACTIONS</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {loading && <Text style={s.emptyText}>Loading…</Text>}
        {!loading && txns.length === 0 && <Text style={s.emptyText}>No recent transactions</Text>}
        {txns.map(txn => {
          const isCredit = txn.type === 'credit';
          const col      = isCredit ? C_GREEN : C_RED;
          const amt      = txn.amount ?? 0;
          return (
            <View key={txn.id} style={s.txnCard}>
              <View style={[s.txnIcon, { backgroundColor: `${col}18` }]}>
                <Ionicons
                  name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={20} color={col}
                />
              </View>
              <View style={s.txnBody}>
                <Text style={s.txnMerchant} numberOfLines={1}>
                  {txn.merchant || txn.category || 'Transaction'}
                </Text>
                {txn.created_at && (
                  <Text style={s.txnDate}>{timeAgo(txn.created_at)}</Text>
                )}
              </View>
              <Text style={[s.txnAmount, { color: col }]}>
                {isCredit ? '+' : '−'}{fmtFull(amt)}
              </Text>
            </View>
          );
        })}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: SURFACE },
  heroZone:      { alignItems: 'center', paddingTop: 28, paddingBottom: 24, position: 'relative', overflow: 'hidden' },
  orbBehind:     {
    position: 'absolute', top: -80, right: -60, width: 280, height: 280,
    borderRadius: 140, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } as any : {}),
  },
  heroLabel:     { fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', color: TS, marginBottom: 8 },
  heroNumber:    { fontSize: 52, fontWeight: '800', color: TP, letterSpacing: -1.5 },
  trendChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginTop: 12 },
  trendText:     { fontSize: 12, fontWeight: '600' },
  kpiRow:        { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  kpiCard:       { flex: 1, backgroundColor: GLASS, borderRadius: 16, borderWidth: 1, padding: 16, ...GLASS_WEB },
  kpiNum:        { fontSize: 24, fontWeight: '800', color: TP },
  kpiLbl:        { fontSize: 10, color: TT, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' },
  barCard:       { marginHorizontal: 16, marginBottom: 10, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, ...GLASS_WEB },
  barHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  barLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barDot:        { width: 8, height: 8, borderRadius: 4 },
  barLegendLabel:{ fontSize: 12, color: TS },
  barLegendAmt:  { fontSize: 13, fontWeight: '700' },
  barTrack:      { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  barFill:       { height: 8 },
  sectionLabel:  { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  list:          { flex: 1 },
  emptyText:     { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  txnCard:       { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...GLASS_WEB },
  txnIcon:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txnBody:       { flex: 1 },
  txnMerchant:   { fontSize: 15, fontWeight: '700', color: TP },
  txnDate:       { fontSize: 11, color: TT, marginTop: 3 },
  txnAmount:     { fontSize: 15, fontWeight: '700', flexShrink: 0 },
  bottomSpacer:  { height: 32 },
});
