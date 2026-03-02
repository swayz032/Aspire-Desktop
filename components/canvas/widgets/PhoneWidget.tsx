import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import type { CallSession } from '@/types/frontdesk';

interface PhoneWidgetProps {
  suiteId: string;
  officeId: string;
}

type PhoneTab = 'keypad' | 'recent';
type CallFilter = 'all' | 'missed' | 'incoming' | 'outgoing' | 'voicemail';

const DIGITS = [
  { value: '1', letters: '' },
  { value: '2', letters: 'ABC' },
  { value: '3', letters: 'DEF' },
  { value: '4', letters: 'GHI' },
  { value: '5', letters: 'JKL' },
  { value: '6', letters: 'MNO' },
  { value: '7', letters: 'PQRS' },
  { value: '8', letters: 'TUV' },
  { value: '9', letters: 'WXYZ' },
  { value: '*', letters: '' },
  { value: '0', letters: '+' },
  { value: '#', letters: '' },
];

function formatE164Display(number: string | null): string {
  if (!number) return 'Unknown';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return day === 1 ? 'Yesterday' : `${day}d`;
}

function inferType(call: CallSession): 'incoming' | 'outgoing' | 'missed' | 'voicemail' {
  if (call.status === 'voicemail') return 'voicemail';
  if (call.direction === 'outbound') return 'outgoing';
  if (call.status === 'failed' || (call.status === 'completed' && (call.duration_seconds || 0) === 0)) return 'missed';
  return 'incoming';
}

function normalizeToE164(input: string): string {
  const cleaned = input.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (input.startsWith('+')) return input;
  return `+${cleaned}`;
}

function sectionLabel(iso: string): string {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = dayStart - 86400000;
  const time = new Date(iso).getTime();
  if (time >= dayStart) return 'Today';
  if (time >= yesterdayStart) return 'Yesterday';
  return '';
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PhoneWidget(_: PhoneWidgetProps) {
  const router = useRouter();
  const { calls, loading, error, refresh } = useFrontdeskCalls({ pollInterval: 5000, limit: 30 });
  const [tab, setTab] = useState<PhoneTab>('keypad');
  const [filter, setFilter] = useState<CallFilter>('all');
  const [dialValue, setDialValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const normalizedCalls = useMemo(
    () => calls.map((call) => ({ call, type: inferType(call) })),
    [calls],
  );

  const filteredCalls = useMemo(() => {
    if (filter === 'all') return normalizedCalls;
    return normalizedCalls.filter((entry) => entry.type === filter);
  }, [normalizedCalls, filter]);

  const activeCall = useMemo(
    () => calls.find((call) => call.status === 'in_progress' || call.status === 'ringing') || null,
    [calls],
  );
  const lastCompletedCall = useMemo(
    () => (activeCall ? null : calls.find((call) => call.status === 'completed') || null),
    [calls, activeCall],
  );

  const placeCall = async (toNumber?: string): Promise<void> => {
    const toE164 = normalizeToE164(toNumber || dialValue);
    if (!toE164 || busy) return;
    setBusy(true);
    setCallError(null);
    try {
      const res = await fetch('/api/frontdesk/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toE164 }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Call failed (${res.status})`);
      }
      setDialValue('');
      refresh();
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Failed to place call');
    } finally {
      setBusy(false);
    }
  };

  const returnCall = async (callSessionId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setCallError(null);
    try {
      const res = await fetch('/api/frontdesk/return-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSessionId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Return call failed (${res.status})`);
      }
      refresh();
    } catch (err) {
      setCallError(err instanceof Error ? err.message : 'Failed to return call');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgAccentA} />
      <View style={styles.bgAccentB} />
      <View style={styles.topRow}>
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'keypad' && styles.tabActive]} onPress={() => setTab('keypad')}>
            <Text style={[styles.tabText, tab === 'keypad' && styles.tabTextActive]}>Keypad</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'recent' && styles.tabActive]} onPress={() => setTab('recent')}>
            <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>Recent</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/session/calls')} style={styles.expandBtn}>
          <Text style={styles.expandText}>Expand</Text>
        </Pressable>
      </View>

      {tab === 'keypad' ? (
        <View style={styles.keypadPane}>
          <View style={styles.displayWrap}>
            <TextInput
              value={dialValue}
              onChangeText={setDialValue}
              placeholder="Enter number"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.display}
              keyboardType="phone-pad"
            />
            <Pressable onPress={() => setDialValue((prev) => prev.slice(0, -1))} style={styles.backspaceBtn}>
              <Ionicons name="backspace-outline" size={16} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {DIGITS.map((digit) => (
              <Pressable
                key={digit.value}
                onPress={() => setDialValue((prev) => `${prev}${digit.value}`)}
                style={styles.digitBtn}
              >
                <Text style={styles.digitPrimary}>{digit.value}</Text>
                <Text style={styles.digitSecondary}>{digit.letters}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.callBtn, (busy || !dialValue) && styles.callBtnDisabled]}
            onPress={() => placeCall()}
            disabled={busy || !dialValue}
          >
            <Ionicons name="call" size={20} color="#fff" />
          </Pressable>

          <View style={styles.callControlsRow}>
            <View style={styles.controlPill}>
              <Ionicons name="volume-high-outline" size={13} color="rgba(255,255,255,0.88)" />
            </View>
            <View style={styles.controlPill}>
              <Ionicons name="mic-off-outline" size={13} color="rgba(255,255,255,0.88)" />
            </View>
            <View style={styles.controlPill}>
              <Ionicons name="keypad-outline" size={13} color="rgba(255,255,255,0.88)" />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.recentPane}>
          <Text style={styles.recentTitle}>Recent Calls</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', 'missed', 'incoming', 'outgoing', 'voicemail'] as CallFilter[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                style={[styles.filterPill, filter === value && styles.filterPillActive]}
              >
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <Text style={styles.helper}>Loading calls...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : filteredCalls.length === 0 ? (
            <Text style={styles.helper}>No calls yet</Text>
          ) : (
            <ScrollView style={styles.callList} showsVerticalScrollIndicator={false}>
              {filteredCalls.map(({ call, type }, idx) => {
                const typeColor =
                  type === 'missed' ? '#EF4444' : type === 'incoming' ? '#22C55E' : type === 'outgoing' ? '#38BDF8' : '#F59E0B';
                const iconName = type === 'incoming' ? 'arrow-down' : type === 'outgoing' ? 'arrow-up' : type === 'voicemail' ? 'recording-outline' : 'call-outline';
                const label = sectionLabel(call.started_at);
                const previousLabel = idx > 0 ? sectionLabel(filteredCalls[idx - 1].call.started_at) : '';

                return (
                  <View key={call.call_session_id}>
                    {label && label !== previousLabel ? <Text style={styles.sectionHeader}>{label}</Text> : null}
                    <View style={styles.callRow}>
                      <View style={styles.callMeta}>
                        <View style={styles.callTypeRow}>
                          <Ionicons name={iconName as any} size={12} color={typeColor} />
                          <Text style={[styles.callName, type === 'missed' && styles.callNameMissed]} numberOfLines={1}>
                            {call.caller_name || formatE164Display(call.from_number || call.to_number)}
                          </Text>
                        </View>
                        <Text style={styles.callSub}>
                          {`${formatE164Display(call.direction === 'outbound' ? call.to_number : call.from_number)} | ${getRelativeTime(call.started_at)}`}
                        </Text>
                      </View>
                      <Pressable onPress={() => returnCall(call.call_session_id)} style={styles.returnBtn}>
                        <Ionicons name="call" size={14} color="#22C55E" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {callError && <Text style={styles.errorText}>{callError}</Text>}

      {activeCall ? (
        <View style={styles.inCallOverlay}>
          <View style={styles.inCallRingOne} />
          <View style={styles.inCallRingTwo} />
          <Text style={styles.inCallLabel}>{activeCall.status === 'ringing' ? 'Incoming Call' : 'On Call'}</Text>
          <Text style={styles.inCallName} numberOfLines={1}>
            {activeCall.caller_name || formatE164Display(activeCall.from_number || activeCall.to_number)}
          </Text>
          <Pressable style={styles.endCallBtn} onPress={() => router.push('/session/calls')}>
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.endCallText}>Open Call Screen</Text>
          </Pressable>
        </View>
      ) : null}
      {!activeCall && lastCompletedCall ? (
        <View style={styles.callEndedCard}>
          <Text style={styles.callEndedLabel}>Call Ended</Text>
          <View style={styles.callEndedAvatar}>
            <Ionicons name="person" size={18} color="#E0F2FE" />
          </View>
          <Text style={styles.callEndedName} numberOfLines={1}>
            {lastCompletedCall.caller_name || formatE164Display(lastCompletedCall.from_number || lastCompletedCall.to_number)}
          </Text>
          <Text style={styles.callEndedMeta}>
            {`${formatDuration(lastCompletedCall.duration_seconds)} | ${getRelativeTime(lastCompletedCall.ended_at || lastCompletedCall.started_at)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071A2F',
    padding: 10,
    gap: 8,
    overflow: 'hidden',
  },
  bgAccentA: {
    position: 'absolute',
    top: -60,
    right: -35,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(14,165,233,0.16)',
  },
  bgAccentB: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 2,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(56,189,248,0.2)',
  },
  tabText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#BAE6FD',
  },
  expandBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  expandText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  keypadPane: {
    flex: 1,
    gap: 8,
  },
  displayWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingLeft: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' } as unknown as ViewStyle)
      : {}),
  },
  display: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    letterSpacing: 0.4,
    paddingVertical: 10,
    fontWeight: '600',
  },
  backspaceBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  digitBtn: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.09)' } as unknown as ViewStyle)
      : {}),
  },
  digitPrimary: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  digitSecondary: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 8,
    marginTop: 2,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  callBtn: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 22px rgba(34,197,94,0.55)' } as unknown as ViewStyle)
      : { shadowColor: '#22C55E', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 10 }),
  },
  callBtnDisabled: {
    opacity: 0.5,
  },
  callControlsRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  controlPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPane: {
    flex: 1,
    gap: 8,
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  filterRow: {
    gap: 6,
    paddingRight: 8,
  },
  filterPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderColor: 'rgba(56,189,248,0.55)',
  },
  filterText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#BAE6FD',
  },
  callList: {
    flex: 1,
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 4,
    fontWeight: '700',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  callMeta: {
    flex: 1,
    gap: 3,
  },
  callTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  callNameMissed: {
    color: '#FCA5A5',
  },
  callSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },
  returnBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  helper: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 11,
  },
  inCallOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,9,20,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  inCallRingOne: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  inCallRingTwo: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.55)',
  },
  inCallLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  inCallName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  endCallBtn: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endCallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  callEndedCard: {
    position: 'absolute',
    right: 10,
    top: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(7,26,47,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 118,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' } as unknown as ViewStyle)
      : {}),
  },
  callEndedLabel: {
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 9,
    fontWeight: '700',
  },
  callEndedAvatar: {
    marginTop: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
    backgroundColor: 'rgba(56,189,248,0.16)',
  },
  callEndedName: {
    marginTop: 5,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 110,
  },
  callEndedMeta: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
  },
});

