/**
 * useAgentVoice — Orchestrator-Routed Voice Hook
 *
 * Replaces ElevenLabs useConversation() with the correct Aspire architecture:
 * User speaks → Deepgram STT → Orchestrator (LangGraph) → Skill Pack → ElevenLabs TTS → User hears
 *
 * Law #1: Single Brain — LangGraph orchestrator decides, not ElevenLabs.
 * Law #3: Fail Closed — orchestrator errors return 503, not 200.
 * Law #6: Tenant Isolation — X-Suite-Id header required on all requests.
 * ElevenLabs is the mouth (TTS). Deepgram is the ear (STT). The orchestrator is the brain.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { type AgentName, speakText, getVoiceId } from '../lib/elevenlabs';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface UseAgentVoiceOptions {
  agent: AgentName;
  /** Suite ID for tenant isolation (Law #6). Required. */
  suiteId?: string;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string, receiptId?: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: Error) => void;
}

interface UseAgentVoiceReturn {
  status: VoiceStatus;
  isActive: boolean;
  transcript: string;
  lastResponse: string;
  lastReceiptId: string | null;
  startSession: () => Promise<void>;
  endSession: () => void;
  sendText: (text: string) => Promise<void>;
}

/**
 * Voice interaction hook that routes through the orchestrator.
 *
 * startSession() begins listening via Deepgram STT.
 * When speech is detected, it sends the transcript to the orchestrator.
 * The orchestrator routes to the correct skill pack and returns response text.
 * ElevenLabs TTS speaks the response using the agent's voice ID.
 */
export function useAgentVoice(options: UseAgentVoiceOptions): UseAgentVoiceReturn {
  const { agent, suiteId, onTranscript, onResponse, onStatusChange, onError } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  /**
   * Send text to the orchestrator and speak the response.
   * This is the core pipeline: text → orchestrator → TTS.
   */
  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (!suiteId) {
      onError?.(new Error('Missing suiteId — tenant isolation requires authentication'));
      updateStatus('error');
      return;
    }

    setTranscript(text);
    onTranscript?.(text);
    updateStatus('thinking');

    try {
      // Route through orchestrator — the Single Brain (Law #1)
      // Law #6: X-Suite-Id header required for tenant isolation
      const resp = await fetch('/api/orchestrator/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Suite-Id': suiteId,
        },
        body: JSON.stringify({
          agent,
          text,
          voiceId: getVoiceId(agent),
        }),
      });

      if (!resp.ok) {
        throw new Error(`Orchestrator returned ${resp.status}`);
      }

      const data = await resp.json();
      const responseText = data.response || data.text || 'I couldn\'t process that request.';
      const receiptId = data.receipt_id || null;

      setLastResponse(responseText);
      setLastReceiptId(receiptId);
      onResponse?.(responseText, receiptId);

      // Speak the response via ElevenLabs TTS
      updateStatus('speaking');

      const audioBlob = await speakText(agent, responseText);
      if (audioBlob && activeRef.current) {
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (activeRef.current) {
            updateStatus('listening');
          }
        };

        await audio.play();
      } else {
        // TTS unavailable — notify caller (Law #3: don't silently degrade)
        onError?.(new Error('TTS_UNAVAILABLE'));
        if (activeRef.current) {
          updateStatus('listening');
        }
      }
    } catch (error) {
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
  }, [agent, suiteId, onTranscript, onResponse, onError, updateStatus]);

  /**
   * Start a voice session. Begins listening for speech input.
   * The actual STT is handled by useDeepgramSTT or browser SpeechRecognition.
   */
  const startSession = useCallback(async () => {
    if (!suiteId) {
      onError?.(new Error('Cannot start voice session without authentication (missing suiteId)'));
      return;
    }
    activeRef.current = true;
    updateStatus('listening');
  }, [suiteId, updateStatus, onError]);

  /**
   * End the voice session. Stops listening and any in-progress TTS.
   */
  const endSession = useCallback(() => {
    activeRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTranscript('');
    setLastReceiptId(null);
    updateStatus('idle');
  }, [updateStatus]);

  // Auto-end session if suiteId becomes null (logout)
  useEffect(() => {
    if (!suiteId && activeRef.current) {
      endSession();
    }
  }, [suiteId, endSession]);

  return {
    status,
    isActive: activeRef.current,
    transcript,
    lastResponse,
    lastReceiptId,
    startSession,
    endSession,
    sendText,
  };
}
