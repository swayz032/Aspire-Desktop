import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { playClickSound } from '@/lib/sounds';

interface Receipt {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  status: 'pending' | 'completed' | 'flagged';
}

interface ReceiptsWidgetProps {
  suiteId: string;
  officeId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#F97316',
  Travel: '#3B82F6',
  Software: '#8B5CF6',
  Office: '#10B981',
  Other: '#6B7280',
};

const CATEGORIES = ['All', 'Food', 'Travel', 'Software', 'Office'];

const DEMO_RECEIPTS: Receipt[] = [
  { id: '1', merchant: 'Starbucks', category: 'Food', amount: 12.50, date: 'Today', status: 'completed' },
  { id: '2', merchant: 'Uber', category: 'Travel', amount: 24.20, date: 'Today', status: 'completed' },
  { id: '3', merchant: 'GitHub Copilot', category: 'Software', amount: 19.00, date: 'Yesterday', status: 'completed' },
  { id: '4', merchant: 'WeWork', category: 'Office', amount: 350.00, date: 'Mar 1', status: 'completed' },
  { id: '5', merchant: 'Chipotle', category: 'Food', amount: 16.80, date: 'Mar 1', status: 'completed' },
  { id: '6', merchant: 'Delta Airlines', category: 'Travel', amount: 620.00, date: 'Feb 28', status: 'pending' },
  { id: '7', merchant: 'Figma', category: 'Software', amount: 45.00, date: 'Feb 27', status: 'completed' },
  { id: '8', merchant: 'Amazon', category: 'Office', amount: 89.99, date: 'Feb 26', status: 'flagged' },
];

export function ReceiptsWidget({ suiteId, officeId }: ReceiptsWidgetProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'Food': return 'restaurant-outline';
      case 'Travel': return 'airplane-outline';
      case 'Software': return 'code-slash-outline';
      case 'Office': return 'briefcase-outline';
      case 'Other': return 'receipt-outline';
      case 'Revenue': return 'arrow-down-circle-outline';
      case 'Payroll': return 'people-outline';
      default: return 'receipt-outline';
    }
  };

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('suite_id', suiteId)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const mapped: Receipt[] = (data ?? []).map((r: any) => ({
        id: r.id,
        merchant: r.description || r.merchant || 'Vendor',
        category: r.category || 'Other',
        amount: Math.abs(r.amount ?? 0),
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status: r.status === 'SUCCEEDED' ? 'completed' : 'pending',
      }));
      setReceipts(mapped.length > 0 ? mapped : DEMO_RECEIPTS);
    } catch {
      setReceipts(DEMO_RECEIPTS);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  const filtered = useMemo(() =>
    receipts.filter(r =>
      (activeFilter === 'All' || r.category === activeFilter) &&
      (!searchQuery || r.merchant.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [receipts, activeFilter, searchQuery]
  );

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Receipts</Text>
        <Text style={s.headerTotal}>${total.toFixed(2)}</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.3)" />
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search receipts…"
          placeholderTextColor="rgba(255,255,255,0.25)"
        />
      </View>

      {/* Category filters */}
      <View style={s.filterRow}>
        {CATEGORIES.map(cat => {
          const active = activeFilter === cat;
          const color = CATEGORY_COLORS[cat] ?? '#6B7280';
          return (
            <Pressable
              key={cat}
              style={[
                s.filterChip, 
                active && { 
                  backgroundColor: `${color}22`,
                  borderColor: `${color}55`,
                }
              ]}
              onPress={() => { playClickSound(); setActiveFilter(cat); }}
            >
              <Text style={[s.filterChipText, active && { color }]}>
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Receipt list */}
      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={36} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyText}>{loading ? 'Loading…' : 'No receipts found'}</Text>
          </View>
        }
        renderItem={({ item: receipt }) => {
          const color = CATEGORY_COLORS[receipt.category] ?? CATEGORY_COLORS.Other;
          const statusColor = receipt.status === 'flagged' ? '#EF4444' : receipt.status === 'pending' ? '#F59E0B' : '#10B981';
          return (
            <Pressable 
              style={({ pressed }) => [
                s.receiptRow,
                pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }
              ]}
              onPress={() => playClickSound()}
            >
              <View style={[s.receiptCircle, { backgroundColor: `${color}18` }]}>
                <Ionicons name={getCategoryIcon(receipt.category) as keyof typeof Ionicons.glyphMap} size={18} color={color} />
              </View>
              <View style={s.receiptInfo}>
                <Text style={s.receiptMerchant} numberOfLines={1}>{receipt.merchant}</Text>
                <Text style={s.receiptMeta}>{receipt.category} · {receipt.date}</Text>
              </View>
              <View style={s.receiptRight}>
                <Text style={s.receiptAmount}>${receipt.amount.toFixed(2)}</Text>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable 
            style={({ pressed }) => [
              s.uploadBtn,
              pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }
            ]} 
            onPress={() => playClickSound()}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={s.uploadBtnText}>Upload Receipt</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  headerTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFF',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' }) : {}),
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  filterChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  empty: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.22)',
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  receiptCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  receiptCatLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  receiptInfo: { flex: 1 },
  receiptMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  receiptMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  receiptRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  receiptAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  uploadBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
});
