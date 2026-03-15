import React, { useState, useCallback, ComponentProps } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import { playClickSound, playMicActivateSound } from '@/lib/sounds';
import type { CallSession } from '@/types/frontdesk';

interface PhoneWidgetProps {
  suiteId: string;
  officeId: string;
}

type PhoneTab = 'keypad' | 'recent' | 'contacts';

const DIGITS = [
  { value: '1', sub: '' },
  { value: '2', sub: 'ABC' },
  { value: '3', sub: 'DEF' },
  { value: '4', sub: 'GHI' },
  { value: '5', sub: 'JKL' },
  { value: '6', sub: 'MNO' },
  { value: '7', sub: 'PQRS' },
  { value: '8', sub: 'TUV' },
  { value: '9', sub: 'WXYZ' },
  { value: '*', sub: '' },
  { value: '0', sub: '+' },
  { value: '#', sub: '' },
];

function formatDisplay(number: string): string {
  const c = number.replace(/\D/g, '');
  if (c.length === 11 && c.startsWith('1')) return `+1 (${c.slice(1, 4)}) ${c.slice(4, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}`;
  return number;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return Math.floor(h / 24) === 1 ? 'Yesterday' : `${Math.floor(h / 24)}d ago`;
}

function callIcon(call: CallSession): { name: string; color: string } {
  if (call.status === 'voicemail') return { name: 'voicemail', color: '#8B5CF6' };
  if (call.status === 'failed' || call.status === 'blocked') return { name: 'arrow-down', color: '#EF4444' };
  if (call.direction === 'outbound') return { name: 'arrow-up', color: '#3B82F6' };
  return { name: 'arrow-down', color: '#10B981' };
}

export function PhoneWidget({ suiteId, officeId }: PhoneWidgetProps) {
  const [tab, setTab] = useState<PhoneTab>('keypad');
  const [dialNumber, setDialNumber] = useState('');
  const { calls, loading } = useFrontdeskCalls();

  const handleDigit = useCallback((d: string) => {
    playClickSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDialNumber(prev => prev + d);
  }, []);

  const handleDelete = useCallback(() => {
    setDialNumber(prev => prev.slice(0, -1));
  }, []);

  const handleCall = useCallback(() => {
    if (!dialNumber) return;
    playMicActivateSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [dialNumber]);

  const TABS: { key: PhoneTab; label: string }[] = [
    { key: 'keypad', label: 'Keypad' },
    { key: 'recent', label: 'Recent' },
    { key: 'contacts', label: 'Contacts' },
  ];

  const renderKeypad = () => {
    const rows = [
      DIGITS.slice(0, 3),
      DIGITS.slice(3, 6),
      DIGITS.slice(6, 9),
      DIGITS.slice(9, 12),
    ];

    return (
      <View style={s.keypadContainer}>
        {/* Number display */}
        <View style={s.display}>
          <Text style={s.displayText} numberOfLines={1}>
            {dialNumber ? formatDisplay(dialNumber) : ' '}
          </Text>
          {dialNumber.length > 0 && (
            <Pressable onPress={handleDelete} style={s.deleteBtn} hitSlop={8}>
              <Ionicons name="backspace-outline" size={24} color="rgba(255,255,255,0.45)" />
            </Pressable>
          )}
        </View>

        {/* Dial grid */}
        <View style={s.grid}>
          {rows.map((row, i) => (
            <View key={i} style={s.gridRow}>
              {row.map(d => (
                <Pressable
                  key={d.value}
                  style={({ pressed }) => [s.dialBtn, pressed && s.dialBtnPressed]}
                  onPress={() => handleDigit(d.value)}
                >
                  <Text style={s.dialDigit}>{d.value}</Text>
                  {d.sub ? <Text style={s.dialSub}>{d.sub}</Text> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* Call button */}
        <View style={s.callRow}>
          <Pressable style={s.callBtnOuter} onPress={handleCall}>
            <View style={[s.callBtnInner, Platform.OS === 'web' && ({ boxShadow: '0 0 24px rgba(59,130,246,0.5)' })]}>
              <Ionicons name="call" size={32} color="#FFF" />
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      {tab === 'keypad' && renderKeypad()}

      {tab === 'recent' && (
        <FlatList
          data={calls}
          keyExtractor={c => c.call_session_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.recentList}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="call-outline" size={36} color="rgba(255,255,255,0.25)" />
              <Text style={s.emptyText}>{loading ? 'Loading…' : 'No recent calls'}</Text>
            </View>
          }
          renderItem={({ item: call }) => {
            const icon = callIcon(call);
            return (
              <Pressable style={({ pressed }) => [s.recentRow, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                <View style={[s.recentIcon, { backgroundColor: `${icon.color}22` }]}>
                  <Ionicons name={icon.name as ComponentProps<typeof Ionicons>['name']} size={16} color={icon.color} />
                </View>
                <View style={s.recentInfo}>
                  <Text style={s.recentName}>
                    {call.caller_name || call.from_number || 'Unknown'}
                  </Text>
                  <Text style={s.recentTime}>{relativeTime(call.created_at)}</Text>
                </View>
                <Pressable
                  style={s.recentCallBtn}
                  onPress={() => {
                    if (call.from_number) {
                      setDialNumber(call.from_number);
                      setTab('keypad');
                    }
                  }}
                >
                  <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.5)" />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {tab === 'contacts' && (
        <View style={s.emptyState}>
          <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.25)" />
          <Text style={s.emptyText}>No contacts yet</Text>
        </View>
      )}

      {/* Tabs at bottom */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[s.tabItem, tab === t.key && s.tabItemActive]}
            onPress={() => { playClickSound(); setTab(t.key); }}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {tab === t.key && <View style={s.tabUnderline} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    top: -1,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#3B82F6',
    borderRadius: 1,
  },
  keypadContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginBottom: 12,
    position: 'relative',
  },
  displayText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 2,
    textAlign: 'center',
    flex: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: 'monospace' }) : {}),
  },
  deleteBtn: {
    position: 'absolute',
    right: 0,
    padding: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  grid: {
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  dialBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
    }) : {}),
  },
  dialBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ scale: 0.95 }],
  },
  dialDigit: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 30,
  },
  dialSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
    lineHeight: 12,
  },
  callRow: {
    alignItems: 'center',
  },
  callBtnOuter: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  callBtnInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#3B82F6',
      shadowOpacity: 0.55,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    } : {}),
  },
  recentList: {
    paddingBottom: 20,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentInfo: { flex: 1 },
  recentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  recentTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  recentCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
});
