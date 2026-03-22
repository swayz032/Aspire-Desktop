import React, { useState, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
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

const GLASS_WEB: any = Platform.OS === 'web'
  ? { backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }
  : {};

const DIALPAD = [
  { num: '1', sub: '' },   { num: '2', sub: 'ABC' },  { num: '3', sub: 'DEF' },
  { num: '4', sub: 'GHI' }, { num: '5', sub: 'JKL' }, { num: '6', sub: 'MNO' },
  { num: '7', sub: 'PQRS' },{ num: '8', sub: 'TUV' }, { num: '9', sub: 'WXYZ' },
  { num: '*', sub: '' },   { num: '0', sub: '+' },    { num: '#', sub: '' },
];

interface Call {
  id: string;
  caller_name?: string;
  from?: string;
  direction?: string;
  status?: string;
  started_at?: string;
  duration?: number;
}

function callTypeStyle(dir: string | undefined, status: string | undefined): { label: string; bg: string; bd: string; col: string } {
  const d = (dir || '').toLowerCase();
  const s = (status || '').toLowerCase();
  if (s === 'missed' || s === 'no-answer') return { label: 'MISSED', bg: 'rgba(239,68,68,0.15)', bd: 'rgba(239,68,68,0.5)', col: C_RED };
  if (d === 'inbound') return { label: 'INBOUND', bg: 'rgba(34,197,94,0.15)', bd: 'rgba(34,197,94,0.5)', col: C_GREEN };
  return { label: 'OUTBOUND', bg: 'rgba(14,165,233,0.15)', bd: 'rgba(14,165,233,0.5)', col: BLUE };
}

interface RecentCallRowProps {
  call: Call;
  onCallBack: (phone: string) => void;
}
const RecentCallRow = memo(function RecentCallRow({ call, onCallBack }: RecentCallRowProps) {
  const cs = callTypeStyle(call.direction, call.status);
  return (
    <View style={s.callCard}>
      <View style={[s.callIcon, { backgroundColor: `${cs.col}18` }]}>
        <Ionicons name="call" size={18} color={cs.col} />
      </View>
      <View style={s.callBody}>
        <Text style={s.callName} numberOfLines={1}>{call.caller_name || call.from || 'Unknown'}</Text>
        <View style={[s.chip, { backgroundColor: cs.bg, borderColor: cs.bd }]}>
          <Text style={[s.chipText, { color: cs.col }]}>{cs.label}</Text>
        </View>
      </View>
      <View style={s.callMeta}>
        {call.started_at && <Text style={s.callTime}>{timeAgo(call.started_at)}</Text>}
        {call.from && (
          <Pressable style={s.callBackBtn} onPress={() => onCallBack(call.from!)}>
            <Text style={s.callBackText}>Call Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

type Tab = 'dialpad' | 'recent';

function CallsPanelContentInner(_props: PanelContentProps) {
  const { calls: rawCalls }      = useFrontdeskCalls();
  const calls                    = (rawCalls || []) as unknown as Call[];
  const [tab, setTab]            = useState<Tab>('dialpad');
  const [digits, setDigits]      = useState('');
  const [calling, setCalling]    = useState(false);

  const handleKey = useCallback((k: string) => {
    setDigits(prev => (prev + k).slice(0, 15));
  }, []);
  const handleDelete = useCallback(() => {
    setDigits(prev => prev.slice(0, -1));
  }, []);
  const handleCall = useCallback(async () => {
    if (!digits || calling) return;
    setCalling(true);
    try {
      await fetch('/api/frontdesk/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: digits }),
      });
    } catch { /* ignore */ } finally {
      setCalling(false);
      setDigits('');
    }
  }, [digits, calling]);

  const handleCallBack = useCallback(async (phone: string) => {
    try {
      await fetch('/api/frontdesk/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone }),
      });
    } catch { /* ignore */ }
  }, []);

  return (
    <View style={s.root}>
      <View style={s.orbBehind} pointerEvents="none" />
      <View style={s.tabBar}>
        {(['dialpad', 'recent'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'dialpad' ? 'Dial Pad' : 'Recent'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'dialpad' ? (
        <View style={s.dialRoot}>
          <View style={s.displayCard}>
            <Text style={[s.displayNum, !digits && s.displayPlaceholder]}>
              {digits || 'Enter number'}
            </Text>
            {digits.length > 0 && (
              <Pressable onPress={handleDelete} style={s.deleteBtn}>
                <Ionicons name="backspace-outline" size={22} color={TS} />
              </Pressable>
            )}
          </View>

          <View style={s.dialGrid}>
            {DIALPAD.map(key => (
              <Pressable key={key.num} onPress={() => handleKey(key.num)} style={s.dialKey}>
                <Text style={s.dialNum}>{key.num}</Text>
                {key.sub ? <Text style={s.dialSub}>{key.sub}</Text> : null}
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleCall}
            style={[s.callBtn, !digits && s.callBtnDisabled]}
            disabled={!digits || calling}
          >
            <Ionicons name="call" size={28} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>RECENT CALLS</Text>
          {calls.length === 0 && <Text style={s.emptyText}>No recent calls</Text>}
          {calls.map(call => (
            <RecentCallRow key={call.id} call={call} onCallBack={handleCallBack} />
          ))}
          <View style={s.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: SURFACE, position: 'relative' },
  orbBehind:        {
    position: 'absolute', top: -60, right: -60, width: 240, height: 240,
    borderRadius: 120, backgroundColor: 'rgba(14,165,233,0.10)',
    pointerEvents: 'none',
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } as any : {}),
  },
  tabBar:           { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 12, backgroundColor: GLASS, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 4 },
  tab:              { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  tabActive:        { backgroundColor: BLUE },
  tabText:          { fontSize: 14, fontWeight: '600', color: TS },
  tabTextActive:    { color: '#FFF' },
  dialRoot:         { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  displayCard:      {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: GLASS, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 20, paddingVertical: 16, marginBottom: 24,
    ...GLASS_WEB,
  },
  displayNum:       { fontSize: 32, fontWeight: '800', color: TP, letterSpacing: 2, flex: 1 },
  displayPlaceholder: { color: TT, fontWeight: '400', fontSize: 18 },
  deleteBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dialGrid:         { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: 12, marginBottom: 28 },
  dialKey:          {
    width: '28%', aspectRatio: 1,
    backgroundColor: GLASS, borderRadius: 999,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: '2.5%',
    ...GLASS_WEB,
  },
  dialNum:          { fontSize: 22, fontWeight: '700', color: TP },
  dialSub:          { fontSize: 9, color: TT, letterSpacing: 1.5, marginTop: 2 },
  callBtn:          { width: 72, height: 72, borderRadius: 36, backgroundColor: C_GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  callBtnDisabled:  { opacity: 0.4 },
  list:             { flex: 1 },
  sectionLabel:     { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: TT, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  emptyText:        { fontSize: 14, color: TT, textAlign: 'center', paddingTop: 40 },
  callCard:         { marginHorizontal: 16, marginBottom: 8, backgroundColor: GLASS, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...GLASS_WEB },
  callIcon:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  callBody:         { flex: 1, gap: 5 },
  callName:         { fontSize: 15, fontWeight: '700', color: TP },
  chip:             { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText:         { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  callMeta:         { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  callTime:         { fontSize: 10, color: TT },
  callBackBtn:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BLUE },
  callBackText:     { fontSize: 11, fontWeight: '600', color: BLUE },
  bottomSpacer:     { height: 32 },
});

export default function CallsPanelContent(props: any) {
  return (
    <PageErrorBoundary pageName="calls-panel-content">
      <CallsPanelContentInner {...props} />
    </PageErrorBoundary>
  );
}
