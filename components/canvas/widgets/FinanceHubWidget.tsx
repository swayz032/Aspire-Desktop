import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { playClickSound } from '@/lib/sounds';

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

interface FinanceData {
  cashPosition: number;
  cashDelta: number;
  receivable: number;
  payable: number;
  runwayWeeks: number;
  transactions: Transaction[];
}

interface FinanceHubWidgetProps {
  suiteId: string;
  officeId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Software: '#8B5CF6',
  Travel: '#3B82F6',
  Food: '#F97316',
  Office: '#10B981',
  Payroll: '#EF4444',
  Revenue: '#22C55E',
  Other: '#6B7280',
};

const DEMO_DATA: FinanceData = {
  cashPosition: 124500,
  cashDelta: 12.4,
  receivable: 38200,
  payable: 15600,
  runwayWeeks: 18,
  transactions: [
    { id: '1', merchant: 'Stripe Payout', category: 'Revenue', amount: 4800, type: 'income', date: 'Today' },
    { id: '2', merchant: 'Amazon Web Services', category: 'Software', amount: 890, type: 'expense', date: 'Today' },
    { id: '3', merchant: 'Figma', category: 'Software', amount: 45, type: 'expense', date: 'Yesterday' },
    { id: '4', merchant: 'Delta Airlines', category: 'Travel', amount: 620, type: 'expense', date: 'Mar 1' },
    { id: '5', merchant: 'Acme Corp', category: 'Revenue', amount: 12400, type: 'income', date: 'Mar 1' },
    { id: '6', merchant: 'Office Supplies', category: 'Office', amount: 156, type: 'expense', date: 'Feb 28' },
  ],
};

function formatMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export function FinanceHubWidget({ suiteId, officeId }: FinanceHubWidgetProps) {
  const [data, setData] = useState<FinanceData>(DEMO_DATA);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: cp, error } = await supabase
        .from('cash_position')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;

      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(10);

      setData({
        cashPosition: cp.cash_amount ?? DEMO_DATA.cashPosition,
        cashDelta: 0,
        receivable: DEMO_DATA.receivable,
        payable: DEMO_DATA.payable,
        runwayWeeks: cp.runway_weeks ?? DEMO_DATA.runwayWeeks,
        transactions: (txns ?? []).map((t: any) => ({
          id: t.id,
          merchant: t.merchant || 'Vendor',
          category: t.category || 'Other',
          amount: Math.abs(t.amount),
          type: t.amount >= 0 ? 'income' : 'expense',
          date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })),
      });
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isPositive = data.cashDelta >= 0;

  return (
    <View style={s.root}>
      {/* Hero — Total Balance */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>TOTAL BALANCE</Text>
        <View style={s.heroRow}>
          <Text style={s.heroAmount}>{formatMoney(data.cashPosition)}</Text>
          <View style={[s.deltaBadge, { backgroundColor: isPositive ? '#16A34A' : '#DC2626' }]}>
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color="#FFF"
            />
            <Text style={s.deltaText}>
              {isPositive ? '+' : ''}{data.cashDelta.toFixed(1)}%
            </Text>
          </View>
        </View>
        <Text style={s.heroSub}>Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <View style={s.statCol}>
          <Text style={s.statLabel}>RECEIVABLE</Text>
          <Text style={s.statValue}>{formatMoney(data.receivable)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCol}>
          <Text style={s.statLabel}>PAYABLE</Text>
          <Text style={s.statValue}>{formatMoney(data.payable)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCol}>
          <Text style={s.statLabel}>RUNWAY</Text>
          <Text style={[s.statValue, { color: data.runwayWeeks < 8 ? '#EF4444' : data.runwayWeeks < 16 ? '#F59E0B' : '#22C55E' }]}>
            {data.runwayWeeks}w
          </Text>
        </View>
      </View>

      {/* Transactions */}
      <View style={s.txnHeader}>
        <Text style={s.txnHeaderText}>RECENT TRANSACTIONS</Text>
      </View>

      <ScrollView style={s.txnList} showsVerticalScrollIndicator={false}>
        {data.transactions.map(txn => {
          const color = CATEGORY_COLORS[txn.category] ?? CATEGORY_COLORS.Other;
          return (
            <View key={txn.id} style={s.txnRow}>
              <View style={[s.txnCircle, { backgroundColor: `${color}22` }]}>
                <View style={[s.txnDot, { backgroundColor: color }]} />
              </View>
              <View style={s.txnInfo}>
                <Text style={s.txnMerchant} numberOfLines={1}>{txn.merchant}</Text>
                <Text style={s.txnCategory}>{txn.category} · {txn.date}</Text>
              </View>
              <Text style={[s.txnAmount, { color: txn.type === 'income' ? '#22C55E' : '#EF4444' }]}>
                {txn.type === 'income' ? '+' : '-'}{formatMoney(txn.amount)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050A12',
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    marginBottom: 4,
  } as any,
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -2,
  } as any,
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  heroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#080D14',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
  } as any,
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  txnHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  txnHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
  } as any,
  txnList: {
    flex: 1,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  txnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  txnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  txnInfo: { flex: 1 },
  txnMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  } as any,
  txnCategory: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  } as any,
});
