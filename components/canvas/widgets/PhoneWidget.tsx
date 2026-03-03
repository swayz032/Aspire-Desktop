import React, { useState, useCallback } from 'react';
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

  return (
    <LinearGradient colors={['#071A2F', '#0A2540']} style={s.root}>
      {/* Tabs */}
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

      {tab === 'keypad' && (
        <View style={s.keypadContainer}>
          {/* Number display */}
          <View style={s.display}>
            <Text style={s.displayText} numberOfLines={1}>
              {dialNumber ? formatDisplay(dialNumber) : ' '}
            </Text>
            {dialNumber.length > 0 && (
              <Pressable onPress={handleDelete} style={s.deleteBtn} hitSlop={8}>
                <Ionicons name="backspace-outline" size={22} color="rgba(255,255,255,0.45)" />
              </Pressable>
            )}
          </View>

          {/* Dial grid */}
          <View style={s.grid}>
            {DIGITS.map(d => (
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

          {/* Call button */}
          <View style={s.callRow}>
            <Pressable style={s.callBtnOuter} onPress={handleCall}>
              <View style={[s.callBtnInner, Platform.OS === 'web' && ({ boxShadow: '0 0 24px #22C55E88' } as any)]}>
                <Ionicons name="call" size={30} color="#FFF" />
              </View>
            </Pressable>
          </View>
        </View>
      )}

      {tab === 'recent' && (
        <FlatList
          data={calls}
          keyExtractor={c => c.call_session_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.recentList}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="call-outline" size={36} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyText}>{loading ? 'Loading…' : 'No recent calls'}</Text>
            </View>
          }
          renderItem={({ item: call }) => {
            const icon = callIcon(call);
            return (
              <View style={s.recentRow}>
                <View style={[s.recentIcon, { backgroundColor: `${icon.color}22` }]}>
                  <Ionicons name={icon.name as any} size={16} color={icon.color} />
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
              </View>
            );
          }}
        />
      )}

      {tab === 'contacts' && (
        <View style={s.emptyState}>
          <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.1)" />
          <Text style={s.emptyText}>No contacts yet</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '600',
  } as any,
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  } as any,
  tabUnderline: {
    position: 'absolute',
    bottom: -4,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#22C55E',
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
    minHeight: 60,
    marginBottom: 12,
    position: 'relative',
  },
  displayText: {
    fontSize: 34,
    fontWeight: '300',
    color: '#FFF',
    letterSpacing: 2,
    textAlign: 'center',
    flex: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: 'monospace' } as any) : {}),
  },
  deleteBtn: {
    position: 'absolute',
    right: 0,
    padding: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    marginBottom: 20,
  },
  dialBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  dialBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ scale: 0.93 }],
  },
  dialDigit: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 28,
  } as any,
  dialSub: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    lineHeight: 12,
  } as any,
  callRow: {
    alignItems: 'center',
  },
  callBtnOuter: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  callBtnInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#22C55E',
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
    paddingVertical: 14,
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
  } as any,
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
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 14,
  },
});
