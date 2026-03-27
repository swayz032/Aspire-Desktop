import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { AvaOrbVideo, OrbState } from '@/components/AvaOrbVideo';
import { useSupabase, useTenant } from '@/providers';
import { useVoice, type VoiceDiagnosticEvent } from '@/hooks/useVoice';
import { getCurrentSession } from '@/data/session';
import type { AgentName } from '@/lib/elevenlabs';
import { ConfirmationModal } from '@/components/session/ConfirmationModal';
import { Toast } from '@/components/session/Toast';
import { BottomSheet } from '@/components/session/BottomSheet';
import { useDesktop } from '@/lib/useDesktop';
import { FullscreenSessionShell } from '@/components/desktop/FullscreenSessionShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { trackInteraction } from '@/lib/interactionTelemetry';
import { useKeepAwake } from '@/hooks/useKeepAwake';

/** Map staff participant IDs from the session wizard to AgentName for useVoice. */
const STAFF_TO_AGENT: Record<string, AgentName> = {
  'staff-eli': 'eli',
  'staff-finn': 'finn',
  'staff-nora': 'nora',
  'staff-sarah': 'sarah',
  'staff-quinn': 'ava',   // Quinn routes through Ava orchestrator
  'staff-clara': 'ava',   // Clara routes through Ava orchestrator
  'staff-adam': 'ava',    // Adam routes through Ava orchestrator
  'staff-tec': 'ava',     // Tec routes through Ava orchestrator
  'staff-teressa': 'ava', // Teressa routes through Ava orchestrator
  'staff-milo': 'ava',    // Milo routes through Ava orchestrator
  'ai-ava': 'ava',
};

function resolveAgentFromSession(): AgentName {
  const session = getCurrentSession();
  if (!session?.participants) return 'ava';
  // Find the first AI participant that maps to a specific agent voice
  for (const p of session.participants) {
    const mapped = STAFF_TO_AGENT[p.id];
    if (mapped) return mapped;
  }
  return 'ava';
}

const MENU_OPTIONS = [
  { id: 'mute', label: 'Mute Microphone', icon: 'mic-off' as const },
  { id: 'speaker', label: 'Speaker Mode', icon: 'volume-high' as const },
  { id: 'transcript', label: 'View Transcript', icon: 'document-text' as const },
  { id: 'settings', label: 'Settings', icon: 'settings' as const },
  { id: 'end', label: 'End Session', icon: 'stop-circle' as const, destructive: true },
];

export default function VoiceSessionPage() {
  return (
    <PageErrorBoundary pageName="voice-session">
      <VoiceSession />
    </PageErrorBoundary>
  );
}

function VoiceSession() {
  useKeepAwake(); // Prevent screen dimming during voice session
  const router = useRouter();
  const isDesktop = useDesktop();
  const { session: authSession, suiteId } = useSupabase();
  const { tenant } = useTenant();
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [currentActivity, setCurrentActivity] = useState<string>('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnosticEvent[]>([]);
  const [diagPanelOpen, setDiagPanelOpen] = useState(false);

  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Resolve which agent to talk to from the session wizard selection
  const agentName = useRef<AgentName>(resolveAgentFromSession()).current;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // --- Real voice pipeline via useVoice (same hook used in AvaDeskPanel) ---
  const voice = useVoice({
    agent: agentName,
    suiteId: suiteId ?? undefined,
    accessToken: authSession?.access_token,
    userProfile: tenant ? {
      ownerName: tenant.ownerName,
      businessName: tenant.businessName,
      industry: tenant.industry ?? undefined,
      teamSize: tenant.teamSize ?? undefined,
      industrySpecialty: tenant.industrySpecialty ?? undefined,
      businessGoals: tenant.businessGoals ?? undefined,
      painPoint: tenant.painPoint ?? undefined,
      preferredChannel: tenant.preferredChannel ?? undefined,
    } : undefined,
    onStatusChange: (s) => {
      const map: Record<string, OrbState> = {
        idle: 'idle',
        listening: 'listening',
        thinking: 'processing',
        speaking: 'responding',
        error: 'idle',
      };
      setOrbState(map[s] || 'idle');
      if (s === 'listening') setCurrentActivity('Listening...');
      else if (s === 'thinking') setCurrentActivity('Thinking...');
      else if (s === 'speaking') setCurrentActivity('');
      else if (s === 'error') setCurrentActivity('');
    },
    onTranscript: (text) => {
      setCurrentActivity(`"${text}"`);
    },
    onResponse: () => {
      setCurrentActivity('');
    },
    onError: (error) => {
      const msg = error.message || String(error);
      // Push to diagnostics panel if not already captured by onDiagnostic
      setDiagnostics(prev => {
        // Avoid duplication — skip if last entry has same message within 1s
        if (prev.length > 0 && prev[0].message === msg && Date.now() - prev[0].timestamp < 1000) return prev;
        const fallbackDiag: VoiceDiagnosticEvent = {
          traceId: `err-${Date.now()}`,
          agent: agentName,
          stage: /auth/i.test(msg) ? 'orchestrator'
            : /autoplay|play\(\)/i.test(msg) ? 'autoplay'
            : /mic|permission|denied/i.test(msg) ? 'mic'
            : /tts|voice|synthesis/i.test(msg) ? 'tts'
            : /stt|transcri/i.test(msg) ? 'stt'
            : 'orchestrator',
          code: msg.split(':')[0] || 'UNKNOWN',
          message: msg,
          timestamp: Date.now(),
          recoverable: !/auth_required|permission|denied/i.test(msg),
        };
        return [fallbackDiag, ...prev].slice(0, 50);
      });
      if (!diagPanelOpen) setDiagPanelOpen(true);
      if (/auth_required/i.test(msg)) {
        showToast('Session expired. Please sign in again.', 'error');
      } else if (/autoplay|not allowed|play\(\)/i.test(msg)) {
        showToast('Tap anywhere, then try again.', 'error');
      } else if (/permission|denied|microphone/i.test(msg)) {
        showToast('Microphone access denied. Check permissions.', 'error');
      } else if (/tts|voice.*unavailable|synthesis/i.test(msg)) {
        showToast('Voice unavailable — try again.', 'error');
      } else {
        showToast(msg.length > 80 ? msg.slice(0, 80) + '...' : msg, 'error');
      }
    },
    onDiagnostic: (diag: VoiceDiagnosticEvent) => {
      setDiagnostics(prev => [diag, ...prev].slice(0, 50));
      if (!diagPanelOpen) setDiagPanelOpen(true);
      if (diag.stage === 'autoplay') {
        showToast('Audio blocked by browser. Tap the mic button to retry.', 'error');
      }
    },
  });

  // Destructure stable refs to avoid eslint-disable on useEffect deps
  const { startSession, endSession } = voice;

  // Start voice session on mount, cleanup on unmount
  useEffect(() => {
    startSession().catch((err: Error) => {
      showToast(err.message || 'Failed to start voice session', 'error');
    });
    return () => {
      endSession();
    };
  }, [startSession, endSession]);

  // Shimmer animation for status text
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.8, 0.4],
  });

  const handleEndSession = useCallback(() => {
    trackInteraction('session_end', 'voice-session', { agent: agentName });
    voice.endSession();
    showToast('Session ended.', 'success');
    setTimeout(() => router.replace('/(tabs)'), 500);
  }, [voice, router]);

  const handleToggleMute = useCallback(() => {
    const willMute = !isMuted;
    setIsMuted(willMute);
    trackInteraction(willMute ? 'mic_mute' : 'mic_unmute', 'voice-session', { agent: agentName });
    voice.setMuted(willMute);
    showToast(willMute ? 'Microphone muted' : 'Microphone on', 'info');
  }, [isMuted, voice]);

  const handleMenuSelect = (optionId: string) => {
    trackInteraction('session_menu_select', 'voice-session', { option: optionId });
    switch (optionId) {
      case 'mute':
        handleToggleMute();
        break;
      case 'speaker':
        showToast('Speaker mode enabled', 'info');
        break;
      case 'transcript':
        router.push('/session/transcript');
        break;
      case 'settings':
        showToast('Settings', 'info');
        break;
      case 'end':
        setEndSessionVisible(true);
        break;
    }
  };

  const voiceContent = (
    <View style={styles.container}>
      <Toast 
        visible={toastVisible} 
        message={toastMessage} 
        type={toastType}
        onHide={() => setToastVisible(false)} 
      />

      <View style={styles.header}>
        <Pressable onPress={() => setEndSessionVisible(true)} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text.secondary} />
        </Pressable>
        
        <Pressable
          style={styles.identityPill}
          onPress={() => { trackInteraction('mic_toggle', 'ava-voice-pill', { agent: agentName }); handleToggleMute(); }}
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          accessibilityRole="button"
        >
          <View style={[styles.liveDot, isMuted && { backgroundColor: Colors.semantic.error }]} />
          <Text style={styles.identityText}>
            {tenant?.businessName ?? 'Aspire Business'}
          </Text>
        </Pressable>

        <Pressable onPress={() => { trackInteraction('session_menu_open', 'voice-session'); setMenuVisible(true); }} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.blobSection}>
          <AvaOrbVideo state={orbState} size={340} />
        </View>

        <View style={styles.statusSection}>
          {currentActivity ? (
            <Animated.Text style={[styles.statusText, { opacity: shimmerOpacity }]}>
              {currentActivity}
            </Animated.Text>
          ) : null}
        </View>

      </View>

      {/* Diagnostic Error Panel */}
      {diagnostics.length > 0 && (
        <View style={styles.diagPanel}>
          <Pressable style={styles.diagHeader} onPress={() => setDiagPanelOpen(!diagPanelOpen)}>
            <View style={styles.diagHeaderLeft}>
              <View style={styles.diagDot} />
              <Text style={styles.diagHeaderText}>
                {diagnostics.length} error{diagnostics.length !== 1 ? 's' : ''} — why agent isn't talking
              </Text>
            </View>
            <View style={styles.diagHeaderRight}>
              <Pressable onPress={() => setDiagnostics([])} hitSlop={8}>
                <Ionicons name="trash-outline" size={14} color="#666" />
              </Pressable>
              <Ionicons name={diagPanelOpen ? 'chevron-down' : 'chevron-up'} size={16} color="#888" />
            </View>
          </Pressable>
          {diagPanelOpen && (
            <ScrollView style={styles.diagList} nestedScrollEnabled>
              {diagnostics.map((d, i) => {
                const stageColors: Record<string, string> = {
                  mic: '#F59E0B',
                  stt: '#8B5CF6',
                  orchestrator: '#EF4444',
                  tts: '#3B82F6',
                  autoplay: '#F97316',
                };
                const stageLabels: Record<string, string> = {
                  mic: 'MIC',
                  stt: 'STT (Speech-to-Text)',
                  orchestrator: 'ORCHESTRATOR (LangGraph)',
                  tts: 'TTS (ElevenLabs)',
                  autoplay: 'BROWSER AUTOPLAY',
                };
                const color = stageColors[d.stage] || '#EF4444';
                const time = new Date(d.timestamp).toLocaleTimeString();
                return (
                  <View key={`${d.traceId}-${i}`} style={styles.diagItem}>
                    <View style={styles.diagItemHeader}>
                      <View style={[styles.diagStagePill, { backgroundColor: color + '22', borderColor: color }]}>
                        <Text style={[styles.diagStageText, { color }]}>{stageLabels[d.stage] || d.stage.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.diagTime}>{time}</Text>
                    </View>
                    <Text style={styles.diagCode}>{d.code}</Text>
                    <Text style={styles.diagMessage}>{d.message}</Text>
                    {d.httpStatus ? <Text style={styles.diagDetail}>HTTP {d.httpStatus}</Text> : null}
                    {d.raw && d.raw !== d.message ? <Text style={styles.diagRaw}>{d.raw}</Text> : null}
                    {d.recoverable ? (
                      <Text style={styles.diagRecoverable}>Auto-recoverable — will retry</Text>
                    ) : (
                      <Text style={styles.diagFatal}>Not recoverable — needs attention</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.controlsRow}>
          <Pressable
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Ionicons 
              name={isMuted ? "mic-off" : "mic"} 
              size={22} 
              color={isMuted ? Colors.semantic.error : Colors.text.primary} 
            />
          </Pressable>

          <Pressable 
            style={styles.endButton}
            onPress={() => { trackInteraction('session_end', 'voice-session', { trigger: 'end-button' }); setEndSessionVisible(true); }}
          >
            <View style={styles.endButtonInner}>
              <Ionicons name="call" size={24} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
          </Pressable>

          <Pressable 
            style={styles.controlButton}
            onPress={() => { trackInteraction('speaker_toggle', 'voice-session'); showToast('Speaker mode toggled', 'info'); }}
          >
            <Ionicons name="volume-high" size={22} color={Colors.text.primary} />
          </Pressable>
        </View>
      </View>

      <BottomSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Session Options"
        options={MENU_OPTIONS}
        onSelect={handleMenuSelect}
      />

      <ConfirmationModal
        visible={endSessionVisible}
        onClose={() => setEndSessionVisible(false)}
        onConfirm={handleEndSession}
        title="End Voice Session"
        message="Are you sure you want to end this voice session? The transcript will be saved."
        confirmLabel="End Session"
        destructive
        icon="mic-off"
      />
    </View>
  );

  // Law #8: Desktop gets FullscreenSessionShell wrapper
  if (isDesktop) {
    return (
      <FullscreenSessionShell showBackButton={true} backLabel="Exit Voice">
        {voiceContent}
      </FullscreenSessionShell>
    );
  }

  return voiceContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#1E1E20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  identityText: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  blobSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  statusSection: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  statusText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: '#000000',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  endButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Diagnostic panel
  diagPanel: {
    backgroundColor: '#111113',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2c',
    maxHeight: 260,
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e20',
  },
  diagHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  diagHeaderText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  diagList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  diagItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1c',
    gap: 3,
  },
  diagItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagStagePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  diagStageText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  diagTime: {
    color: '#555',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  diagCode: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  diagMessage: {
    color: '#999',
    fontSize: 11,
    lineHeight: 16,
  },
  diagDetail: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  diagRaw: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'monospace',
    fontStyle: 'italic',
  },
  diagRecoverable: {
    color: '#10B981',
    fontSize: 10,
  },
  diagFatal: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
  },
});
