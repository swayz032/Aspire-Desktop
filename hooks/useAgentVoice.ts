/**
 * useAgentVoice â€” Orchestrator-Routed Voice Hook
 *
 * Full voice pipeline: Mic â†’ STT â†’ Orchestrator (LangGraph) â†’ Skill Pack â†’ ElevenLabs TTS â†’ Speaker
 *
 * TTS Transport (ordered by preference):
 *   1. WebSocket multi-context â€” persistent connection, barge-in, ~75ms Flash v2.5
 *   2. HTTP streaming fallback â€” /api/elevenlabs/tts/stream (if WS unavailable)
 *
 * STT Provider Routing:
 *   - Finn, Ava, Eli, Sarah: ElevenLabs STT (Scribe via /api/elevenlabs/stt)
 *   - Nora: Deepgram STT (conference transcription via LiveKit)
 *
 * Law #1: Single Brain â€” LangGraph orchestrator decides, not any provider.
 * Law #3: Fail Closed â€” orchestrator errors return 503, not 200.
 * Law #6: Tenant Isolation â€” X-Suite-Id header required on all requests.
 *
 * Voice is the PRIMARY interaction mode. Chat is a fallback option.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { devLog, devWarn, devError } from '@/lib/devLog';
import { type AgentName, streamSpeak, getVoiceId, getVoiceConfig } from '../lib/elevenlabs';
import { TtsWebSocket } from '../lib/tts-websocket';
import { useDeepgramSTT } from './useDeepgramSTT';
import { useElevenLabsSTT } from './useElevenLabsSTT';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
export type VoiceFailureStage = 'mic' | 'stt' | 'orchestrator' | 'tts' | 'autoplay';

export interface VoiceDiagnosticEvent {
  traceId: string;
  agent: AgentName;
  stage: VoiceFailureStage;
  code: string;
  message: string;
  raw?: string;
  timestamp: number;
  correlationId?: string;
  httpStatus?: number;
  retryAfterMs?: number;
  recoverable: boolean;
}

/** Agents that use Deepgram STT (LiveKit conference). All others use ElevenLabs. */
const DEEPGRAM_STT_AGENTS: string[] = ['nora'];

interface AgentActivityEvent {
  type: 'thinking' | 'tool_call' | 'step' | 'done' | 'error' | 'browser_screenshot' | 'response' | 'connected' | 'heartbeat';
  message: string;
  icon: string;
  timestamp: number;
  agent?: string;
  data?: unknown;
}

interface UseAgentVoiceOptions {
  agent: AgentName;
  /** Suite ID for tenant isolation (Law #6). Required. */
  suiteId?: string;
  /** JWT access token for auth (Law #3). Required in production. */
  accessToken?: string;
  /** User profile for personalized greetings and context. */
  userProfile?: {
    ownerName?: string;
    businessName?: string;
    industry?: string;
    teamSize?: string;
    industrySpecialty?: string;
    businessGoals?: string[];
    painPoint?: string;
    preferredChannel?: string;
  };
  onTranscript?: (text: string) => void;
  onResponse?: (text: string, receiptId?: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: Error) => void;
  /** Wave 6: Callback for streaming agent activity events (Canvas Chat Mode). */
  onActivityEvent?: (event: AgentActivityEvent) => void;
  /** Optional structured diagnostics callback for root-cause visibility. */
  onDiagnostic?: (event: VoiceDiagnosticEvent) => void;
}

interface UseAgentVoiceReturn {
  status: VoiceStatus;
  isActive: boolean;
  transcript: string;
  interimTranscript: string;
  lastResponse: string;
  lastReceiptId: string | null;
  startSession: () => Promise<void>;
  endSession: () => void;
  sendText: (text: string) => Promise<void>;
  /** Mute/unmute the microphone (disables audio track without stopping STT). */
  setMuted: (muted: boolean) => void;
  /** Replay last audio that was blocked by browser autoplay policy. */
  replayLastAudio: () => Promise<boolean>;
}

type VoiceErrorPayload = {
  error?: string;
  error_code?: string;
  error_stage?: string;
  message?: string;
  response?: string;
  correlation_id?: string;
  retry_after_ms?: number;
};

function parseVoiceErrorPayload(raw: unknown): VoiceErrorPayload {
  if (!raw || typeof raw !== 'object') return {};
  return raw as VoiceErrorPayload;
}

/**
 * Voice interaction hook that routes through the orchestrator.
 *
 * startSession() establishes a persistent WebSocket TTS connection and
 * begins listening via STT (voice is primary).
 *
 * When speech is detected, it sends the transcript to the orchestrator.
 * The orchestrator routes to the correct skill pack and returns response text.
 * TTS speaks the response using the agent's voice via multi-context WebSocket.
 *
 * Barge-in: if user speaks while agent is talking, the current TTS context
 * is closed and a new one starts for the interruption response.
 *
 * The loop: Listen â†’ Transcribe â†’ Think â†’ Speak â†’ Listen again.
 */
export function useAgentVoice(options: UseAgentVoiceOptions): UseAgentVoiceReturn {
  const { agent, suiteId, accessToken, onTranscript, onResponse, onStatusChange, onError, onDiagnostic } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  
  // AudioContext refs (Law #8: Warm voice interaction)
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const activeRef = useRef(false);
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  // Prevent duplicate sends while processing
  const processingRef = useRef(false);
  // Store last audio URL for replay on autoplay block
  const lastAudioUrlRef = useRef<string | null>(null);
  // WebSocket TTS connection (persistent for session duration)
  const ttsWsRef = useRef<TtsWebSocket | null>(null);
  // Current TTS context ID (for barge-in tracking)
  const currentContextRef = useRef<string | null>(null);
  // Audio chunks accumulated per context
  const audioChunksRef = useRef<Map<string, Uint8Array[]>>(new Map());
  // Keep-alive timer for TTS WebSocket (prevents idle disconnect)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Delay auth-loss shutdown to avoid false offline flips during token refresh.
  const authLossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SSE abort controller for cleanup on unmount/session-end (S3-H3)
  const sseAbortRef = useRef<AbortController | null>(null);
  const currentTraceIdRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);

  const useDeepgram = DEEPGRAM_STT_AGENTS.includes(agent);

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Stable refs for callbacks used in TtsWebSocket (avoids recreation)
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onDiagnosticRef = useRef(onDiagnostic);
  onDiagnosticRef.current = onDiagnostic;
  const updateStatusRef = useRef(updateStatus);
  updateStatusRef.current = updateStatus;

  const nextTraceId = useCallback(() => {
    return `voice-${agent}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, [agent]);

  const buildTraceHeaders = useCallback((traceId: string): Record<string, string> => ({
    'X-Trace-Id': traceId,
    'X-Correlation-Id': traceId,
  }), []);

  const emitDiagnostic = useCallback((event: Omit<VoiceDiagnosticEvent, 'agent' | 'timestamp'>) => {
    const payload: VoiceDiagnosticEvent = {
      agent,
      timestamp: Date.now(),
      ...event,
    };
    onDiagnosticRef.current?.(payload);
  }, [agent]);

  /**
   * Play accumulated audio chunks for a completed TTS context.
   * Decodes chunks using Web Audio API and plays through AudioContext destination.
   */
  const playContextAudio = useCallback(async (contextId: string) => {
    const chunks = audioChunksRef.current.get(contextId);
    audioChunksRef.current.delete(contextId);

    // Only play if this is still the active context
    if (contextId !== currentContextRef.current) return;

    if (!chunks || chunks.length === 0 || !activeRef.current) {
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
      return;
    }

    // Merge chunks into a single ArrayBuffer
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const audioData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioData.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;

      // Resume if suspended (Law #8: Warm interaction requires active audio path)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Decode the accumulated audio data
      const audioBuffer = await ctx.decodeAudioData(audioData.buffer);
      
      // Stop any current source to avoid overlapping speech (Barge-in support)
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentAudioSourceRef.current = source;

      source.onended = () => {
        if (currentAudioSourceRef.current === source) {
          currentAudioSourceRef.current = null;
          processingRef.current = false;
          if (activeRef.current) updateStatus('listening');
        }
      };

      source.start(0);
    } catch (err) {
      devError('[useAgentVoice] Web Audio playback error for context', contextId, err);
      onError?.(new Error('Audio playback failed â€” response shown in chat.'));
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'tts',
        code: 'TTS_PLAYBACK_FAILED',
        message: 'Web Audio playback failed after synthesis.',
        raw: err instanceof Error ? err.message : String(err),
        recoverable: true,
      });
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
    }
  }, [updateStatus, onError, emitDiagnostic, nextTraceId]);

  /**
   * Unlock browser audio output from a user gesture.
   * Some browsers block async TTS playback until an initial play() occurs.
   */
  const unlockAudioPlayback = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true;
    if (audioUnlockedRef.current) return true;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.00001;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.02);
      }

      // Keep probe unmuted; muted autoplay does not reliably unlock future audio.
      const probe = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=');
      probe.muted = false;
      probe.volume = 0.00001;
      probe.setAttribute('playsinline', '');
      await probe.play();
      probe.pause();
      probe.currentTime = 0;
      audioUnlockedRef.current = true;
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'autoplay',
        code: 'AUDIO_UNLOCK_FAILED',
        message: 'Browser blocked audio unlock probe.',
        raw: raw.slice(0, 220),
        recoverable: true,
      });
      return false;
    }
  }, [emitDiagnostic, nextTraceId]);

  /**
   * Speak response text via HTTP streaming TTS.
   * Used as fallback when WebSocket TTS is unavailable.
   */
  const speakViaHttpStream = useCallback(async (responseText: string, traceId: string) => {
    const stream = await streamSpeak(agent, responseText, accessToken, traceId);
    if (stream && activeRef.current) {
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
      }

      if (totalBytes === 0 || !activeRef.current) {
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
        return;
      }

      // Merge chunks into a single ArrayBuffer for AudioContext decoding
      const audioData = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const audioBuffer = await ctx.decodeAudioData(audioData.buffer);
        
        if (currentAudioSourceRef.current) {
          try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        currentAudioSourceRef.current = source;

        source.onended = () => {
          if (currentAudioSourceRef.current === source) {
            currentAudioSourceRef.current = null;
            processingRef.current = false;
            if (activeRef.current) updateStatus('listening');
          }
        };

        source.start(0);
      } catch (err) {
        devError('[useAgentVoice] HTTP Fallback Web Audio error', err);
        onError?.(new Error('Audio playback failed â€” response shown in chat.'));
        emitDiagnostic({
          traceId: currentTraceIdRef.current || nextTraceId(),
          stage: 'tts',
          code: 'TTS_PLAYBACK_FAILED',
          message: 'Web Audio playback failed after synthesis.',
          raw: err instanceof Error ? err.message : String(err),
          recoverable: true,
        });
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      }
    } else {
      if (!stream) {
        devError('[useAgentVoice] HTTP TTS stream returned null. Check ELEVENLABS_API_KEY.');
        onError?.(new Error('Voice synthesis unavailable â€” response shown in chat.'));
        emitDiagnostic({
          traceId: currentTraceIdRef.current || nextTraceId(),
          stage: 'tts',
          code: 'TTS_STREAM_EMPTY',
          message: 'TTS stream unavailable from backend.',
          recoverable: false,
        });
      }
      processingRef.current = false;
      if (activeRef.current) {
        updateStatus('error');
        setTimeout(() => { if (activeRef.current) updateStatus('listening'); }, 2000);
      }
    }
  }, [agent, accessToken, updateStatus, onError, emitDiagnostic, nextTraceId]);

  /**
   * Send text to the orchestrator and speak the response.
   * Core pipeline: text â†’ orchestrator â†’ TTS (WebSocket preferred, HTTP fallback).
   */
  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const traceId = nextTraceId();
    currentTraceIdRef.current = traceId;

    // Barge-in: if already processing, stop current audio and close context
    if (processingRef.current) {
      // Stop current playback (Web Audio API)
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch { /* already stopped */ }
        currentAudioSourceRef.current = null;
      }
      
      // Close current TTS context
      if (currentContextRef.current && ttsWsRef.current?.isConnected) {
        ttsWsRef.current.closeContext(currentContextRef.current);
        audioChunksRef.current.delete(currentContextRef.current);
        currentContextRef.current = null;
      }
    }

    processingRef.current = true;

    setTranscript(text);
    onTranscript?.(text);
    updateStatus('thinking');

    try {
      // Route through orchestrator â€” the Single Brain (Law #1)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...buildTraceHeaders(traceId),
      };
      if (suiteId) {
        headers['X-Suite-Id'] = suiteId;
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      let responseText = 'I couldn\'t process that request.';
      let receiptId: string | null = null;
      const requestStandardResponse = async () => {
        const resp = await fetch('/api/orchestrator/intent', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agent,
            text,
            voiceId: getVoiceId(agent),
            channel: 'voice',
            ...(options.userProfile ? { userProfile: options.userProfile } : {}),
          }),
        });

        if (!resp.ok) {
          let parsed: VoiceErrorPayload = {};
          let detail = `Service returned ${resp.status}`;
          try {
            parsed = parseVoiceErrorPayload(await resp.json());
            detail =
              parsed.response ||
              parsed.message ||
              parsed.error ||
              detail;
          } catch {
            try {
              const rawText = await resp.text();
              if (rawText?.trim()) detail = rawText.trim();
            } catch {
              // keep default detail
            }
          }
          const code = parsed.error_code || `ORCH_HTTP_${resp.status}`;
          const retryAfterMs = typeof parsed.retry_after_ms === 'number' ? parsed.retry_after_ms : undefined;
          emitDiagnostic({
            traceId,
            stage: 'orchestrator',
            code,
            message: detail,
            raw: detail.slice(0, 220),
            correlationId: parsed.correlation_id,
            httpStatus: resp.status,
            retryAfterMs,
            recoverable: resp.status >= 500,
          });
          throw new Error(`${code}: ${detail}`);
        }

        const data = await resp.json();
        responseText = data.response || data.text || responseText;
        receiptId = data.receipt_id || null;
      };

      // Wave 6: If onActivityEvent callback is provided, use SSE streaming.
      // Uses fetch+ReadableStream instead of EventSource to support Authorization headers (S3-C2).
      if (options.onActivityEvent) {
        const sseAbort = new AbortController();
        // Store abort controller for cleanup on unmount (S3-H3)
        sseAbortRef.current = sseAbort;

        try {
          const sseResp = await fetch('/api/orchestrator/intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              ...buildTraceHeaders(traceId),
              ...(suiteId ? { 'X-Suite-Id': suiteId } : {}),
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              stream: true,
              agent,
              text,
              channel: 'voice',
              correlation_id: traceId,
              ...(options.userProfile ? { userProfile: options.userProfile } : {}),
            }),
            signal: sseAbort.signal,
          });

          if (!sseResp.ok || !sseResp.body) {
            throw new Error(`SSE request failed: ${sseResp.status}`);
          }

          const reader = sseResp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let sseCompleted = false;

          while (!sseCompleted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'response') {
                  const payload = event.data || event;
                  responseText = payload.response || payload.text || responseText;
                  receiptId = payload.receipt_id || null;
                  sseCompleted = true;
                  break;
                }
                options.onActivityEvent?.(event);
              } catch (e) {
                devError('[useAgentVoice] Failed to parse SSE event:', e);
              }
            }
          }

          reader.cancel().catch(() => {});
          sseAbortRef.current = null;

          if (!sseCompleted) {
            throw new Error('SSE stream ended without response');
          }
        } catch (err) {
          sseAbortRef.current = null;
          if (sseAbort.signal.aborted) {
            // Component unmounted or session ended — don't fallback
            return;
          }
          emitDiagnostic({
            traceId,
            stage: 'orchestrator',
            code: 'SSE_FALLBACK_POST',
            message: 'SSE stream failed, falling back to standard orchestrator request.',
            recoverable: true,
          });
          await requestStandardResponse();
        }
      } else {
        await requestStandardResponse();
      }

      setLastResponse(responseText);
      setLastReceiptId(receiptId);
      onResponse?.(responseText, receiptId ?? undefined);

      // Speak the response
      updateStatus('speaking');

      // Prefer WebSocket TTS (persistent connection, barge-in ready)
      if (ttsWsRef.current?.isConnected) {
        const ctxId = ttsWsRef.current.nextContextId();
        currentContextRef.current = ctxId;
        audioChunksRef.current.set(ctxId, []);

        // Send text and flush for immediate generation
        ttsWsRef.current.speak(responseText, ctxId);
        ttsWsRef.current.flush(ctxId);

        // Audio arrives via onAudio callback â†’ accumulated in audioChunksRef
        // Playback triggered by onContextDone callback â†’ playContextAudio()
      } else {
        // Fallback: HTTP streaming TTS
        devWarn('[useAgentVoice] WebSocket TTS unavailable, using HTTP stream fallback');
        await speakViaHttpStream(responseText, traceId);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const raw = err.message || 'Unknown error';
      const lower = raw.toLowerCase();
      const stage: VoiceFailureStage =
        /autoplay|play\(\)|notallowed/.test(lower) ? 'autoplay'
        : /tts|voice synthesis|websocket tts|stream fallback/.test(lower) ? 'tts'
        : /mic|microphone|getusermedia|permission/.test(lower) ? 'mic'
        : /stt|transcrib/.test(lower) ? 'stt'
        : 'orchestrator';
      const code =
        stage === 'orchestrator' && /timeout/.test(lower) ? 'ORCH_TIMEOUT'
        : stage === 'orchestrator' && /circuit_open/.test(lower) ? 'CIRCUIT_OPEN'
        : stage === 'orchestrator' && /auth_required/.test(lower) ? 'AUTH_REQUIRED'
        : stage === 'orchestrator' ? 'ORCH_UNAVAILABLE'
        : stage === 'stt' ? 'STT_FAILURE'
        : stage === 'mic' ? 'MIC_FAILURE'
        : stage === 'autoplay' ? 'AUTOPLAY_BLOCKED'
        : 'TTS_FAILURE';
      emitDiagnostic({
        traceId,
        stage,
        code,
        message: raw,
        raw: raw.slice(0, 220),
        recoverable: stage !== 'mic',
      });

      processingRef.current = false;
      onError?.(err);
      updateStatus('error');
      setTimeout(() => {
        if (activeRef.current) {
          updateStatus('listening');
        }
      }, 2000);
    }
  }, [agent, suiteId, accessToken, onTranscript, onResponse, onError, updateStatus, speakViaHttpStream, playContextAudio, options.onActivityEvent, nextTraceId, emitDiagnostic, buildTraceHeaders]);

  // Stable ref for sendText to avoid re-creating STT hook
  const sendTextRef = useRef(sendText);
  sendTextRef.current = sendText;

  // STT utterance handler â€” shared between both providers
  const handleUtterance = useCallback((text: string) => {
    if (activeRef.current) {
      // Allow barge-in: sendText handles stopping current playback
      sendTextRef.current(text);
    }
  }, []);

  // Deepgram STT â€” for Nora (conference transcription via LiveKit)
  const deepgramStt = useDeepgramSTT({
    onUtterance: useDeepgram ? handleUtterance : undefined,
  });

  // ElevenLabs STT â€” for Finn, Ava, Eli, Sarah (voice-first agents)
  const elevenLabsStt = useElevenLabsSTT({
    onUtterance: useDeepgram ? undefined : handleUtterance,
    accessToken,
  });

  // Select the active STT provider
  const stt = useDeepgram ? deepgramStt : elevenLabsStt;

  /**
   * End the voice session. Closes WebSocket TTS, stops STT, and
   * stops any in-progress audio playback.
   */
  const endSession = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    currentContextRef.current = null;
    audioChunksRef.current.clear();

    // Abort any in-flight SSE stream (S3-H3)
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }

    // Stop keep-alive timer
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }

    // Close WebSocket TTS
    if (ttsWsRef.current) {
      ttsWsRef.current.close();
      ttsWsRef.current = null;
    }

    stt.stop();

    // Stop and clear Web Audio source
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch { /* ignore */ }
      currentAudioSourceRef.current = null;
    }

    setTranscript('');
    setLastReceiptId(null);
    updateStatus('idle');
  }, [updateStatus, stt]);

  // Auto-end session on logout (session removed, not just missing suiteId)
  useEffect(() => {
    if (!activeRef.current) return;

    if (accessTokenRef.current) {
      if (authLossTimerRef.current) {
        clearTimeout(authLossTimerRef.current);
        authLossTimerRef.current = null;
      }
      return;
    }

    if (authLossTimerRef.current) return;
    authLossTimerRef.current = setTimeout(() => {
      authLossTimerRef.current = null;
      if (!accessTokenRef.current && activeRef.current) {
        endSession();
      }
    }, 10_000);
  }, [accessToken, endSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (authLossTimerRef.current) {
        clearTimeout(authLossTimerRef.current);
        authLossTimerRef.current = null;
      }
      if (sseAbortRef.current) {
        sseAbortRef.current.abort();
        sseAbortRef.current = null;
      }
      // Close AudioContext to release hardware resources
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    status,
    isActive: activeRef.current,
    transcript,
    interimTranscript: stt.transcript,
    lastResponse,
    lastReceiptId,
    startSession,
    endSession,
    sendText,
    setMuted: stt.setMuted,
    replayLastAudio: async () => false, // No longer needed with AudioContext
  };
}

  // Auto-end session on logout (session removed, not just missing suiteId)
  useEffect(() => {
    if (!activeRef.current) return;

    if (accessTokenRef.current) {
      if (authLossTimerRef.current) {
        clearTimeout(authLossTimerRef.current);
        authLossTimerRef.current = null;
      }
      return;
    }

    if (authLossTimerRef.current) return;
    authLossTimerRef.current = setTimeout(() => {
      authLossTimerRef.current = null;
      if (!accessTokenRef.current && activeRef.current) {
        endSession();
      }
    }, 10_000);
  }, [accessToken, endSession]);

  // Cleanup keep-alive timer and SSE stream on unmount
  useEffect(() => {
    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (authLossTimerRef.current) {
        clearTimeout(authLossTimerRef.current);
        authLossTimerRef.current = null;
      }
      if (sseAbortRef.current) {
        sseAbortRef.current.abort();
        sseAbortRef.current = null;
      }
    };
  }, []);

  return {
    status,
    isActive: activeRef.current,
    transcript,
    interimTranscript: stt.transcript,
    lastResponse,
    lastReceiptId,
    startSession,
    endSession,
    sendText,
    setMuted: stt.setMuted,
    replayLastAudio,
  };
}

