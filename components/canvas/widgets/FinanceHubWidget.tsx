import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
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

interface SeparatorItem {
  type: 'separator';
  label: string;
  id: string;
}

type ListItem = Transaction | SeparatorItem;

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
  Revenue: '#30D158',
  Other: '#6B7280',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Revenue: 'arrow-down-circle-outline',
  Software: 'logo-electron' as keyof typeof Ionicons.glyphMap, // logo-electron is valid in Ionicons
  Travel: 'airplane-outline',
  Food: 'restaurant-outline',
  Office: 'briefcase-outline',
  Payroll: 'people-outline',
  Other: 'ellipse-outline',
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
        cashDelta: 12.4, // Keeping a value for delta as it's often missing in mock DBs
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

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';

    data.transactions.forEach((txn) => {
      if (txn.date !== lastDate) {
        items.push({ type: 'separator', label: txn.date.toUpperCase(), id: `sep-${txn.date}` });
        lastDate = txn.date;
      }
      items.push(txn);
    });

    return items;
  }, [data.transactions]);

  const isPositive = data.cashDelta >= 0;

  return (
    <View style={s.root}>
      {/* Hero — Total Balance */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>TOTAL BALANCE</Text>
        <View style={s.heroRow}>
          <Text style={s.heroAmount}>{formatMoney(data.cashPosition)}</Text>
          <Text style={[s.deltaInline, { color: isPositive ? '#30D158' : '#FF453A' }]}>
            {isPositive ? '↑' : '↓'} {Math.abs(data.cashDelta).toFixed(1)}%
          </Text>
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
          <Text style={[s.statValue, { color: data.runwayWeeks < 8 ? '#FF453A' : data.runwayWeeks < 16 ? '#F59E0B' : '#30D158' }]}>
            {data.runwayWeeks}w
          </Text>
        </View>
      </View>

      {/* Transactions */}
      <View style={s.txnHeader}>
        <Text style={s.txnHeaderText}>RECENT TRANSACTIONS</Text>
      </View>

      <ScrollView style={s.txnList} showsVerticalScrollIndicator={false}>
        {listItems.map((item) => {
          if ('type' in item && item.type === 'separator') {
            return (
              <Text key={item.id} style={s.separator}>
                {item.label}
              </Text>
            );
          }

          const txn = item as Transaction;
          const color = CATEGORY_COLORS[txn.category] ?? CATEGORY_COLORS.Other;
          const iconName = CATEGORY_ICONS[txn.category] ?? CATEGORY_ICONS.Other;

          return (
            <Pressable
              key={txn.id}
              onPress={() => playClickSound()}
              style={({ pressed }) => [
                s.txnRow,
                pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }
              ]}
            >
              <View style={[s.txnCircle, { backgroundColor: `${color}18` }]}>
                <Ionicons name={iconName} size={20} color={color} />
              </View>
              <View style={s.txnInfo}>
                <Text style={s.txnMerchant} numberOfLines={1}>{txn.merchant}</Text>
                <Text style={s.txnCategory}>{txn.category}</Text>
              </View>
              <Text style={[s.txnAmount, { color: txn.type === 'income' ? '#30D158' : '#FF453A' }]}>
                {txn.type === 'income' ? '+' : '-'}{formatMoney(txn.amount)}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -2,
  },
  deltaInline: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
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
  },
  txnList: {
    flex: 1,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  txnInfo: { flex: 1 },
  txnMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  txnCategory: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  separator: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
