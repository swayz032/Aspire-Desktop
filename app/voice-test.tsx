import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { useDesktop } from '@/lib/useDesktop';
import { DesktopPageWrapper } from '@/components/desktop/DesktopPageWrapper';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSupabase } from '@/providers';

type Stage = 'idle' | 'recording' | 'thinking' | 'speaking' | 'error' | 'done';

interface DiagnosticInfo {
  llmResponse?: string;
  llmLatencyMs?: number;
  ttsLatencyMs?: number;
  audioSizeBytes?: number;
  audioDurationMs?: number;
  error?: string;
  errorStage?: string;
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

  const [stage, setStage] = useState<Stage>('idle');
  const [selectedAgent, setSelectedAgent] = useState('ava');
  const [textInput, setTextInput] = useState('');
  const [diag, setDiag] = useState<DiagnosticInfo>({});
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  // --- STT via browser MediaRecorder → backend ---
  const startRecording = useCallback(async () => {
    if (!session?.access_token) {
      setDiag({ error: 'Not authenticated. Please sign in.', errorStage: 'auth' });
      setStage('error');
      return;
    }

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
          setDiag({ error: 'Recording too short. Hold the mic button and speak.', errorStage: 'stt' });
          setStage('error');
          return;
        }
        await processAudioBlob(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setStage('recording');
      setDiag({});
    } catch (err) {
      setDiag({
        error: err instanceof Error ? err.message : 'Microphone access denied',
        errorStage: 'mic',
      });
      setStage('error');
    }
  }, [session]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStage('thinking');
    }
  }, []);

  // --- STT: send audio blob to ElevenLabs STT via our server ---
  const processAudioBlob = useCallback(
    async (blob: Blob) => {
      setStage('thinking');
      const headers = getAuthHeaders();
      if (!headers) return;

      try {
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');

        const sttResp = await fetch('/api/elevenlabs/stt', {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!sttResp.ok) {
          const errText = await sttResp.text();
          setDiag({ error: `STT failed (${sttResp.status}): ${errText.substring(0, 200)}`, errorStage: 'stt' });
          setStage('error');
          return;
        }

        const sttData = await sttResp.json();
        const transcript = sttData.text || sttData.transcript || '';

        if (!transcript.trim()) {
          setDiag({ error: 'No speech detected. Try speaking louder or closer to the mic.', errorStage: 'stt' });
          setStage('error');
          return;
        }

        await runBypass(transcript);
      } catch (err) {
        setDiag({
          error: err instanceof Error ? err.message : 'STT request failed',
          errorStage: 'stt',
        });
        setStage('error');
      }
    },
    [getAuthHeaders],
  );

  // --- Core bypass: text → OpenAI → ElevenLabs → audio playback ---
  const runBypass = useCallback(
    async (text: string) => {
      setStage('thinking');
      setDiag({});
      const headers = getAuthHeaders();
      if (!headers) {
        setDiag({ error: 'Not authenticated', errorStage: 'auth' });
        setStage('error');
        return;
      }

      try {
        const resp = await fetch('/api/voice-test/bypass', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, agent: selectedAgent }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: resp.statusText }));
          setDiag({
            error: `${errData.error || resp.statusText}`,
            errorStage: errData.stage || 'unknown',
            llmResponse: errData.responseText,
          });
          setStage('error');
          return;
        }

        // Parse diagnostic headers
        const llmResponseB64 = resp.headers.get('X-LLM-Response') || '';
        const llmLatency = parseInt(resp.headers.get('X-LLM-Latency-Ms') || '0', 10);
        const ttsLatency = parseInt(resp.headers.get('X-TTS-Latency-Ms') || '0', 10);
        let llmResponse = '';
        try {
          llmResponse = atob(llmResponseB64);
        } catch {
          llmResponse = '(could not decode)';
        }

        // Get audio blob
        const audioBlob = await resp.blob();

        setDiag({
          llmResponse,
          llmLatencyMs: llmLatency,
          ttsLatencyMs: ttsLatency,
          audioSizeBytes: audioBlob.size,
        });

        // Play audio
        setStage('speaking');
        const audioUrl = URL.createObjectURL(audioBlob);

        if (Platform.OS === 'web') {
          // Stop any previous playback
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
          }

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            setStage('done');
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = (e) => {
            setDiag((prev) => ({
              ...prev,
              error: `Audio playback failed: ${audio.error?.message || 'unknown'}`,
              errorStage: 'playback',
            }));
            setStage('error');
            URL.revokeObjectURL(audioUrl);
          };

          // Measure audio duration once metadata loads
          audio.onloadedmetadata = () => {
            setDiag((prev) => ({
              ...prev,
              audioDurationMs: Math.round(audio.duration * 1000),
            }));
          };

          await audio.play();
        }
      } catch (err) {
        setDiag({
          error: err instanceof Error ? err.message : 'Bypass request failed',
          errorStage: 'network',
        });
        setStage('error');
      }
    },
    [getAuthHeaders, selectedAgent],
  );

  // --- Text input submit ---
  const handleTextSubmit = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    runBypass(trimmed);
  }, [textInput, runBypass]);

  const handleReset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setStage('idle');
    setDiag({});
    setTextInput('');
  }, []);

  const stageLabel: Record<Stage, string> = {
    idle: 'Ready',
    recording: 'Listening...',
    thinking: 'Processing...',
    speaking: 'Playing audio...',
    error: 'Error',
    done: 'Complete',
  };

  const stageColor: Record<Stage, string> = {
    idle: Colors.text.muted,
    recording: '#EF4444',
    thinking: '#F59E0B',
    speaking: '#10B981',
    error: '#EF4444',
    done: '#10B981',
  };

  const agentColor = AGENTS.find((a) => a.id === selectedAgent)?.color || '#3B82F6';

  const content = (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Voice Pipeline Test</Text>
          <Text style={styles.headerSubtitle}>Bypass: OpenAI → ElevenLabs → Audio</Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={[styles.statusDot, { backgroundColor: stageColor[stage] }]} />
          <Text style={[styles.statusText, { color: stageColor[stage] }]}>{stageLabel[stage]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Pipeline diagram */}
        <View style={styles.pipelineCard}>
          <Text style={styles.cardLabel}>BYPASS PIPELINE</Text>
          <View style={styles.pipeline}>
            <View style={[styles.pipelineNode, stage === 'recording' && styles.pipelineActive]}>
              <Ionicons name="mic" size={16} color={stage === 'recording' ? '#fff' : Colors.text.muted} />
              <Text style={[styles.pipelineText, stage === 'recording' && styles.pipelineTextActive]}>Mic/Text</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.text.muted} />
            <View style={[styles.pipelineNode, stage === 'thinking' && styles.pipelineActive]}>
              <Ionicons name="flash" size={16} color={stage === 'thinking' ? '#fff' : Colors.text.muted} />
              <Text style={[styles.pipelineText, stage === 'thinking' && styles.pipelineTextActive]}>OpenAI</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.text.muted} />
            <View style={[styles.pipelineNode, stage === 'speaking' && styles.pipelineActive]}>
              <Ionicons name="volume-high" size={16} color={stage === 'speaking' ? '#fff' : Colors.text.muted} />
              <Text style={[styles.pipelineText, stage === 'speaking' && styles.pipelineTextActive]}>ElevenLabs</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.text.muted} />
            <View style={[styles.pipelineNode, stage === 'done' && styles.pipelineActive]}>
              <Ionicons name="headset" size={16} color={stage === 'done' ? '#fff' : Colors.text.muted} />
              <Text style={[styles.pipelineText, stage === 'done' && styles.pipelineTextActive]}>Speaker</Text>
            </View>
          </View>
          <Text style={styles.pipelineNote}>No orchestrator, no LangGraph — direct API calls only</Text>
        </View>

        {/* Agent selector */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AGENT VOICE</Text>
          <View style={styles.agentRow}>
            {AGENTS.map((agent) => (
              <Pressable
                key={agent.id}
                style={[
                  styles.agentChip,
                  selectedAgent === agent.id && { backgroundColor: agent.color + '22', borderColor: agent.color },
                ]}
                onPress={() => setSelectedAgent(agent.id)}
              >
                <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
                <Text
                  style={[
                    styles.agentChipText,
                    selectedAgent === agent.id && { color: agent.color, fontWeight: '600' },
                  ]}
                >
                  {agent.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Input section */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>INPUT</Text>

          {/* Text input */}
          <View style={styles.textInputRow}>
            {Platform.OS === 'web' && (
              <input
                type="text"
                placeholder="Type a message (or use mic below)..."
                value={textInput}
                onChange={(e: any) => setTextInput(e.target.value)}
                onKeyDown={(e: any) => e.key === 'Enter' && handleTextSubmit()}
                disabled={stage === 'thinking' || stage === 'speaking'}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: `1px solid ${Colors.border.subtle}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: Colors.text.primary,
                  fontSize: 15,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}
            <Pressable
              style={[styles.sendBtn, !textInput.trim() && styles.sendBtnDisabled]}
              onPress={handleTextSubmit}
              disabled={!textInput.trim() || stage === 'thinking' || stage === 'speaking'}
            >
              <Ionicons name="send" size={18} color={textInput.trim() ? '#fff' : Colors.text.muted} />
            </Pressable>
          </View>

          {/* Mic button */}
          <View style={styles.micSection}>
            <Pressable
              style={[
                styles.micBtn,
                isRecording && styles.micBtnRecording,
                (stage === 'thinking' || stage === 'speaking') && styles.micBtnDisabled,
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={stage === 'thinking' || stage === 'speaking'}
            >
              {stage === 'thinking' || stage === 'speaking' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={isRecording ? 'radio' : 'mic'}
                  size={32}
                  color="#fff"
                />
              )}
            </Pressable>
            <Text style={styles.micHint}>
              {isRecording
                ? 'Release to send'
                : stage === 'thinking'
                  ? 'Generating response...'
                  : stage === 'speaking'
                    ? 'Playing audio...'
                    : 'Hold to speak'}
            </Text>
          </View>
        </View>

        {/* Diagnostics */}
        {(diag.llmResponse || diag.error) && (
          <View style={[styles.card, diag.error ? styles.cardError : styles.cardSuccess]}>
            <Text style={styles.cardLabel}>DIAGNOSTICS</Text>

            {diag.error && (
              <View style={styles.diagRow}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.diagError}>
                  {diag.errorStage ? `[${diag.errorStage.toUpperCase()}] ` : ''}
                  {diag.error}
                </Text>
              </View>
            )}

            {diag.llmResponse && (
              <View style={styles.diagBlock}>
                <Text style={styles.diagLabel}>LLM Response:</Text>
                <Text style={styles.diagValue}>{diag.llmResponse}</Text>
              </View>
            )}

            {diag.llmLatencyMs !== undefined && (
              <View style={styles.diagMetrics}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{diag.llmLatencyMs}ms</Text>
                  <Text style={styles.metricLabel}>LLM</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{diag.ttsLatencyMs}ms</Text>
                  <Text style={styles.metricLabel}>TTS</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {diag.audioSizeBytes ? `${(diag.audioSizeBytes / 1024).toFixed(1)}KB` : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>Audio</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {diag.audioDurationMs ? `${(diag.audioDurationMs / 1000).toFixed(1)}s` : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>Duration</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Reset button */}
        {stage !== 'idle' && (
          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={18} color={Colors.text.primary} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        )}

        {/* Explanation */}
        <View style={[styles.card, { marginTop: Spacing.lg }]}>
          <Text style={styles.cardLabel}>WHAT THIS TESTS</Text>
          <Text style={styles.explainText}>
            This page bypasses the entire Aspire orchestrator (LangGraph, Brain, intent routing) and calls
            OpenAI + ElevenLabs directly from the server. If audio plays here but not in the main app,
            the issue is in the orchestrator pipeline. If audio does NOT play here, the issue is in
            OpenAI/ElevenLabs/browser audio playback.
          </Text>
        </View>
      </ScrollView>
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
    backgroundColor: Colors.background.secondary,
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
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  // Pipeline card
  pipelineCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  pipeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: Spacing.md,
  },
  pipelineNode: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background.tertiary,
    minWidth: 70,
  },
  pipelineActive: {
    backgroundColor: '#3B82F6',
  },
  pipelineText: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  pipelineTextActive: {
    color: '#fff',
  },
  pipelineNote: {
    color: Colors.text.muted,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Cards
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cardError: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cardSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  cardLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  // Agent selector
  agentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 6,
  },
  agentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agentChipText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  // Text input
  textInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.background.tertiary,
  },
  // Mic
  micSection: {
    alignItems: 'center',
    gap: 10,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  micBtnRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  micBtnDisabled: {
    backgroundColor: Colors.background.tertiary,
    shadowOpacity: 0,
  },
  micHint: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  // Diagnostics
  diagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  diagError: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  diagBlock: {
    marginBottom: Spacing.sm,
  },
  diagLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  diagValue: {
    color: Colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  diagMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.sm,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  metricValue: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  metricLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  // Reset
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  resetBtnText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Explain
  explainText: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
