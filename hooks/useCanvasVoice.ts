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
import { useAgentVoice, type VoiceStatus, type VoiceDiagnosticEvent } from '@/hooks/useAgentVoice';
import {
  addActivityEvent,
  setActiveAgent,
  setPersonaState,
  type AgentName,
} from '@/lib/chatCanvasStore';
import { useSupabase } from '@/providers';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

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
  /** Latest structured diagnostics (max 10 retained). */
  diagnostics: VoiceDiagnosticEvent[];
  latestDiagnostic: VoiceDiagnosticEvent | null;
  clearDiagnostics: () => void;
  /** Replay cached TTS audio after autoplay block. */
  replayLastAudio: () => Promise<boolean>;
  /** Browser screenshot events from live Adam/Ava stream. */
  browserEvents: BrowserScreenshotEvent[];
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
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnosticEvent[]>([]);
  const [browserEvents, setBrowserEvents] = useState<BrowserScreenshotEvent[]>([]);

  const {
    status,
    startSession: voiceStart,
    endSession: voiceEnd,
    replayLastAudio,
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
    onActivityEvent: (event) => {
      if (event.type === 'browser_screenshot' && event.data) {
        const data = event.data as Record<string, unknown>;
        const screenshotEvent: BrowserScreenshotEvent = {
          screenshot_url: (data.screenshot_url as string) ?? '',
          screenshot_id: (data.screenshot_id as string) ?? '',
          page_url: (data.page_url as string) ?? '',
          page_title: (data.page_title as string) ?? '',
          timestamp: event.timestamp || Date.now(),
          viewport_width: (data.viewport_width as number) ?? 1280,
          viewport_height: (data.viewport_height as number) ?? 800,
        };
        setBrowserEvents((prev) => [...prev, screenshotEvent].slice(-50));
        return;
      }
      if (
        event.type === 'thinking' ||
        event.type === 'tool_call' ||
        event.type === 'step' ||
        event.type === 'done' ||
        event.type === 'error'
      ) {
        addActivityEvent({
          type: event.type,
          message: event.message || '',
          icon: event.icon || event.type,
          agent: (event.agent as AgentName | undefined) || agent,
        });
      }
    },
    onDiagnostic: (diag) => {
      setDiagnostics((prev) => [...prev, diag].slice(-10));
    },
  });

  const startSession = useCallback(async () => {
    setVoiceError(null);
    setDiagnostics([]);
    setBrowserEvents([]);
    setActiveAgent(agent);
    setPersonaState('listening');
    await voiceStart();
  }, [agent, voiceStart]);

  const endSession = useCallback(() => {
    voiceEnd();
    setPersonaState('idle');
    setBrowserEvents([]);
  }, [voiceEnd]);

  const clearDiagnostics = useCallback(() => {
    setDiagnostics([]);
  }, []);

  return {
    startSession,
    endSession,
    isListening: status === 'listening',
    isProcessing: status === 'thinking',
    status,
    error: voiceError,
    diagnostics,
    latestDiagnostic: diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null,
    clearDiagnostics,
    replayLastAudio,
    browserEvents,
  };
}
