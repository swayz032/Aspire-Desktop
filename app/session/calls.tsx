import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '@/constants/tokens';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { LinearGradient } from 'expo-linear-gradient';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import type { CallSession } from '@/types/frontdesk';

// ---------------------------------------------------------------------------
// Hero image
// ---------------------------------------------------------------------------

const callsHero = require('@/assets/images/calls-hero.jpg');

// ---------------------------------------------------------------------------
// DTMF Dialpad Audio (Web Audio API) -- copied exactly from working version
// ---------------------------------------------------------------------------

const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (Platform.OS !== 'web') return null;

  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }

    const ctx = sharedAudioContext;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }

    return sharedAudioContext;
  } catch (e) {
    return null;
  }
};

const playDTMFTone = (digit: string) => {
  const frequencies = DTMF_FREQUENCIES[digit];
  if (!frequencies) return;

  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  try {
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    frequencies.forEach(freq => {
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      oscillator.connect(gainNode);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);
    });
  } catch (e) {
    // Audio playback error -- silent fail
  }
};

let ringingInterval: ReturnType<typeof setInterval> | null = null;

const playRingingTone = () => {
  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  try {
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc1.connect(gainNode);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.4);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, audioCtx.currentTime);
    osc2.connect(gainNode);
    osc2.start(audioCtx.currentTime);
    osc2.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // Ringing error -- silent fail
  }
};

const startRinging = () => {
  playRingingTone();
  ringingInterval = setInterval(() => {
    playRingingTone();
  }, 3000);
};

const stopRinging = () => {
  if (ringingInterval) {
    clearInterval(ringingInterval);
    ringingInterval = null;
  }
};

// ---------------------------------------------------------------------------
// Dial pad layout
// ---------------------------------------------------------------------------

const DIAL_PAD = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

// ---------------------------------------------------------------------------
// Call filters
// ---------------------------------------------------------------------------

type CallFilter = 'All' | 'Missed' | 'Incoming' | 'Outgoing' | 'Voicemail';
const CALL_FILTERS: CallFilter[] = ['All', 'Missed', 'Incoming', 'Outgoing', 'Voicemail'];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

interface FormattedCall {
  id: string;
  name: string;
  number: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'voicemail';
  status: string;
  time: string;
  duration: string | null;
  hasVoicemail: boolean;
  hasRecording: boolean;
  callSessionId: string;
  rawNumber: string;
}

function formatCallSession(call: CallSession): FormattedCall {
  let type: FormattedCall['type'];
  if (call.status === 'voicemail') {
    type = 'voicemail';
  } else if (call.direction === 'outbound') {
    type = 'outgoing';
  } else if (call.status === 'failed' || (call.status === 'completed' && call.duration_seconds === 0)) {
    type = 'missed';
  } else {
    type = 'incoming';
  }

  const name = call.caller_name || call.to_number || call.from_number || 'Unknown';
  const rawNumber = call.direction === 'outbound' ? (call.to_number || '') : (call.from_number || '');
  const number = formatE164Display(rawNumber);
  const timeAgo = call.started_at ? getRelativeTime(call.started_at) : '';

  let duration: string | null = null;
  if (call.duration_seconds && call.duration_seconds > 0) {
    const m = Math.floor(call.duration_seconds / 60);
    const s = call.duration_seconds % 60;
    duration = `${m}:${s.toString().padStart(2, '0')}`;
  }

  return {
    id: call.call_session_id,
    name,
    number,
    type,
    status: call.status,
    time: timeAgo,
    duration,
    hasVoicemail: !!call.voicemail_url,
    hasRecording: !!call.recording_url,
    callSessionId: call.call_session_id,
    rawNumber,
  };
}

function getRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function formatE164Display(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

function formatPhoneNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Demo user for setup check
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CallsScreen() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const { calls: rawCalls, loading: callsLoading, error: callsError, refresh } = useFrontdeskCalls({ pollInterval: 5000 });

  // Formatted calls list
  const allCalls = rawCalls.slice(0, 25).map(formatCallSession);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<CallFilter>('All');

  const filteredCalls = allCalls.filter((call) => {
    switch (activeFilter) {
      case 'Missed': return call.type === 'missed';
      case 'Incoming': return call.type === 'incoming';
      case 'Outgoing': return call.type === 'outgoing';
      case 'Voicemail': return call.hasVoicemail || call.type === 'voicemail';
      default: return true;
    }
  });

  // Counts for badges
  const missedCount = allCalls.filter(c => c.type === 'missed').length;
  const voicemailCount = allCalls.filter(c => c.hasVoicemail || c.type === 'voicemail').length;
  const callbackCount = allCalls.filter(c => c.type === 'missed' && !c.hasVoicemail).length;

  // Dialpad state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'dialpad' | 'recent'>('dialpad');
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callingName, setCallingName] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [outboundBlocked, setOutboundBlocked] = useState(false);

  // Setup modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringAnim1 = useRef(new Animated.Value(0)).current;
  const ringAnim2 = useRef(new Animated.Value(0)).current;
  const ringAnim3 = useRef(new Animated.Value(0)).current;
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowPulseAnim = useRef(new Animated.Value(1)).current;
  const glowPulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Setup check
  // ---------------------------------------------------------------------------

  useEffect(() => {
    checkFrontDeskSetup();
  }, []);

  const checkFrontDeskSetup = async () => {
    try {
      const res = await fetch('/api/frontdesk/setup');
      if (res.ok) {
        const data = await res.json();
        if (!data || !data.setupComplete) {
          setShowSetupModal(true);
        }
      } else {
        setShowSetupModal(true);
      }
    } catch (_e) {
      // Setup check failed silently
    }
    setSetupChecked(true);
  };

  // ---------------------------------------------------------------------------
  // Pulse animation for call button
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (phoneNumber.length > 0 && !isCalling) {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
      }
      pulseAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimationRef.current.start();
    } else {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
        pulseAnimationRef.current = null;
      }
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
      }
    };
  }, [phoneNumber.length > 0, isCalling]);

  // ---------------------------------------------------------------------------
  // Calling screen animations + ringing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isCalling) {
      startRinging();
      ringAnim1.setValue(0);
      ringAnim2.setValue(0);
      ringAnim3.setValue(0);

      ringAnimRef.current = Animated.loop(
        Animated.stagger(400, [
          Animated.sequence([
            Animated.timing(ringAnim1, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(ringAnim1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim2, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(ringAnim2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringAnim3, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(ringAnim3, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      ringAnimRef.current.start();

      glowPulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulseAnim, {
            toValue: 1.15,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      glowPulseAnimRef.current.start();

      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      stopRinging();
      if (ringAnimRef.current) {
        ringAnimRef.current.stop();
        ringAnimRef.current = null;
      }
      if (glowPulseAnimRef.current) {
        glowPulseAnimRef.current.stop();
        glowPulseAnimRef.current = null;
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
      glowPulseAnim.setValue(1);
    }

    return () => {
      stopRinging();
      if (ringAnimRef.current) {
        ringAnimRef.current.stop();
        ringAnimRef.current = null;
      }
      if (glowPulseAnimRef.current) {
        glowPulseAnimRef.current.stop();
        glowPulseAnimRef.current = null;
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      glowPulseAnim.setValue(1);
    };
  }, [isCalling]);

  // ---------------------------------------------------------------------------
  // Dialpad handlers
  // ---------------------------------------------------------------------------

  const handleDigitPress = (digit: string) => {
    playDTMFTone(digit);
    if (phoneNumber.length < 15) {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  // ---------------------------------------------------------------------------
  // Outbound call via /api/frontdesk/outbound-call
  // ---------------------------------------------------------------------------

  const handleCall = async () => {
    if (phoneNumber.length === 0) return;
    setCallError(null);
    setOutboundBlocked(false);
    setCallingName(null);
    setIsCalling(true);

    try {
      const cleaned = phoneNumber.replace(/\D/g, '');
      const toE164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

      const res = await fetch('/api/frontdesk/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toE164 }),
      });

      if (res.status === 403) {
        setIsCalling(false);
        setOutboundBlocked(true);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Call failed' }));
        setCallError(err.error || 'Call initiation failed');
        setIsCalling(false);
        return;
      }
    } catch (_e) {
      setCallError('Network error -- could not initiate call');
      setIsCalling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Return call via /api/frontdesk/return-call
  // ---------------------------------------------------------------------------

  const handleReturnCall = async (call: FormattedCall) => {
    setCallError(null);
    setOutboundBlocked(false);
    setCallingName(call.name);
    setPhoneNumber(call.rawNumber.replace(/\D/g, ''));
    setIsCalling(true);

    try {
      const res = await fetch('/api/frontdesk/return-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSessionId: call.callSessionId }),
      });

      if (res.status === 403) {
        setIsCalling(false);
        setOutboundBlocked(true);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Return call failed' }));
        setCallError(err.error || 'Return call failed');
        setIsCalling(false);
        return;
      }
    } catch (_e) {
      setCallError('Network error -- could not return call');
      setIsCalling(false);
    }
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setCallingName(null);
  };

  // ---------------------------------------------------------------------------
  // Helpers for call type display
  // ---------------------------------------------------------------------------

  const getCallIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'missed': return 'call-outline';
      case 'incoming': return 'arrow-down';
      case 'outgoing': return 'arrow-up';
      case 'voicemail': return 'recording-outline';
      default: return 'call-outline';
    }
  };

  const getCallColor = (type: string): string => {
    switch (type) {
      case 'missed': return Colors.semantic.error;
      case 'voicemail': return Colors.semantic.warning;
      case 'incoming': return Colors.semantic.success;
      case 'outgoing': return Colors.accent.cyan;
      default: return Colors.text.secondary;
    }
  };

  const getCallBorderColor = (type: string): string => {
    switch (type) {
      case 'missed': return Colors.semantic.error;
      case 'incoming': return Colors.semantic.success;
      case 'outgoing': return Colors.accent.cyan;
      case 'voicemail': return Colors.semantic.warning;
      default: return Colors.border.default;
    }
  };

  // =========================================================================
  // DESKTOP -- Calling screen (fullscreen glassmorphism)
  // =========================================================================

  if (isDesktop) {
    if (isCalling) {
      return (
        <FullscreenSessionShell showBackButton={false}>
          <View style={callingStyles.container}>
            {/* Premium gradient mesh background */}
            <View style={callingStyles.backgroundBase} />
            <View style={callingStyles.backgroundGradientMesh} />
            <View style={callingStyles.backgroundAccent1} />
            <View style={callingStyles.backgroundAccent2} />
            <View style={callingStyles.backgroundAccent3} />
            <View style={callingStyles.noiseOverlay} />
            <View style={callingStyles.topVignette} />
            <View style={callingStyles.bottomVignette} />

            <View style={callingStyles.content}>
              {/* Premium glassmorphism avatar section */}
              <View style={callingStyles.avatarSection}>
                <View style={callingStyles.ringsContainer}>
                  {/* Animated expanding rings */}
                  <Animated.View style={[
                    callingStyles.ring,
                    {
                      opacity: ringAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
                      transform: [{ scale: ringAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
                    }
                  ]} />
                  <Animated.View style={[
                    callingStyles.ring,
                    {
                      opacity: ringAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
                      transform: [{ scale: ringAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
                    }
                  ]} />
                  <Animated.View style={[
                    callingStyles.ring,
                    {
                      opacity: ringAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
                      transform: [{ scale: ringAnim3.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
                    }
                  ]} />

                  {/* Pulsing outer glow */}
                  <Animated.View style={[
                    callingStyles.avatarGlowOuter,
                    { transform: [{ scale: glowPulseAnim }] }
                  ]} />

                  {/* Glassmorphism avatar container */}
                  <View style={callingStyles.glassContainer}>
                    <View style={callingStyles.glassInner}>
                      <View style={callingStyles.avatarCore}>
                        <Ionicons name="person" size={36} color="rgba(255,255,255,0.95)" />
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Premium info section with glow typography */}
              <View style={callingStyles.infoSection}>
                <Text style={callingStyles.callingLabel}>CALLING</Text>
                <Text style={callingStyles.phoneNumberDisplay}>
                  {callingName || formatPhoneNumber(phoneNumber)}
                </Text>
                {callingName && (
                  <Text style={callingStyles.companyName}>{formatPhoneNumber(phoneNumber)}</Text>
                )}
                {!callingName && (
                  <Text style={callingStyles.companyName}>Client</Text>
                )}
                <Text style={callingStyles.callTimer}>{formatCallDuration(callDuration)}</Text>
              </View>

              {/* Premium glass status badge */}
              <View style={callingStyles.statusSection}>
                <View style={callingStyles.statusBadge}>
                  <Animated.View style={[
                    callingStyles.statusDot,
                    { opacity: glowPulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [1, 0.5] }) }
                  ]} />
                  <Text style={callingStyles.statusText}>Ringing</Text>
                </View>
              </View>

              {/* Premium glassmorphism control buttons */}
              <View style={callingStyles.controlsSection}>
                <TouchableOpacity style={callingStyles.controlButton}>
                  <View style={callingStyles.controlButtonInner}>
                    <Ionicons name="mic-off-outline" size={22} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={callingStyles.controlLabel}>Mute</Text>
                </TouchableOpacity>
                <TouchableOpacity style={callingStyles.controlButton}>
                  <View style={callingStyles.controlButtonInner}>
                    <Ionicons name="keypad-outline" size={22} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={callingStyles.controlLabel}>Keypad</Text>
                </TouchableOpacity>
                <TouchableOpacity style={callingStyles.controlButton}>
                  <View style={callingStyles.controlButtonInner}>
                    <Ionicons name="volume-high-outline" size={22} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={callingStyles.controlLabel}>Speaker</Text>
                </TouchableOpacity>
              </View>

              {/* Premium end call button */}
              <TouchableOpacity style={callingStyles.endCallButton} onPress={handleEndCall}>
                <View style={callingStyles.endCallInner}>
                  <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
              </TouchableOpacity>

              {/* Refined branding */}
              <View style={callingStyles.brandingSection}>
                <View style={callingStyles.brandingDivider} />
                <Text style={callingStyles.brandingText}>ASPIRE</Text>
              </View>
            </View>
          </View>
        </FullscreenSessionShell>
      );
    }

    // =========================================================================
    // DESKTOP -- Main calls dashboard
    // =========================================================================

    return (
      <DesktopShell>
        <View style={desktopStyles.container}>
          {/* Setup modal overlay */}
          {showSetupModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.setupModal}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="headset-outline" size={48} color={Colors.accent.cyan} />
                </View>
                <Text style={styles.modalTitle}>Set Up Your Front Desk</Text>
                <Text style={styles.modalDescription}>
                  Sarah, your AI phone assistant, can answer calls, take messages, and route callers to your team while you focus on what matters most.
                </Text>
                <View style={styles.modalFeatures}>
                  <View style={styles.modalFeatureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                    <Text style={styles.modalFeatureText}>Answer calls 24/7</Text>
                  </View>
                  <View style={styles.modalFeatureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                    <Text style={styles.modalFeatureText}>Take messages when you're busy</Text>
                  </View>
                  <View style={styles.modalFeatureRow}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                    <Text style={styles.modalFeatureText}>Route calls to the right person</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={() => {
                    setShowSetupModal(false);
                    router.push('/session/calls/setup' as any);
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>Set Up Front Desk</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={() => setShowSetupModal(false)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Maybe Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 403 outbound-blocked premium warning */}
          {outboundBlocked && (
            <View style={styles.modalOverlay}>
              <Card variant="default" style={desktopStyles.blockedCard}>
                <View style={desktopStyles.blockedIconWrap}>
                  <Ionicons name="warning-outline" size={40} color={Colors.semantic.warning} />
                </View>
                <Text style={desktopStyles.blockedTitle}>Outbound Calls Not Available</Text>
                <Text style={desktopStyles.blockedDescription}>
                  Your business line is configured as inbound-only. Outbound calling requires a full-duplex Aspire line.
                </Text>
                <View style={desktopStyles.blockedFeatureBox}>
                  <View style={desktopStyles.blockedFeatureRow}>
                    <Ionicons name="call" size={18} color={Colors.semantic.success} />
                    <Text style={desktopStyles.blockedFeatureText}>Inbound calls are active and working</Text>
                  </View>
                  <View style={desktopStyles.blockedFeatureRow}>
                    <Ionicons name="close-circle" size={18} color={Colors.semantic.error} />
                    <Text style={desktopStyles.blockedFeatureText}>Outbound dialing requires upgrade</Text>
                  </View>
                  <View style={desktopStyles.blockedFeatureRow}>
                    <Ionicons name="shield-checkmark" size={18} color={Colors.accent.cyan} />
                    <Text style={desktopStyles.blockedFeatureText}>All call attempts generate receipts</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={desktopStyles.blockedPrimaryButton}
                  onPress={() => {
                    setOutboundBlocked(false);
                    router.push('/session/calls/setup' as any);
                  }}
                >
                  <Text style={desktopStyles.blockedPrimaryButtonText}>Upgrade Line</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={desktopStyles.blockedSecondaryButton}
                  onPress={() => setOutboundBlocked(false)}
                >
                  <Text style={desktopStyles.blockedSecondaryButtonText}>Dismiss</Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero banner with gradient overlay */}
            <ImageBackground source={callsHero} style={desktopStyles.headerBanner} imageStyle={desktopStyles.headerBannerImage}>
              <LinearGradient colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.65)']} style={desktopStyles.headerOverlay}>
                <View style={desktopStyles.headerRow}>
                  <View style={desktopStyles.headerLeft}>
                    <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={desktopStyles.headerIconWrap}>
                      <Ionicons name="call" size={24} color="#fff" />
                    </LinearGradient>
                    <View style={{ marginLeft: Spacing.md }}>
                      <Text style={desktopStyles.headerTitle}>Return Calls</Text>
                      <Text style={desktopStyles.headerSubtitle}>
                        {missedCount} missed{voicemailCount > 0 ? ` \u00B7 ${voicemailCount} voicemail${voicemailCount !== 1 ? 's' : ''}` : ''} \u00B7 Make outbound calls with Ava
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={desktopStyles.refreshButton}
                    onPress={refresh}
                    activeOpacity={0.7}
                  >
                    {callsLoading ? (
                      <ActivityIndicator size="small" color={Colors.accent.cyan} />
                    ) : (
                      <Ionicons name="refresh" size={18} color={Colors.accent.cyan} />
                    )}
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </ImageBackground>

            <View style={desktopStyles.bodyContent}>
              {/* Quick action buttons -- enterprise routes */}
              <View style={desktopStyles.quickActionsRow}>
                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => setActiveTab('dialpad')} activeOpacity={0.7}>
                  <LinearGradient colors={[Colors.accent.cyan, Colors.accent.cyanDark]} style={desktopStyles.quickActionIconCircle}>
                    <Ionicons name="book" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={desktopStyles.quickActionLabel}>Contacts</Text>
                </TouchableOpacity>

                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => router.push('/(tabs)/inbox' as any)} activeOpacity={0.7}>
                  <View style={{ position: 'relative' }}>
                    <LinearGradient colors={[Colors.semantic.warning, '#c88a00']} style={desktopStyles.quickActionIconCircle}>
                      <Ionicons name="recording-outline" size={20} color="#fff" />
                    </LinearGradient>
                    {voicemailCount > 0 && (
                      <View style={desktopStyles.quickActionBadge}>
                        <Text style={desktopStyles.quickActionBadgeText}>{voicemailCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={desktopStyles.quickActionLabel}>Voicemails</Text>
                </TouchableOpacity>

                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => router.push('/(tabs)/inbox' as any)} activeOpacity={0.7}>
                  <View style={{ position: 'relative' }}>
                    <LinearGradient colors={[Colors.semantic.error, '#dc2626']} style={desktopStyles.quickActionIconCircle}>
                      <Ionicons name="arrow-undo" size={20} color="#fff" />
                    </LinearGradient>
                    {callbackCount > 0 && (
                      <View style={desktopStyles.quickActionBadge}>
                        <Text style={desktopStyles.quickActionBadgeText}>{callbackCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={desktopStyles.quickActionLabel}>Call Back Queue</Text>
                </TouchableOpacity>

                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => router.push('/(tabs)/inbox' as any)} activeOpacity={0.7}>
                  <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={desktopStyles.quickActionIconCircle}>
                    <Ionicons name="people" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={desktopStyles.quickActionLabel}>Contacts</Text>
                </TouchableOpacity>

                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => router.push('/session/messages' as any)} activeOpacity={0.7}>
                  <LinearGradient colors={['#06B6D4', '#0891B2']} style={desktopStyles.quickActionIconCircle}>
                    <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={desktopStyles.quickActionLabel}>Text Messages</Text>
                </TouchableOpacity>

                <TouchableOpacity style={desktopStyles.quickActionCard} onPress={() => router.push('/session/calls/setup' as any)} activeOpacity={0.7}>
                  <LinearGradient colors={[Colors.semantic.success, '#16a34a']} style={desktopStyles.quickActionIconCircle}>
                    <Ionicons name="headset-outline" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={desktopStyles.quickActionLabel}>Front Desk</Text>
                </TouchableOpacity>
              </View>

              {/* Call error banner */}
              {callError && (
                <View style={desktopStyles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color={Colors.semantic.error} />
                  <Text style={desktopStyles.errorBannerText}>{callError}</Text>
                  <TouchableOpacity onPress={() => setCallError(null)}>
                    <Ionicons name="close" size={16} color={Colors.text.muted} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Two-column layout: dialpad + recent calls */}
              <View style={desktopStyles.twoColumnLayout}>
                {/* Left column: Dial pad */}
                <View style={desktopStyles.leftColumn}>
                  <View style={desktopStyles.sectionHeaderRow}>
                    <Ionicons name="keypad" size={20} color={Colors.accent.cyan} />
                    <Text style={desktopStyles.sectionHeaderText}>Dial Pad</Text>
                  </View>

                  <View style={desktopStyles.dialpadContainer}>
                    <View style={desktopStyles.numberDisplay}>
                      <Text style={desktopStyles.phoneNumber}>
                        {phoneNumber ? formatPhoneNumber(phoneNumber) : 'Enter number'}
                      </Text>
                      {phoneNumber.length > 0 && (
                        <TouchableOpacity onPress={handleBackspace} style={desktopStyles.backspaceButton}>
                          <Ionicons name="backspace-outline" size={24} color={Colors.text.muted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={desktopStyles.dialPad}>
                      {DIAL_PAD.map((item) => (
                        <TouchableOpacity
                          key={item.digit}
                          style={desktopStyles.dialButton}
                          onPress={() => handleDigitPress(item.digit)}
                          activeOpacity={0.7}
                        >
                          <Text style={desktopStyles.dialDigit}>{item.digit}</Text>
                          {item.letters ? (
                            <Text style={desktopStyles.dialLetters}>{item.letters}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={desktopStyles.callActions}>
                      <Animated.View style={{ transform: [{ scale: phoneNumber ? pulseAnim : 1 }] }}>
                        <TouchableOpacity
                          style={[desktopStyles.callButton, !phoneNumber && desktopStyles.callButtonDisabled]}
                          onPress={handleCall}
                          disabled={!phoneNumber}
                        >
                          <Ionicons name="call" size={28} color={Colors.text.primary} />
                        </TouchableOpacity>
                      </Animated.View>
                    </View>

                    <View style={desktopStyles.receiptNotice}>
                      <Ionicons name="shield-checkmark" size={16} color={Colors.accent.cyan} />
                      <Text style={desktopStyles.receiptText}>
                        All calls generate receipts and require approval
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right column: Recent calls list */}
                <View style={desktopStyles.rightColumn}>
                  <View style={desktopStyles.sectionHeaderRow}>
                    <Ionicons name="time" size={20} color={Colors.accent.cyan} />
                    <Text style={desktopStyles.sectionHeaderText}>Recent Activity</Text>
                    <View style={desktopStyles.countBadge}>
                      <Text style={desktopStyles.countBadgeText}>{allCalls.length}</Text>
                    </View>
                  </View>

                  {/* Filter pills */}
                  <View style={desktopStyles.filterPillsRow}>
                    {CALL_FILTERS.map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[desktopStyles.filterPill, activeFilter === filter && desktopStyles.filterPillActive]}
                        onPress={() => setActiveFilter(filter)}
                        activeOpacity={0.7}
                      >
                        <Text style={[desktopStyles.filterPillText, activeFilter === filter && desktopStyles.filterPillTextActive]}>
                          {filter}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Loading state */}
                  {callsLoading && allCalls.length === 0 && (
                    <View style={desktopStyles.loadingContainer}>
                      <ActivityIndicator size="small" color={Colors.accent.cyan} />
                      <Text style={desktopStyles.loadingText}>Loading call history...</Text>
                    </View>
                  )}

                  {/* Error state */}
                  {callsError && allCalls.length === 0 && (
                    <View style={desktopStyles.emptyState}>
                      <Ionicons name="alert-circle-outline" size={32} color={Colors.semantic.error} />
                      <Text style={desktopStyles.emptyStateText}>Failed to load calls</Text>
                      <TouchableOpacity onPress={refresh} style={desktopStyles.retryButton}>
                        <Text style={desktopStyles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Empty state */}
                  {!callsLoading && !callsError && filteredCalls.length === 0 && (
                    <View style={desktopStyles.emptyState}>
                      <Ionicons name="call-outline" size={32} color={Colors.text.muted} />
                      <Text style={desktopStyles.emptyStateText}>
                        {activeFilter === 'All' ? 'No calls yet' : `No ${activeFilter.toLowerCase()} calls`}
                      </Text>
                    </View>
                  )}

                  {/* Call cards */}
                  {filteredCalls.map((call) => (
                    <Pressable
                      key={call.id}
                      style={[desktopStyles.callCard, { borderLeftWidth: 3, borderLeftColor: getCallBorderColor(call.type) }]}
                      onPress={() => {
                        setPhoneNumber(call.rawNumber.replace(/\D/g, ''));
                      }}
                    >
                      <View style={desktopStyles.callAvatarCircle}>
                        <Ionicons name={getCallIcon(call.type)} size={18} color={getCallColor(call.type)} />
                      </View>
                      <View style={desktopStyles.callInfo}>
                        <View style={desktopStyles.callNameRow}>
                          <Text style={desktopStyles.callName}>{call.name}</Text>
                          {call.hasVoicemail && (
                            <Badge label="VM" variant="info" size="sm" />
                          )}
                          {call.hasRecording && (
                            <Badge label="REC" variant="warning" size="sm" />
                          )}
                        </View>
                        <Text style={desktopStyles.callNumber}>{call.number}</Text>
                        {call.duration && (
                          <Text style={desktopStyles.callDuration}>{call.duration}</Text>
                        )}
                      </View>
                      <View style={desktopStyles.callMeta}>
                        <Text style={desktopStyles.callTime}>{call.time}</Text>
                        <TouchableOpacity
                          style={desktopStyles.callBackButton}
                          onPress={() => handleReturnCall(call)}
                        >
                          <Ionicons name="call" size={18} color={Colors.accent.cyan} />
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  ))}

                  {filteredCalls.length > 0 && (
                    <TouchableOpacity style={desktopStyles.viewAllLink} onPress={() => router.push('/(tabs)/inbox' as any)} activeOpacity={0.7}>
                      <Text style={desktopStyles.viewAllText}>View All in Inbox</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.accent.cyan} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </DesktopShell>
    );
  }

  // =========================================================================
  // MOBILE -- Calls screen
  // =========================================================================

  return (
    <View style={styles.container}>
      {/* Setup modal */}
      {showSetupModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.setupModal}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="headset-outline" size={48} color={Colors.accent.cyan} />
            </View>
            <Text style={styles.modalTitle}>Set Up Your Front Desk</Text>
            <Text style={styles.modalDescription}>
              Sarah, your AI phone assistant, can answer calls, take messages, and route callers to your team while you focus on what matters most.
            </Text>
            <View style={styles.modalFeatures}>
              <View style={styles.modalFeatureRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                <Text style={styles.modalFeatureText}>Answer calls 24/7</Text>
              </View>
              <View style={styles.modalFeatureRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                <Text style={styles.modalFeatureText}>Take messages when you're busy</Text>
              </View>
              <View style={styles.modalFeatureRow}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.accent.cyan} />
                <Text style={styles.modalFeatureText}>Route calls to the right person</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={() => {
                setShowSetupModal(false);
                router.push('/session/calls/setup');
              }}
            >
              <Text style={styles.modalPrimaryButtonText}>Set Up Front Desk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={() => setShowSetupModal(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 403 outbound-blocked warning (mobile) */}
      {outboundBlocked && (
        <View style={styles.modalOverlay}>
          <View style={styles.setupModal}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning-outline" size={48} color={Colors.semantic.warning} />
            </View>
            <Text style={styles.modalTitle}>Outbound Not Available</Text>
            <Text style={styles.modalDescription}>
              Your business line is configured as inbound-only. Outbound calling requires a full-duplex Aspire line.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={() => {
                setOutboundBlocked(false);
                router.push('/session/calls/setup' as any);
              }}
            >
              <Text style={styles.modalPrimaryButtonText}>Upgrade Line</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={() => setOutboundBlocked(false)}
            >
              <Text style={styles.modalSecondaryButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return Calls</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/inbox' as any)}
          style={styles.inboxButton}
        >
          <Ionicons name="time-outline" size={22} color={Colors.text.primary} />
          {missedCount > 0 && (
            <View style={styles.inboxBadge}>
              <Badge label={String(missedCount)} variant="error" size="sm" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dialpad' && styles.tabActive]}
          onPress={() => setActiveTab('dialpad')}
        >
          <Ionicons
            name="keypad"
            size={18}
            color={activeTab === 'dialpad' ? Colors.accent.cyan : Colors.text.muted}
          />
          <Text style={[styles.tabText, activeTab === 'dialpad' && styles.tabTextActive]}>
            Dial Pad
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recent' && styles.tabActive]}
          onPress={() => setActiveTab('recent')}
        >
          <Ionicons
            name="time"
            size={18}
            color={activeTab === 'recent' ? Colors.accent.cyan : Colors.text.muted}
          />
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>
            Recent
          </Text>
          {missedCount > 0 && (
            <Badge label={String(missedCount)} variant="warning" size="sm" />
          )}
        </TouchableOpacity>
      </View>

      {/* Error banner (mobile) */}
      {callError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.semantic.error} />
          <Text style={styles.errorBannerText}>{callError}</Text>
          <TouchableOpacity onPress={() => setCallError(null)}>
            <Ionicons name="close" size={14} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'dialpad' ? (
        <View style={styles.dialpadContainer}>
          <View style={styles.numberDisplay}>
            <Text style={styles.phoneNumber}>
              {phoneNumber ? formatPhoneNumber(phoneNumber) : 'Enter number'}
            </Text>
            {phoneNumber.length > 0 && (
              <TouchableOpacity onPress={handleBackspace} style={styles.backspaceButton}>
                <Ionicons name="backspace-outline" size={24} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.dialPad}>
            {DIAL_PAD.map((item) => (
              <TouchableOpacity
                key={item.digit}
                style={styles.dialButton}
                onPress={() => handleDigitPress(item.digit)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialDigit}>{item.digit}</Text>
                {item.letters ? (
                  <Text style={styles.dialLetters}>{item.letters}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.callActions}>
            <Animated.View style={{ transform: [{ scale: phoneNumber ? pulseAnim : 1 }] }}>
              <TouchableOpacity
                style={[styles.callButton, !phoneNumber && styles.callButtonDisabled]}
                onPress={handleCall}
                disabled={!phoneNumber}
              >
                <Ionicons name="call" size={28} color={Colors.text.primary} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.receiptNotice}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.accent.cyan} />
            <Text style={styles.receiptText}>
              All calls generate receipts and require approval
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.recentContainer} contentContainerStyle={styles.recentContent}>
          {/* Quick actions -- enterprise routes */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/inbox' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="recording-outline" size={24} color={Colors.accent.cyan} />
                {voicemailCount > 0 && (
                  <View style={styles.quickBadge}>
                    <Badge label={String(voicemailCount)} variant="error" size="sm" />
                  </View>
                )}
              </View>
              <Text style={styles.quickActionLabel}>Voicemails</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/inbox' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="arrow-undo" size={24} color={Colors.semantic.warning} />
                {callbackCount > 0 && (
                  <View style={styles.quickBadge}>
                    <Badge label={String(callbackCount)} variant="warning" size="sm" />
                  </View>
                )}
              </View>
              <Text style={styles.quickActionLabel}>Call Back Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/inbox' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="people" size={24} color={Colors.text.secondary} />
              </View>
              <Text style={styles.quickActionLabel}>Contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/session/messages' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="chatbubble-ellipses" size={24} color={Colors.semantic.info} />
              </View>
              <Text style={styles.quickActionLabel}>Text Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/session/calls/setup' as any)}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="headset-outline" size={24} color={Colors.semantic.success} />
              </View>
              <Text style={styles.quickActionLabel}>Front Desk</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Recent Calls</Text>

          {/* Loading state (mobile) */}
          {callsLoading && allCalls.length === 0 && (
            <View style={styles.mobileLoadingContainer}>
              <ActivityIndicator size="small" color={Colors.accent.cyan} />
              <Text style={styles.mobileLoadingText}>Loading...</Text>
            </View>
          )}

          {/* Call list (mobile) */}
          {filteredCalls.map((call) => (
            <Card key={call.id} variant="default" style={styles.callCard}>
              <Pressable
                style={styles.callItem}
                onPress={() => setPhoneNumber(call.rawNumber.replace(/\D/g, ''))}
              >
                <View style={[styles.callTypeIcon, { borderColor: getCallColor(call.type) }]}>
                  <Ionicons
                    name={getCallIcon(call.type)}
                    size={16}
                    color={getCallColor(call.type)}
                  />
                </View>
                <View style={styles.callInfo}>
                  <View style={styles.callNameRow}>
                    <Text style={styles.callName}>{call.name}</Text>
                    {call.hasVoicemail && (
                      <Badge label="VM" variant="info" size="sm" />
                    )}
                  </View>
                  <Text style={styles.callNumber}>{call.number}</Text>
                </View>
                <View style={styles.callMeta}>
                  <Text style={styles.callTime}>{call.time}</Text>
                  <TouchableOpacity
                    style={styles.callBackButton}
                    onPress={() => handleReturnCall(call)}
                  >
                    <Ionicons name="call" size={18} color={Colors.accent.cyan} />
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Card>
          ))}

          {filteredCalls.length > 0 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/inbox' as any)}
            >
              <Text style={styles.viewAllText}>View all in Inbox</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent.cyan} />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ===========================================================================
// CALLING SCREEN styles (glassmorphism fullscreen)
// ===========================================================================

const callingStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#030308',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#030308',
  },
  backgroundGradientMesh: {
    position: 'absolute',
    top: '10%',
    left: '50%',
    width: 800,
    height: 800,
    marginLeft: -400,
    borderRadius: 400,
    // @ts-ignore - web-only
    background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 40%, transparent 70%)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 300px 150px rgba(59, 130, 246, 0.12)',
  },
  backgroundAccent1: {
    position: 'absolute',
    top: '5%',
    right: '10%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 150px 75px rgba(139, 92, 246, 0.1)',
  },
  backgroundAccent2: {
    position: 'absolute',
    bottom: '20%',
    left: '5%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 120px 60px rgba(6, 182, 212, 0.08)',
  },
  backgroundAccent3: {
    position: 'absolute',
    top: '40%',
    left: '60%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 100px 50px rgba(59, 130, 246, 0.06)',
  },
  noiseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    // @ts-ignore - web-only
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    // @ts-ignore - web-only
    background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    // @ts-ignore - web-only
    background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    zIndex: 10,
  },
  avatarSection: {
    marginBottom: 24,
  },
  ringsContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  avatarGlowOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 60px 30px rgba(59, 130, 246, 0.25)',
  },
  glassContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // @ts-ignore - web-only
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  glassInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  avatarCore: {
    width: 68,
    height: 68,
    borderRadius: 34,
    // @ts-ignore - web-only
    background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.6) 100%)',
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.5), inset 0 2px 4px rgba(255,255,255,0.15)',
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  callingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(59, 130, 246, 0.8)',
    marginBottom: 12,
    letterSpacing: 4,
    // @ts-ignore - web-only
    textShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
  },
  phoneNumberDisplay: {
    fontSize: 36,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 10,
    // @ts-ignore - web-only
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  },
  companyName: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  callTimer: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(59, 130, 246, 0.9)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    // @ts-ignore - web-only
    textShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    // @ts-ignore - web-only
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 0 8px 2px rgba(34, 197, 94, 0.6)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  controlsSection: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  controlButton: {
    alignItems: 'center',
    gap: 10,
  },
  controlButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    // @ts-ignore - web-only
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  endCallButton: {
    marginBottom: 20,
  },
  endCallInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    // @ts-ignore - web-only
    background: 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)',
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  brandingSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  brandingDivider: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  brandingText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 3,
  },
});

// ===========================================================================
// DESKTOP styles
// ===========================================================================

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  headerBanner: {
    height: 130,
    overflow: 'hidden',
  },
  headerBannerImage: {
    resizeMode: 'cover',
  },
  headerOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow(Colors.accent.cyan),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerSubtitle: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bodyContent: {
    paddingHorizontal: 32,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
    flexWrap: 'wrap',
  },
  quickActionCard: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.2s ease',
    // @ts-ignore
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  quickActionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.semantic.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.semantic.errorLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  errorBannerText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: 13,
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 24,
  },
  leftColumn: {
    flex: 1,
    maxWidth: 480,
  },
  rightColumn: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: Colors.accent.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  dialpadContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    // @ts-ignore
    backdropFilter: 'blur(12px)',
    // @ts-ignore
    WebkitBackdropFilter: 'blur(12px)',
  },
  numberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: '100%',
    // @ts-ignore
    backdropFilter: 'blur(12px)',
    // @ts-ignore
    WebkitBackdropFilter: 'blur(12px)',
  },
  phoneNumber: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 3,
    flex: 1,
    textAlign: 'center',
  },
  backspaceButton: {
    padding: 12,
    marginLeft: 8,
  },
  dialPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    maxWidth: 232,
  },
  dialButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // @ts-ignore
    boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  dialDigit: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '400',
  },
  dialLetters: {
    color: Colors.text.muted,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  callActions: {
    alignItems: 'center',
    marginBottom: 12,
  },
  callButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '0 4px 24px rgba(52, 199, 89, 0.5)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  callButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
    // @ts-ignore
    boxShadow: 'none',
  },
  receiptNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.12)',
    width: '100%',
    // @ts-ignore
    backdropFilter: 'blur(8px)',
  },
  receiptText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    backgroundColor: Colors.accent.cyanLight,
    borderColor: Colors.accent.cyan,
  },
  filterPillText: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.accent.cyan,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  loadingText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    color: Colors.text.muted,
    fontSize: 14,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyanLight,
    marginTop: 8,
  },
  retryButtonText: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: BorderRadius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    // @ts-ignore
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  callAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  callInfo: {
    flex: 1,
  },
  callNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  callName: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  callNumber: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 2,
  },
  callDuration: {
    color: Colors.text.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
  callMeta: {
    alignItems: 'flex-end',
    gap: 10,
  },
  callTime: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  callBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    // @ts-ignore
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
    // @ts-ignore
    cursor: 'pointer',
    // @ts-ignore
    transition: 'all 0.15s ease',
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
    // @ts-ignore
    cursor: 'pointer',
  },
  viewAllText: {
    color: Colors.accent.cyan,
    fontSize: 14,
    fontWeight: '600',
  },

  // 403 blocked card styles
  blockedCard: {
    width: 480,
    padding: 40,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.3)',
    // @ts-ignore
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  blockedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.semantic.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.3)',
  },
  blockedTitle: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  blockedDescription: {
    color: Colors.text.secondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  blockedFeatureBox: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  blockedFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  blockedFeatureText: {
    color: Colors.text.primary,
    fontSize: 14,
  },
  blockedPrimaryButton: {
    backgroundColor: Colors.semantic.warning,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: 12,
    // @ts-ignore
    boxShadow: '0 4px 16px rgba(212, 160, 23, 0.3)',
  },
  blockedPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  blockedSecondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  blockedSecondaryButtonText: {
    color: Colors.text.muted,
    fontSize: 14,
    fontWeight: '500',
  },
});

// ===========================================================================
// MOBILE styles
// ===========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    // @ts-ignore - web-only
    backdropFilter: 'blur(8px)',
    // @ts-ignore - web-only
    WebkitBackdropFilter: 'blur(8px)',
  },
  setupModal: {
    width: 480,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    padding: 40,
    borderWidth: 1,
    borderColor: Colors.border.default,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  modalIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  modalDescription: {
    color: Colors.text.secondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  modalFeatures: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  modalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalFeatureText: {
    color: Colors.text.primary,
    fontSize: 15,
  },
  modalPrimaryButton: {
    backgroundColor: Colors.accent.blueDark,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: 12,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSecondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: Colors.text.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.title.fontWeight,
  },
  inboxButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inboxBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.background.tertiary,
  },
  tabText: {
    color: Colors.text.muted,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.accent.cyan,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: 12,
    backgroundColor: Colors.semantic.errorLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  errorBannerText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: 12,
  },
  dialpadContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  numberDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    marginBottom: Spacing.xl,
  },
  phoneNumber: {
    color: Colors.text.primary,
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 2,
  },
  backspaceButton: {
    padding: Spacing.md,
    marginLeft: Spacing.md,
  },
  dialPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  dialButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  dialDigit: {
    color: Colors.text.primary,
    fontSize: 28,
    fontWeight: '400',
  },
  dialLetters: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    marginTop: 2,
  },
  callActions: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.semantic.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  callButtonDisabled: {
    backgroundColor: Colors.background.tertiary,
    shadowOpacity: 0,
  },
  receiptNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  receiptText: {
    color: Colors.text.tertiary,
    fontSize: Typography.small.fontSize,
  },
  recentContainer: {
    flex: 1,
  },
  recentContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 60,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    position: 'relative',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  quickActionLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
    marginBottom: Spacing.lg,
  },
  mobileLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  mobileLoadingText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  callCard: {
    marginBottom: Spacing.md,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  callTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
  },
  callInfo: {
    flex: 1,
  },
  callNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  callName: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
  },
  callNumber: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  callMeta: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  callTime: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  callBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  viewAllText: {
    color: Colors.accent.cyan,
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
});
