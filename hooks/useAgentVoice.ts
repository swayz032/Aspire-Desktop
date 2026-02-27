/**
 * useAgentVoice — Orchestrator-Routed Voice Hook
 *
 * Full voice pipeline: Mic → STT → Orchestrator (LangGraph) → Skill Pack → ElevenLabs TTS → Speaker
 *
 * STT Provider Routing:
 *   - Finn, Ava, Eli, Sarah: ElevenLabs STT (Scribe via /api/elevenlabs/stt)
 *   - Nora: Deepgram STT (conference transcription via LiveKit)
 *
 * Law #1: Single Brain — LangGraph orchestrator decides, not any provider.
 * Law #3: Fail Closed — orchestrator errors return 503, not 200.
 * Law #6: Tenant Isolation — X-Suite-Id header required on all requests.
 *
 * Voice is the PRIMARY interaction mode. Chat is a fallback option.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { type AgentName, speakText, getVoiceId } from '../lib/elevenlabs';
import { useDeepgramSTT } from './useDeepgramSTT';
import { useElevenLabsSTT } from './useElevenLabsSTT';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

/** Agents that use Deepgram STT (LiveKit conference). All others use ElevenLabs. */
const DEEPGRAM_STT_AGENTS: string[] = ['nora'];

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
}

/**
 * Voice interaction hook that routes through the orchestrator.
 *
 * startSession() begins listening via STT (voice is primary).
 * When speech is detected, it sends the transcript to the orchestrator.
 * The orchestrator routes to the correct skill pack and returns response text.
 * TTS speaks the response using the agent's voice.
 *
 * The loop: Listen → Transcribe → Think → Speak → Listen again.
 */
export function useAgentVoice(options: UseAgentVoiceOptions): UseAgentVoiceReturn {
  const { agent, suiteId, accessToken, onTranscript, onResponse, onStatusChange, onError } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  // Prevent duplicate sends while processing
  const processingRef = useRef(false);

  const useDeepgram = DEEPGRAM_STT_AGENTS.includes(agent);

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  /**
   * Send text to the orchestrator and speak the response.
   * Core pipeline: text → orchestrator → TTS.
   */
  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Prevent overlapping sends
    if (processingRef.current) return;
    processingRef.current = true;

    setTranscript(text);
    onTranscript?.(text);
    updateStatus('thinking');

    try {
      // Route through orchestrator — the Single Brain (Law #1)
      // Server middleware handles suite_id from JWT (Law #6)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (suiteId) {
        headers['X-Suite-Id'] = suiteId;
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const resp = await fetch('/api/orchestrator/intent', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agent,
          text,
          voiceId: getVoiceId(agent),
        }),
      });

      if (!resp.ok) {
        throw new Error(`Service returned ${resp.status}`);
      }

      const data = await resp.json();
      const responseText = data.response || data.text || 'I couldn\'t process that request.';
      const receiptId = data.receipt_id || null;

      setLastResponse(responseText);
      setLastReceiptId(receiptId);
      onResponse?.(responseText, receiptId);

      // Speak the response via TTS
      updateStatus('speaking');

      const audioBlob = await speakText(agent, responseText);
      if (audioBlob && audioBlob.size > 0 && activeRef.current) {
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onerror = (e) => {
          console.error('[useAgentVoice] Audio decode/playback error:', e);
          URL.revokeObjectURL(url);
          processingRef.current = false;
          if (activeRef.current) {
            updateStatus('listening');
          }
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          processingRef.current = false;
          if (activeRef.current) {
            updateStatus('listening');
          }
        };

        try {
          await audio.play();
        } catch (playError: any) {
          console.error('[useAgentVoice] Autoplay blocked:', playError?.message);
          URL.revokeObjectURL(url);
          processingRef.current = false;
          if (activeRef.current) {
            updateStatus('listening');
          }
        }
      } else {
        if (!audioBlob) {
          console.error('[useAgentVoice] TTS returned null for agent "%s". Check ELEVENLABS_API_KEY.', agent);
        }
        processingRef.current = false;
        if (activeRef.current) {
          updateStatus('listening');
        }
      }
    } catch (error) {
      processingRef.current = false;
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      updateStatus('error');
      // Recover to listening after error
      setTimeout(() => {
        if (activeRef.current) {
          updateStatus('listening');
        }
      }, 2000);
    }
  }, [agent, suiteId, accessToken, onTranscript, onResponse, onError, updateStatus]);

  // Stable ref for sendText to avoid re-creating STT hook
  const sendTextRef = useRef(sendText);
  sendTextRef.current = sendText;

  // STT utterance handler — shared between both providers
  const handleUtterance = useCallback((text: string) => {
    if (activeRef.current && !processingRef.current) {
      sendTextRef.current(text);
    }
  }, []);

  // Deepgram STT — for Nora (conference transcription via LiveKit)
  const deepgramStt = useDeepgramSTT({
    onUtterance: useDeepgram ? handleUtterance : undefined,
  });

  // ElevenLabs STT — for Finn, Ava, Eli, Sarah (voice-first agents)
  const elevenLabsStt = useElevenLabsSTT({
    onUtterance: useDeepgram ? undefined : handleUtterance,
  });

  // Select the active STT provider
  const stt = useDeepgram ? deepgramStt : elevenLabsStt;

  /**
   * Start a voice session. Attempts STT for mic input, but degrades
   * gracefully to text-input + TTS-output if STT is unavailable.
   */
  const startSession = useCallback(async () => {
    activeRef.current = true;
    processingRef.current = false;
    updateStatus('listening');

    // Attempt STT — if unavailable (no API key, no mic), session
    // stays active for text input with ElevenLabs TTS output
    try {
      await stt.start();
    } catch {
      // STT unavailable — session stays active for sendText() + TTS
      console.warn(`STT unavailable for ${agent} — text input + TTS mode`);
    }
  }, [agent, updateStatus, stt]);

  /**
   * End the voice session. Stops listening and any in-progress TTS.
   */
  const endSession = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    stt.stop();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTranscript('');
    setLastReceiptId(null);
    updateStatus('idle');
  }, [updateStatus, stt]);

  // Auto-end session on logout (session removed, not just missing suiteId)
  useEffect(() => {
    if (!accessToken && activeRef.current) {
      endSession();
    }
  }, [accessToken, endSession]);

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
  };
}
