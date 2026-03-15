import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PressableState } from '@/types/common';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';

const filters = ['All', 'Payments', 'Proposals', 'Approvals', 'Transfers'];

type TimelineEvent = {
  eventId: string;
  provider: string;
  eventType: string;
  occurredAt: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  entityRefs: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type ReceiptItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  accentColor: string;
  title: string;
  description: string;
  amount: string;
  time: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  category: string;
  successLike: boolean;
};

const premiumCardStyle = {
  backgroundColor: CARD_BG,
  borderColor: CARD_BORDER,
};

function formatMoney(cents: number | null, currency?: string | null): string {
  if (cents === null || cents === undefined) return '-';
  const value = cents / 100;
  const code = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value);
  } catch {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function relativeTime(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return ts;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function mapEventToCategory(eventType: string): string {
  if (eventType.includes('proposal')) return 'Proposals';
  if (eventType.includes('approval') || eventType.includes('approved') || eventType.includes('denied')) return 'Approvals';
  if (eventType.includes('transfer') || eventType.includes('payout')) return 'Transfers';
  return 'Payments';
}

function mapEventToReceipt(evt: TimelineEvent): ReceiptItem {
  const statusRaw = (evt.status || '').toLowerCase();
  const category = mapEventToCategory((evt.eventType || '').toLowerCase());
  const isSuccess = statusRaw === 'posted' || statusRaw === 'succeeded' || statusRaw === 'approved' || statusRaw === 'paid';
  const isPending = statusRaw === 'pending' || statusRaw === 'open';

  const icon = isSuccess ? 'checkmark-circle' : isPending ? 'alert-circle' : 'close-circle';
  const accentColor = isSuccess ? Colors.semantic.success : isPending ? Colors.accent.amber : Colors.semantic.error;
  const badge = isSuccess ? 'Success' : isPending ? 'Pending' : 'Failed';
  const badgeBg = isSuccess ? Colors.semantic.successLight : isPending ? Colors.accent.amberLight : Colors.semantic.errorLight;

  const metaTitle = typeof evt.metadata?.title === 'string' ? evt.metadata.title : null;
  const eventName = evt.eventType.replace(/_/g, ' ');
  const title = metaTitle || `${evt.provider.toUpperCase()} ${eventName}`.replace(/\b\w/g, m => m.toUpperCase());
  const summary = typeof evt.metadata?.summary === 'string'
    ? evt.metadata.summary
    : `${evt.provider} ${evt.eventType}`.replace(/_/g, ' ');

  return {
    id: evt.eventId,
    icon,
    iconColor: accentColor,
    accentColor,
    title,
    description: summary,
    amount: formatMoney(evt.amount, evt.currency),
    time: relativeTime(evt.occurredAt),
    badge,
    badgeColor: accentColor,
    badgeBg,
    category,
    successLike: isSuccess,
  };
}

export default function ReceiptsScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/timeline?range=30d&limit=200');
      if (!res.ok) throw new Error(`Timeline fetch failed (${res.status})`);
      const data = await res.json();
      const events: TimelineEvent[] = Array.isArray(data.events) ? data.events : [];
      setItems(events.map(mapEventToReceipt));
    } catch (e: any) {
      setError(e?.message || 'Failed to load receipts timeline');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const filtered = useMemo(
    () => (activeFilter === 'All' ? items : items.filter((r) => r.category === activeFilter)),
    [activeFilter, items],
  );

  const stats = useMemo(() => {
    const total = items.length;
    const successful = items.filter(i => i.successLike).length;
    const failed = items.filter(i => i.badge === 'Failed').length;
    const pending = items.filter(i => i.badge === 'Pending').length;
    return [
      { label: `${total} total receipts`, color: Colors.text.secondary },
      { label: `${successful} successful`, color: Colors.semantic.success },
      { label: `${pending} pending`, color: Colors.accent.amber },
      { label: `${failed} failed`, color: Colors.semantic.error },
    ];
  }, [items]);

  return (
    <FinanceHubShell>
      <View style={styles.headerRow}>
        <View>
          <Text style={[Typography.display, { color: Colors.text.primary, marginBottom: 4 }]}>Finance Receipts</Text>
          <Text style={[Typography.body, { color: Colors.text.tertiary }]}>Live audit trail for financial actions</Text>
        </View>
        <Pressable
          onPress={loadTimeline}
          style={({ hovered }: PressableState) => [
            styles.filterDropdown,
            { backgroundColor: CARD_BG, borderColor: CARD_BORDER },
            hovered && { borderColor: Colors.border.strong },
          ]}
        >
          <Ionicons name="refresh" size={16} color={Colors.text.tertiary} />
          <Text style={styles.filterDropdownText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.filtersRow}>
        {filters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setActiveFilter(f)}
            style={({ hovered }: PressableState) => [
              styles.filterPill,
              activeFilter === f && styles.filterPillActive,
              hovered && activeFilter !== f && styles.filterPillHover,
            ]}
          >
            <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.emptyTitle}>Loading live finance receipts...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={22} color={Colors.semantic.error} />
          <Text style={styles.emptyTitle}>Could not load receipts timeline</Text>
          <Text style={styles.emptySub}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={22} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No live receipts for this filter</Text>
          <Text style={styles.emptySub}>New provider events will appear here automatically.</Text>
        </View>
      ) : (
        <View style={styles.receiptsList}>
          {filtered.map((r) => (
            <Pressable
              key={r.id}
              style={({ hovered }: PressableState) => [
                styles.receiptCard,
                premiumCardStyle,
                hovered && styles.receiptCardHover,
              ]}
            >
              {Platform.OS === 'web' && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', backgroundImage: svgPatterns.invoice(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '15% auto', opacity: 0.5 }} />
              )}
              <View style={[styles.accentBorder, { backgroundColor: r.accentColor }]} />
              <View style={[styles.receiptIcon, { backgroundColor: `${r.accentColor}15` }]}>
                <Ionicons name={r.icon} size={22} color={r.iconColor} />
              </View>
              <View style={styles.receiptContent}>
                <Text style={styles.receiptTitle}>{r.title}</Text>
                <Text style={styles.receiptDesc}>{r.description}</Text>
              </View>
              <Text style={styles.receiptAmount}>{r.amount}</Text>
              <Text style={styles.receiptTime}>{r.time}</Text>
              <View style={[styles.badge, { backgroundColor: r.badgeBg }, Platform.OS === 'web' && { boxShadow: `0 0 8px ${r.badgeColor}30` }]}>
                <Text style={[styles.badgeText, { color: r.badgeColor }]}>{r.badge}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.statsBar, premiumCardStyle]}>
        {Platform.OS === 'web' && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none', backgroundImage: svgPatterns.barChart(), backgroundRepeat: 'no-repeat', backgroundPosition: 'center center', backgroundSize: '60% auto', opacity: 0.4 }} />
        )}
        {stats.map((s, i) => (
          <View key={s.label} style={styles.statItem}>
            {i > 0 && <View style={styles.statDivider} />}
            <View style={[styles.statDot, { backgroundColor: s.color }]} />
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } : {}),
  },
  filterDropdownText: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease' } : {}),
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  filterPillHover: {
    backgroundColor: '#1a1f2e',
  },
  filterPillText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  receiptsList: {
    gap: 8,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } : {}),
  },
  receiptCardHover: {
    backgroundColor: '#1a1f2e',
  },
  accentBorder: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginLeft: -16,
    marginRight: 4,
  },
  receiptIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptContent: {
    flex: 1,
  },
  receiptTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptDesc: {
    color: Colors.text.tertiary,
    fontSize: 12,
    marginTop: 2,
  },
  receiptAmount: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 90,
    textAlign: 'right',
  },
  receiptTime: {
    color: Colors.text.muted,
    fontSize: 12,
    minWidth: 70,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 70,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginTop: 20,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: CARD_BORDER,
    marginRight: 8,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
