import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSupabase } from '@/providers';

type SessionState = 'idle' | 'listening' | 'processing' | 'speaking';

interface Turn {
  id: string;
  role: 'user' | 'ava';
  text: string;
  latency?: { llm: number; tts: number };
}

const AGENTS = [
  { id: 'ava', label: 'Ava', color: '#3B82F6' },
  { id: 'eli', label: 'Eli', color: '#8B5CF6' },
  { id: 'finn', label: 'Finn', color: '#10B981' },
  { id: 'nora', label: 'Nora', color: '#F59E0B' },
  { id: 'sarah', label: 'Sarah', color: '#EC4899' },
] as const;

function VoiceTestContent() {
  const router = useRouter();
  const isDesktop = useDesktop();
  const { session } = useSupabase();

  const [state, setState] = useState<SessionState>('idle');
  const [selectedAgent, setSelectedAgent] = useState('ava');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const activeRef = useRef(false); // whether voice session is active

  const agentInfo = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  const addTurn = useCallback((turn: Turn) => {
    setTurns((prev) => [...prev, turn]);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, []);

  // --- Start listening ---
  const startListening = useCallback(async () => {
    if (!session?.access_token) {
      setError('Not authenticated');
      return;
    }
    setError(null);
    setState('listening');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) {
          setError('Too short — speak a bit longer');
          setState(activeRef.current ? 'listening' : 'idle');
          if (activeRef.current) startListening();
          return;
        }
        await processVoice(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mic access denied');
      setState('idle');
    }
  }, [session]);

  // --- Stop listening ---
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // --- Full voice pipeline: STT → LLM → TTS → playback ---
  const processVoice = useCallback(
    async (blob: Blob) => {
      setState('processing');
      const headers = getAuthHeaders();
      if (!headers) return;

      try {
        // 1) STT
        const arrayBuffer = await blob.arrayBuffer();
        const sttResp = await fetch('/api/elevenlabs/stt', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'audio/webm' },
          body: arrayBuffer,
        });

        if (!sttResp.ok) {
          setError(`STT error ${sttResp.status}`);
          if (activeRef.current && autoListen) {
            setState('listening');
            startListening();
          } else {
            setState('idle');
          }
          return;
        }

        const sttData = await sttResp.json();
        const transcript = (sttData.text || sttData.transcript || '').trim();

        if (!transcript) {
          // No speech detected — go back to listening silently
          if (activeRef.current && autoListen) {
            setState('listening');
            startListening();
          } else {
            setState('idle');
          }
          return;
        }

        // Add user turn
        addTurn({ id: `u-${Date.now()}`, role: 'user', text: transcript });

        // 2) LLM + TTS bypass
        const resp = await fetch('/api/voice-test/bypass', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript, agent: selectedAgent }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: resp.statusText }));
          setError(errData.error || `Error ${resp.status}`);
          if (activeRef.current && autoListen) {
            setState('listening');
            startListening();
          } else {
            setState('idle');
          }
          return;
        }

        // Parse response
        const llmResponseB64 = resp.headers.get('X-LLM-Response') || '';
        const llmMs = parseInt(resp.headers.get('X-LLM-Latency-Ms') || '0', 10);
        const ttsMs = parseInt(resp.headers.get('X-TTS-Latency-Ms') || '0', 10);
        let llmText = '';
        try { llmText = atob(llmResponseB64); } catch { llmText = ''; }

        const audioBlob = await resp.blob();
        addTurn({ id: `a-${Date.now()}`, role: 'ava', text: llmText, latency: { llm: llmMs, tts: ttsMs } });

        // 3) Play audio
        setState('speaking');
        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          // Auto-listen again if session is active
          if (activeRef.current && autoListen) {
            setState('listening');
            startListening();
          } else {
            setState('idle');
          }
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setError('Audio playback failed');
          setState('idle');
        };

        await audio.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Voice pipeline failed');
        setState('idle');
      }
    },
    [getAuthHeaders, selectedAgent, autoListen, addTurn, startListening],
  );

  // --- Toggle voice session ---
  const toggleSession = useCallback(() => {
    if (activeRef.current) {
      // End session
      activeRef.current = false;
      stopListening();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setState('idle');
    } else {
      // Start session
      activeRef.current = true;
      setError(null);
      startListening();
    }
  }, [startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      mediaRecorderRef.current?.stop?.();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const stateColors: Record<SessionState, string> = {
    idle: Colors.text.muted,
    listening: '#EF4444',
    processing: '#F59E0B',
    speaking: '#10B981',
  };

  const stateLabels: Record<SessionState, string> = {
    idle: 'Tap mic to start',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Ava is speaking...',
  };

  const content = (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { activeRef.current = false; router.back(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Voice Test — Bypass</Text>
          <Text style={styles.headerSub}>Direct: Mic → OpenAI → ElevenLabs → Speaker</Text>
        </View>
      </View>

      {/* Agent selector */}
      <View style={styles.agentBar}>
        {AGENTS.map((agent) => (
          <Pressable
            key={agent.id}
            style={[
              styles.agentChip,
              selectedAgent === agent.id && { backgroundColor: agent.color + '22', borderColor: agent.color },
            ]}
            onPress={() => !activeRef.current && setSelectedAgent(agent.id)}
          >
            <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
            <Text style={[styles.agentText, selectedAgent === agent.id && { color: agent.color }]}>
              {agent.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {turns.length === 0 && state === 'idle' && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyText}>Tap the mic to start a voice conversation with {agentInfo.label}</Text>
            <Text style={styles.emptySubtext}>No orchestrator — direct OpenAI + ElevenLabs</Text>
          </View>
        )}

        {turns.map((turn) => (
          <View key={turn.id} style={[styles.turnRow, turn.role === 'user' ? styles.turnUser : styles.turnAva]}>
            <View style={[
              styles.turnBubble,
              turn.role === 'user' ? styles.bubbleUser : styles.bubbleAva,
            ]}>
              <Text style={[styles.turnText, turn.role === 'user' && styles.turnTextUser]}>
                {turn.text}
              </Text>
            </View>
            {turn.latency && (
              <Text style={styles.latencyText}>
                LLM {turn.latency.llm}ms · TTS {turn.latency.tts}ms
              </Text>
            )}
          </View>
        ))}

        {state === 'listening' && (
          <View style={styles.listeningIndicator}>
            <View style={styles.pulsingDot} />
            <Text style={styles.listeningText}>Listening...</Text>
          </View>
        )}

        {state === 'processing' && (
          <View style={styles.listeningIndicator}>
            <Ionicons name="flash" size={14} color="#F59E0B" />
            <Text style={[styles.listeningText, { color: '#F59E0B' }]}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Ionicons name="close" size={14} color={Colors.text.muted} />
          </Pressable>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <View style={styles.controlsInner}>
          {/* Auto-listen toggle */}
          <Pressable
            style={[styles.toggleBtn, autoListen && styles.toggleBtnActive]}
            onPress={() => setAutoListen(!autoListen)}
          >
            <Ionicons name="repeat" size={18} color={autoListen ? '#3B82F6' : Colors.text.muted} />
          </Pressable>

          {/* Main mic button */}
          <Pressable
            style={[
              styles.micBtn,
              activeRef.current && state === 'listening' && styles.micBtnListening,
              activeRef.current && state === 'speaking' && styles.micBtnSpeaking,
              activeRef.current && state === 'processing' && styles.micBtnProcessing,
            ]}
            onPress={toggleSession}
          >
            <Ionicons
              name={activeRef.current ? (state === 'listening' ? 'mic' : 'stop') : 'mic'}
              size={36}
              color="#fff"
            />
          </Pressable>

          {/* End / clear */}
          <Pressable
            style={styles.toggleBtn}
            onPress={() => { setTurns([]); setError(null); }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.text.muted} />
          </Pressable>
        </View>

        <Text style={[styles.stateLabel, { color: stateColors[state] }]}>
          {stateLabels[state]}
        </Text>
      </View>
    </View>
  );

  if (isDesktop) {
    return <DesktopPageWrapper scrollable={false}>{content}</DesktopPageWrapper>;
  }
  return content;
}

export default function VoiceTestScreen() {
  return (
    <PageErrorBoundary pageName="voice-test">
      <VoiceTestContent />
    </PageErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  // Agent bar
  agentBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 5,
  },
  agentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  // Transcript
  transcript: {
    flex: 1,
  },
  transcriptContent: {
    padding: Spacing.lg,
    paddingBottom: 20,
    gap: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptySubtext: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  // Turns
  turnRow: {
    gap: 4,
  },
  turnUser: {
    alignItems: 'flex-end',
  },
  turnAva: {
    alignItems: 'flex-start',
  },
  turnBubble: {
    maxWidth: '80%' as any,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  bubbleAva: {
    backgroundColor: Colors.background.secondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  turnText: {
    color: Colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  turnTextUser: {
    color: '#fff',
  },
  latencyText: {
    color: Colors.text.muted,
    fontSize: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginTop: 2,
  },
  // Listening indicator
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  listeningText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  // Error
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  // Controls
  controls: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  controlsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  toggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  micBtnListening: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  micBtnSpeaking: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  micBtnProcessing: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  stateLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 10,
  },
});
