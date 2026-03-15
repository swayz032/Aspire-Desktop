import React, { useState, useCallback, memo, ComponentProps } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
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

interface Receipt {
  id: string;
  receipt_type?: string;
  actor?: string;
  status?: string;
  action?: string;
  result?: string;
  created_at?: string;
}

function statusConfig(status: string | undefined): { icon: string; color: string; bg: string } {
  const s = (status || '').toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'done') return { icon: 'checkmark-circle', color: C_GREEN, bg: 'rgba(34,197,94,0.15)'  };
  if (s === 'failed'  || s === 'error')                    return { icon: 'close-circle',     color: C_RED,   bg: 'rgba(239,68,68,0.15)'  };
  return                                                          { icon: 'time',              color: C_AMBER, bg: 'rgba(245,158,11,0.15)' };
}

interface ReceiptCardProps {
  receipt: Receipt;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

const ReceiptCard = memo(function ReceiptCard({ receipt, isOpen, onToggle }: ReceiptCardProps) {
  const { icon, color, bg } = statusConfig(receipt.status);
  return (
    <Pressable onPress={() => onToggle(receipt.id)} style={s.card}>
      <View style={[s.statusIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as ComponentProps<typeof Ionicons>['name']} size={20} color={color} />
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardType} numberOfLines={1}>
          {receipt.receipt_type || 'Execution'}
        </Text>
        {receipt.actor && (
          <Text style={s.cardActor} numberOfLines={1}>{receipt.actor}</Text>
        )}
      </View>
      {receipt.created_at && (
        <Text style={s.cardTime}>{timeAgo(receipt.created_at)}</Text>
      )}
      {isOpen && (receipt.action || receipt.result) && (
        <View style={s.insetBlock}>
          {receipt.action && (
            <View style={s.insetRow}>
              <Text style={s.insetKey}>ACTION</Text>
              <Text style={s.insetVal} numberOfLines={3}>{receipt.action}</Text>
            </View>
          )}
          {receipt.result && (
            <View style={s.insetRow}>
              <Text style={s.insetKey}>RESULT</Text>
              <Text style={s.insetVal} numberOfLines={4}>{receipt.result}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
});

export default function ReceiptsPanelContent(_props: PanelContentProps) {
  const { receipts: rawReceipts } = useRealtimeReceipts(80);
  const receipts                  = (rawReceipts || []) as unknown as Receipt[];
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => setExpanded(p => p === id ? null : id), []);

  const total   = receipts.length;
  const success = receipts.filter(r => ['success','completed','done'].includes((r.status||'').toLowerCase())).length;
  const failed  = receipts.filter(r => ['failed','error'].includes((r.status||'').toLowerCase())).length;

  return (
    <View style={s.root}>
      <View style={s.heroZone}>
        <View style={s.orbBehind} pointerEvents="none" />
        <Text style={s.heroLabel}>Execution Log</Text>
        <Text style={s.heroNumber}>{total}</Text>
        <Text style={s.heroSub}>Receipts recorded</Text>

        <View style={s.statRow}>
          <View style={s.statItem}>
            <View style={[s.statDot, { backgroundColor: C_GREEN }]} />
            <Text style={s.statText}>{success} passed</Text>
          </View>
          <View style={s.statItem}>
            <View style={[s.statDot, { backgroundColor: C_RED }]} />
            <Text style={s.statText}>{failed} failed</Text>
          </View>
          <View style={s.statItem}>
            <View style={[s.statDot, { backgroundColor: C_AMBER }]} />
            <Text style={s.statText}>{total - success - failed} pending</Text>
          </View>
        </View>
      </View>

      <Text style={s.sectionLabel}>RECENT ACTIVITY</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {receipts.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={BLUE} />
            <Text style={s.emptyStateTitle}>No receipts yet</Text>
            <Text style={s.emptyStateSub}>Execution events will appear here</Text>
          </View>
        )}
        {receipts.map(r => (
          <ReceiptCard key={r.id} receipt={r} isOpen={expanded === r.id} onToggle={handleToggle} />
        ))}
        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: SURFACE },
  heroZone:        { alignItems: 'center', paddingTop: 28, paddingBottom: 20, position: 'relative', overflow: 'hidden' },
  orbBehind:       {
    position: 'absolute', top: -80, right: -60, width: 280, height: 280,
    borderRadius: 140, backgroundColor: 'rgba(14,165,233,0.12)',
    ...(Platform.OS === 'web' ? { filter: 'blur(70px)' } : {}),
  },
  heroLabel:       { fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', color: TS, marginBottom: 8 },
  heroNumber:      { fontSize: 56, fontWeight: '800', color: TP, letterSpacing: -2 },
  heroSub:         { fontSize: 13, color: TS, marginTop: 6 },
  statRow:         { flexDirection: 'row', gap: 16, marginTop: 16 },
  statItem:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot:         { width: 8, height: 8, borderRadius: 4 },
  statText:        { fontSize: 12, color: TS, fontWeight: '500' },
  sectionLabel:    { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  list:            { flex: 1 },
  emptyState:      { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: TP, marginTop: 4 },
  emptyStateSub:   { fontSize: 13, color: TT },
  card:            { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', ...GLASS_WEB },
  statusIcon:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:        { flex: 1 },
  cardType:        { fontSize: 15, fontWeight: '700', color: TP },
  cardActor:       { fontSize: 12, color: TS, marginTop: 3 },
  cardTime:        { fontSize: 11, color: TT, flexShrink: 0 },
  insetBlock:      { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 12, marginTop: 10, gap: 10 },
  insetRow:        { gap: 4 },
  insetKey:        { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: TT },
  insetVal:        { fontSize: 13, color: TS, lineHeight: 19 },
  bottomSpacer:    { height: 32 },
});
