import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import {
  dismissIncomingCallOverlay,
  getIncomingCallOverlayState,
  showIncomingCallOverlay,
  subscribeIncomingCallOverlay,
} from '@/lib/incomingCallOverlayStore';

function formatDisplayNumber(number: string | null): string {
  if (!number) return 'Unknown number';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

function playRingTone(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [740, 880, 988];

    notes.forEach((freq: number, index: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.14);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + index * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.14 + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + index * 0.14);
      oscillator.stop(ctx.currentTime + index * 0.14 + 0.18);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // no-op
  }
}

export function IncomingCallOverlay(): React.ReactElement | null {
  const router = useRouter();
  const { calls } = useFrontdeskCalls({ pollInterval: 2500, limit: 30 });
  const [overlayState, setOverlayState] = useState(getIncomingCallOverlayState());

  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const suppressedCallIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeIncomingCallOverlay(setOverlayState);
    return unsubscribe;
  }, []);

  const ringingCall = useMemo(
    () => calls.find((call) => call.status === 'ringing' && call.direction === 'inbound') || null,
    [calls],
  );

  useEffect(() => {
    if (ringingCall && !overlayState.visible && !suppressedCallIds.current.has(ringingCall.call_session_id)) {
      showIncomingCallOverlay(ringingCall, false);
    }
  }, [ringingCall, overlayState.visible]);

  useEffect(() => {
    if (!overlayState.visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, damping: 16, stiffness: 220, mass: 0.9, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    ringPulse.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();

    playRingTone();
    const interval = setInterval(playRingTone, 2000);
    return () => clearInterval(interval);
  }, [overlayState.visible]);

  if (!overlayState.visible || !overlayState.call) return null;

  const call = overlayState.call;
  const callerName = call.caller_name || 'Incoming caller';
  const callerNumber = formatDisplayNumber(call.from_number);

  const ringStyle = {
    opacity: ringPulse.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.4, 0.1, 0] }),
    transform: [{ scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
  };

  const handleReject = (): void => {
    if (overlayState.call) {
      suppressedCallIds.current.add(overlayState.call.call_session_id);
    }
    dismissIncomingCallOverlay();
  };

  const handleAccept = (): void => {
    if (overlayState.call) {
      suppressedCallIds.current.add(overlayState.call.call_session_id);
    }
    dismissIncomingCallOverlay();
    router.push('/session/calls');
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <Text style={styles.label}>Incoming Call</Text>

        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="rgba(255,255,255,0.92)" />
          </View>
        </View>

        <Text style={styles.name}>{callerName}</Text>
        <Text style={styles.number}>{callerNumber}</Text>

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.reject]} onPress={handleReject}>
            <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.accept]} onPress={handleAccept}>
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.actionText}>Accept</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as unknown as ViewStyle) : {}),
  },
  card: {
    width: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(10,18,34,0.9)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.2)' } as unknown as ViewStyle)
      : { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 18 }),
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  avatarWrap: {
    marginTop: 18,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.65)',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(11,30,58,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  number: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reject: {
    backgroundColor: '#EF4444',
  },
  accept: {
    backgroundColor: '#22C55E',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

