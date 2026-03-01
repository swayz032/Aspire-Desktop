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
  /** Replay last audio that was blocked by browser autoplay policy. */
  replayLastAudio: () => Promise<boolean>;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const currentTraceIdRef = useRef<string | null>(null);

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
   * Creates a single blob from all chunks and plays via Audio element.
   */
  const playContextAudio = useCallback((contextId: string) => {
    const chunks = audioChunksRef.current.get(contextId);
    audioChunksRef.current.delete(contextId);

    // Only play if this is still the active context
    if (contextId !== currentContextRef.current) return;

    if (!chunks || chunks.length === 0 || !activeRef.current) {
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
      return;
    }

    // Merge chunks into a single audio blob
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    if (totalLength === 0) {
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
      return;
    }

    const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onerror = () => {
      console.error('[useAgentVoice] Audio playback error for context', contextId);
      onError?.(new Error('Audio playback failed — response shown in chat.'));
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'tts',
        code: 'TTS_PLAYBACK_FAILED',
        message: 'Audio playback failed after synthesis.',
        recoverable: true,
      });
      URL.revokeObjectURL(url);
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
    };

    audio.onended = () => {
      URL.revokeObjectURL(url);
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
    };

    audio.play().catch((playError: any) => {
      console.error('[useAgentVoice] Autoplay blocked:', playError?.message);
      lastAudioUrlRef.current = url;
      onError?.(new Error('Audio blocked by browser — tap to retry.'));
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'autoplay',
        code: 'AUTOPLAY_BLOCKED',
        message: 'Browser blocked audio playback until user interaction.',
        raw: playError?.message ? String(playError.message).slice(0, 220) : undefined,
        recoverable: true,
      });
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
    });
  }, [updateStatus, onError, emitDiagnostic, nextTraceId]);

  /**
   * Speak response text via HTTP streaming TTS.
   * Used as fallback when WebSocket TTS is unavailable.
   */
  const speakViaHttpStream = useCallback(async (responseText: string) => {
    const stream = await streamSpeak(agent, responseText, accessToken);
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

      const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onerror = () => {
        onError?.(new Error('Audio playback failed — response shown in chat.'));
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'tts',
        code: 'TTS_PLAYBACK_FAILED',
        message: 'Audio playback failed after synthesis.',
        recoverable: true,
      });
        URL.revokeObjectURL(url);
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      };

      try {
        await audio.play();
      } catch (playError: any) {
        lastAudioUrlRef.current = url;
        onError?.(new Error('Audio blocked by browser — tap to retry.'));
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'autoplay',
        code: 'AUTOPLAY_BLOCKED',
        message: 'Browser blocked audio playback until user interaction.',
        raw: playError?.message ? String(playError.message).slice(0, 220) : undefined,
        recoverable: true,
      });
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      }
    } else {
      if (!stream) {
        console.error('[useAgentVoice] HTTP TTS stream returned null. Check ELEVENLABS_API_KEY.');
        onError?.(new Error('Voice synthesis unavailable — response shown in chat.'));
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
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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
        'X-Trace-Id': traceId,
        'X-Correlation-Id': traceId,
      };
      if (suiteId) {
        headers['X-Suite-Id'] = suiteId;
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      let responseText = 'I couldn\'t process that request.';
      let receiptId: string | null = null;

      // Wave 6: If onActivityEvent callback is provided, use SSE streaming.
      if (options.onActivityEvent) {
        const query = new URLSearchParams({
          stream: 'true',
          agent,
          text,
          channel: 'voice',
          correlation_id: traceId,
        });
        if (suiteId) query.set('suiteId', suiteId);

        await new Promise<void>((resolve, reject) => {
          const eventSource = new EventSource(`/api/orchestrator/intent?${query.toString()}`);
          let completed = false;

          eventSource.onmessage = (msg) => {
            try {
              const event = JSON.parse(msg.data);
              if (event.type === 'response') {
                const payload = event.data || event;
                responseText = payload.response || payload.text || responseText;
                receiptId = payload.receipt_id || null;
                completed = true;
                eventSource.close();
                resolve();
                return;
              }
              options.onActivityEvent?.(event);
            } catch (e) {
              console.error('[useAgentVoice] Failed to parse SSE event:', e);
            }
          };

          eventSource.onerror = () => {
            if (completed) return;
            eventSource.close();
            emitDiagnostic({
              traceId,
              stage: 'orchestrator',
              code: 'SSE_STREAM_DISCONNECTED',
              message: 'Orchestrator SSE stream disconnected before response.',
              recoverable: true,
            });
            reject(new Error('SSE stream failed'));
          };
        });
      } else {
        const resp = await fetch('/api/orchestrator/intent', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agent,
            text,
            voiceId: getVoiceId(agent),
            channel: 'voice',
          }),
        });

        if (!resp.ok) {
          let detail = `Service returned ${resp.status}`;
          try {
            const errData = await resp.json();
            detail =
              errData?.response ||
              errData?.message ||
              errData?.error ||
              detail;
          } catch {
            try {
              const rawText = await resp.text();
              if (rawText?.trim()) detail = rawText.trim();
            } catch {
              // keep default detail
            }
          }
          emitDiagnostic({
            traceId,
            stage: 'orchestrator',
            code: `ORCH_HTTP_${resp.status}`,
            message: detail,
            raw: detail.slice(0, 220),
            recoverable: resp.status >= 500,
          });
          throw new Error(detail);
        }

        const data = await resp.json();
        responseText = data.response || data.text || responseText;
        receiptId = data.receipt_id || null;
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
        console.warn('[useAgentVoice] WebSocket TTS unavailable, using HTTP stream fallback');
        await speakViaHttpStream(responseText);
      }
    } catch (error) {
      processingRef.current = false;
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
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
      updateStatus('error');
      setTimeout(() => {
        if (activeRef.current) {
          updateStatus('listening');
        }
      }, 2000);
    }
  }, [agent, suiteId, accessToken, onTranscript, onResponse, onError, updateStatus, speakViaHttpStream, playContextAudio, options.onActivityEvent, nextTraceId, emitDiagnostic]);

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
   * Replay the last TTS audio that was blocked by browser autoplay policy.
   * Must be called from a user gesture handler (click/tap) to satisfy autoplay.
   * Returns true if replay succeeded, false if no audio was stored.
   */
  const replayLastAudio = useCallback(async (): Promise<boolean> => {
    const url = lastAudioUrlRef.current;
    if (!url) return false;

    try {
      updateStatus('speaking');
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        lastAudioUrlRef.current = null;
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        lastAudioUrlRef.current = null;
        processingRef.current = false;
        if (activeRef.current) updateStatus('listening');
      };
      await audio.play();
      return true;
    } catch {
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'autoplay',
        code: 'AUTOPLAY_REPLAY_FAILED',
        message: 'Audio replay failed after user gesture.',
        recoverable: true,
      });
      URL.revokeObjectURL(url);
      lastAudioUrlRef.current = null;
      processingRef.current = false;
      if (activeRef.current) updateStatus('listening');
      return false;
    }
  }, [updateStatus, emitDiagnostic, nextTraceId]);

  /**
   * Start a voice session. Establishes WebSocket TTS connection and
   * begins STT listening. Degrades gracefully if either is unavailable.
   */
  const startSession = useCallback(async () => {
    activeRef.current = true;
    processingRef.current = false;
    updateStatus('listening');

    // Connect WebSocket TTS (persistent for session)
    const voiceConfig = getVoiceConfig(agent);
    const ttsWs = new TtsWebSocket({
      voiceId: voiceConfig.voiceId,
      model: voiceConfig.model,
      onAudio: (contextId, chunk) => {
        // Accumulate audio chunks for the context
        const existing = audioChunksRef.current.get(contextId);
        if (existing) {
          existing.push(chunk);
        }
      },
      onContextDone: (contextId) => {
        // Context finished generating â€” play accumulated audio
        playContextAudio(contextId);
      },
      onConnected: () => {
        console.log(`[useAgentVoice] WebSocket TTS connected for ${agent}`);
      },
      onError: (err) => {
        console.error('[useAgentVoice] WebSocket TTS error:', err.message);
        // Don't surface WS errors as user-facing â€” HTTP fallback handles it
      },
      onClose: () => {
        console.warn('[useAgentVoice] WebSocket TTS disconnected â€” HTTP fallback active');
        ttsWsRef.current = null;
      },
    });

    try {
      await ttsWs.connect();
      ttsWsRef.current = ttsWs;

      // Start keep-alive pings to prevent idle WebSocket disconnect.
      // Only send when an active context exists â€” sending to a non-existent
      // context ID causes ElevenLabs to reject the message or close the socket.
      keepAliveRef.current = setInterval(() => {
        if (ttsWsRef.current?.isConnected && currentContextRef.current) {
          ttsWsRef.current.keepAlive(currentContextRef.current);
        }
      }, 30_000);
    } catch (wsErr) {
      // WebSocket TTS unavailable â€” HTTP streaming fallback will be used
      console.warn(`[useAgentVoice] WebSocket TTS unavailable for ${agent} â€” using HTTP fallback:`, wsErr);
      const msg = wsErr instanceof Error ? wsErr.message : String(wsErr);
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'tts',
        code: 'TTS_WS_CONNECT_FAILED',
        message: 'Realtime TTS socket unavailable; using fallback stream.',
        raw: msg.slice(0, 220),
        recoverable: true,
      });
    }

    // Attempt STT â€” if unavailable (no API key, no mic), session
    // stays active for text input with TTS output
    try {
      await stt.start();
    } catch (sttErr) {
      const msg = sttErr instanceof Error ? sttErr.message : String(sttErr || stt.error || '');
      const isMicPerm = /notallowed|permission|denied|microphone/i.test(msg);
      emitDiagnostic({
        traceId: currentTraceIdRef.current || nextTraceId(),
        stage: 'mic',
        code: isMicPerm ? 'MIC_PERMISSION_DENIED' : 'MIC_INIT_FAILED',
        message: msg || 'Unable to access microphone.',
        raw: msg ? msg.slice(0, 220) : undefined,
        recoverable: true,
      });
      console.warn(`STT unavailable for ${agent} â€” text input + TTS mode`);
    }
  }, [agent, updateStatus, stt, playContextAudio, emitDiagnostic, nextTraceId]);

  /**
   * End the voice session. Closes WebSocket TTS, stops STT, and
   * stops any in-progress audio playback.
   */
  const endSession = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    currentContextRef.current = null;
    audioChunksRef.current.clear();

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

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Clean up any stored autoplay-blocked audio
    if (lastAudioUrlRef.current) {
      URL.revokeObjectURL(lastAudioUrlRef.current);
      lastAudioUrlRef.current = null;
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

  // Cleanup keep-alive timer on unmount
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
    replayLastAudio,
  };
}

