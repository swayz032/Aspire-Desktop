import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { playClickSound, playApproveSound } from '@/lib/sounds';

interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  company_name: string;
  valid_until: string;
  line_items: LineItem[];
  total_amount: number;
  status: string;
  created_at: string;
}

interface QuoteWidgetProps {
  suiteId: string;
  officeId: string;
  quoteId?: string;
  onSendClick?: (quoteId: string) => void;
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusColor(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'accepted' || lower === 'paid') return '#10B981';
  if (lower === 'sent' || lower === 'pending') return '#3B82F6';
  if (lower === 'declined') return '#EF4444';
  return '#6B7280';
}

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
function avatarColor(name: string): string {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const DEMO_QUOTE: Quote = {
  id: 'demo-1',
  quote_number: 'QT-2026-042',
  client_name: 'Jennifer Walsh',
  company_name: 'Acme Corporation',
  valid_until: new Date(Date.now() + 14 * 86400000).toISOString(),
  status: 'draft',
  created_at: new Date().toISOString(),
  total_amount: 14400,
  line_items: [
    { name: 'Platform License', description: 'Annual SaaS license', quantity: 1, unit_price: 9600, total: 9600 },
    { name: 'Onboarding Package', description: 'Setup + training (4 sessions)', quantity: 1, unit_price: 3200, total: 3200 },
    { name: 'Priority Support', description: '12-month premium support', quantity: 1, unit_price: 1600, total: 1600 },
  ],
};

export function QuoteWidget({ suiteId, officeId, quoteId, onSendClick }: QuoteWidgetProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchQuote = useCallback(async () => {
    try {
      setLoading(true);
      const query = supabase.from('quotes').select('*').eq('suite_id', suiteId).eq('office_id', officeId);
      const finalQuery = quoteId ? query.eq('id', quoteId).single() : query.order('created_at', { ascending: false }).limit(1).single();
      const { data, error } = await finalQuery;
      if (error) throw error;
      const q: Quote = {
        id: data.id,
        quote_number: data.quote_number || `QT-${data.id.slice(0, 6).toUpperCase()}`,
        client_name: data.client_name || 'Client',
        company_name: data.company_name || '',
        valid_until: data.valid_until || new Date(Date.now() + 30 * 86400000).toISOString(),
        line_items: (data.line_items ?? []) as LineItem[],
        total_amount: data.total_amount ?? 0,
        status: data.status || 'draft',
        created_at: data.created_at,
      };
      setQuote(q);
    } catch {
      setQuote(DEMO_QUOTE);
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId, quoteId]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  const handleSend = useCallback(async () => {
    if (!quote || sending) return;
    setSending(true);
    playApproveSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await supabase.from('quotes').update({ status: 'sent' }).eq('id', quote.id);
      setQuote(q => q ? { ...q, status: 'sent' } : q);
      onSendClick?.(quote.id);
    } catch {}
    setSending(false);
  }, [quote, sending, onSendClick]);

  if (loading || !quote) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.mutedText}>Loading…</Text>
      </View>
    );
  }

  const sc = statusColor(quote.status);
  const color = avatarColor(quote.client_name);
  const validDate = new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <Text style={s.quoteNumber}>{quote.quote_number}</Text>
            <View style={[s.statusBadge, { backgroundColor: `${sc}22`, borderColor: sc }]}>
              <Text style={[s.statusText, { color: sc }]}>{quote.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Client row */}
          <View style={s.clientRow}>
            <View style={[s.clientAvatar, { backgroundColor: color }]}>
              <Text style={s.clientAvatarText}>{initials(quote.client_name)}</Text>
            </View>
            <View style={s.clientInfo}>
              <Text style={s.clientName}>{quote.client_name}</Text>
              {quote.company_name ? (
                <Text style={s.companyName}>{quote.company_name}</Text>
              ) : null}
              <Text style={s.validDate}>Valid until {validDate}</Text>
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={s.tableHeader}>
          <Text style={[s.col1, s.colHeader]}>ITEM</Text>
          <Text style={[s.colQty, s.colHeader]}>QTY</Text>
          <Text style={[s.colPrice, s.colHeader]}>PRICE</Text>
          <Text style={[s.colTotal, s.colHeader]}>TOTAL</Text>
        </View>

        {quote.line_items.map((item, idx) => (
          <View key={idx} style={s.lineRow}>
            <View style={s.col1}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </View>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colPrice}>${formatAmount(item.unit_price)}</Text>
            <Text style={s.colTotal}>${formatAmount(item.total)}</Text>
          </View>
        ))}

        {/* Total row */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>TOTAL</Text>
          <Text style={s.totalAmount}>${formatAmount(quote.total_amount)}</Text>
        </View>

        <View style={s.bottomSpacer} />
      </ScrollView>

      {/* Send CTA — the unforgettable element */}
      <View style={s.ctaWrap}>
        <Pressable
          style={s.ctaBtn}
          onPress={handleSend}
          disabled={sending || quote.status === 'sent'}
        >
          <LinearGradient
            colors={quote.status === 'sent' ? ['#374151', '#1F2937'] : ['#3B82F6', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGrad}
          >
            <Text style={s.ctaText}>
              {quote.status === 'sent' ? 'Quote Sent ✓' : sending ? 'Sending…' : 'Send Quote'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060A10',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quoteNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
  } as any,
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  } as any,
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  clientInfo: { flex: 1 },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  } as any,
  companyName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  validDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  col1: { flex: 1 },
  colQty: {
    width: 36,
    textAlign: 'center',
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  colTotal: {
    width: 80,
    textAlign: 'right',
  },
  colHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  } as any,
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  } as any,
  itemDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  } as any,
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  } as any,
  bottomSpacer: { height: 20 },
  ctaWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  ctaBtn: {
    borderRadius: 26,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  ctaGrad: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  } as any,
});
