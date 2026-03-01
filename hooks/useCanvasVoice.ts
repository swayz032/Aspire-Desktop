/**
 * useCanvasVoice -- Canvas Mode voice routing hook
 *
 * Routes voice sessions to specific agents when interacting with
 * Canvas Mode agent avatars. Updates chatCanvasStore persona state
 * to drive visual feedback (listening/thinking/speaking indicators).
 *
 * Law #1: Single Brain -- all voice traffic routes through orchestrator.
 * Law #6: Tenant Isolation -- suiteId injected via useAgentVoice.
 *
 * Usage:
 *   const { startSession, endSession, isListening } = useCanvasVoice('finn');
 */

import { useState, useCallback } from 'react';
import { useAgentVoice, type VoiceStatus } from '@/hooks/useAgentVoice';
import {
  setActiveAgent,
  setPersonaState,
  type AgentName,
} from '@/lib/chatCanvasStore';
import { useSupabase } from '@/providers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCanvasVoiceReturn {
  /** Begin voice session with the agent */
  startSession: () => Promise<void>;
  /** End voice session */
  endSession: () => void;
  /** Whether mic is actively listening */
  isListening: boolean;
  /** Whether orchestrator is processing */
  isProcessing: boolean;
  /** Current voice pipeline status */
  status: VoiceStatus;
  /** Last error from voice pipeline (if any) */
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Status-to-persona mapping
// ---------------------------------------------------------------------------

function mapStatusToPersona(status: VoiceStatus): 'idle' | 'listening' | 'thinking' | 'speaking' {
  switch (status) {
    case 'idle':
      return 'idle';
    case 'listening':
      return 'listening';
    case 'thinking':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    case 'error':
      return 'idle';
    default:
      return 'idle';
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasVoice(agent: AgentName): UseCanvasVoiceReturn {
  const { session, suiteId } = useSupabase();

  const [voiceError, setVoiceError] = useState<Error | null>(null);

  const {
    status,
    startSession: voiceStart,
    endSession: voiceEnd,
  } = useAgentVoice({
    agent,
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token ?? undefined,
    onStatusChange: (newStatus) => {
      setActiveAgent(agent);
      setPersonaState(mapStatusToPersona(newStatus));
    },
    onError: (err) => {
      setVoiceError(err);
      setPersonaState('idle');
    },
  });

  const startSession = useCallback(async () => {
    setVoiceError(null);
    setActiveAgent(agent);
    setPersonaState('listening');
    await voiceStart();
  }, [agent, voiceStart]);

  const endSession = useCallback(() => {
    voiceEnd();
    setPersonaState('idle');
  }, [voiceEnd]);

  return {
    startSession,
    endSession,
    isListening: status === 'listening',
    isProcessing: status === 'thinking',
    status,
    error: voiceError,
  };
}
