/**
 * useElevenLabsAgent — ElevenLabs Conversational AI Hook
 *
 * Thin wrapper around `useConversation` from @elevenlabs/react that provides
 * a compatible interface with the existing `useAgentVoice` hook for easy migration.
 *
 * Flow: Mic → ElevenLabs Agent (managed session) → Speaker
 * The ElevenLabs agent handles STT, LLM routing, and TTS internally.
 *
 * Client tools allow the agent to trigger UI actions (navigation, modals, toasts).
 *
 * Law #1: The agent's LLM is configured server-side; client is a transport layer.
 * Law #3: Fail closed — missing signed URL or config errors set status to 'error'.
 * Law #6: Tenant isolation via suite_id in dynamic variables.
 * Law #9: API key stays server-side — client uses signed URLs only.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { Status as ElevenLabsStatus } from '@elevenlabs/react';
import { devLog, devWarn, devError } from '@/lib/devLog';
import { Sentry } from '@/lib/sentry';
import { reportProviderError } from '@/lib/providerErrorReporter';
import type { AgentName } from '@/lib/elevenlabs';
import { getTimeOfDay } from '@/lib/elevenlabs-agents';

// Re-export VoiceStatus so consumers can import from either hook
export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface UseElevenLabsAgentOptions {
  /** Which Aspire agent to connect to. */
  agent: AgentName;
  /** Suite ID for tenant isolation (Law #6). */
  suiteId?: string;
  /** Supabase user ID — passed to ElevenLabs as conversation userId. */
  userId?: string;
  /** JWT access token for auth (Law #3). */
  accessToken?: string;
  /** User profile for personalized greetings via dynamic variables. */
  userProfile?: {
    ownerName?: string;
    businessName?: string;
    salutation?: string;
    lastName?: string;
    industry?: string;
  };
  /** Called when user speech is transcribed. */
  onTranscript?: (text: string) => void;
  /** Called when the agent responds with text. */
  onResponse?: (text: string) => void;
  /** Called when voice status changes. */
  onStatusChange?: (status: VoiceStatus) => void;
  /** Called on errors. */
  onError?: (error: Error) => void;
  /** Called when the agent triggers show_draft client tool. */
  onShowDraft?: (draftId: string, type: string, summary: string) => void;
  /** Called when the agent triggers show_receipt client tool. */
  onShowReceipt?: (receiptId: string) => void;
  /** Called when the agent triggers navigate client tool. */
  onNavigate?: (path: string) => void;
  /** Called when the agent triggers show_notification client tool. */
  onShowNotification?: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export interface UseElevenLabsAgentReturn {
  /** Current voice pipeline status, mapped from ElevenLabs SDK status. */
  status: VoiceStatus;
  /** Start a new agent conversation session. */
  startSession: () => Promise<void>;
  /** End the current session. */
  endSession: () => Promise<void>;
  /** Whether the microphone is muted. */
  isMuted: boolean;
  /** Mute or unmute the microphone. */
  setMuted: (muted: boolean) => void;
  /** Last transcribed user speech. */
  transcript: string;
  /** Last agent response text. */
  lastResponse: string;
  /** Send a text message to the agent (works in voice or text mode). */
  sendTextMessage: (text: string) => void;
  /** Whether the agent session is active (connected). */
  isSessionActive: boolean;
}

/**
 * Maps ElevenLabs SDK status to our VoiceStatus.
 * ElevenLabs uses: 'disconnected' | 'connecting' | 'connected' | 'disconnecting'
 */
function mapStatus(elStatus: ElevenLabsStatus): VoiceStatus {
  switch (elStatus) {
    case 'disconnected':
    case 'disconnecting':
      return 'idle';
    case 'connecting':
      return 'thinking';
    case 'connected':
      return 'listening'; // Initial state, refined by onModeChange
    default:
      return 'idle';
  }
}

/**
 * Fetches a signed URL from the server for a secure agent session.
 * The server handles the ElevenLabs API key (Law #9: no secrets on client).
 */
async function fetchSignedUrl(
  agent: AgentName,
  accessToken?: string,
): Promise<{ signed_url: string; dynamic_variables?: Record<string, string | number | boolean> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const resp = await fetch('/api/elevenlabs/agent-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ agent }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Agent session request failed: HTTP ${resp.status} — ${body}`);
  }

  const data = await resp.json();
  if (!data.signed_url) {
    throw new Error('Server returned no signed_url');
  }
  return data;
}

export function useElevenLabsAgent(options: UseElevenLabsAgentOptions): UseElevenLabsAgentReturn {
  const {
    agent,
    suiteId,
    userId,
    accessToken,
    userProfile,
    onTranscript,
    onResponse,
    onStatusChange,
    onError,
    onShowDraft,
    onShowReceipt,
    onNavigate,
    onShowNotification,
  } = options;

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isMuted, setIsMutedState] = useState(false);

  // Refs to avoid stale closures in callbacks
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onShowDraftRef = useRef(onShowDraft);
  onShowDraftRef.current = onShowDraft;
  const onShowReceiptRef = useRef(onShowReceipt);
  onShowReceiptRef.current = onShowReceipt;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onShowNotificationRef = useRef(onShowNotification);
  onShowNotificationRef.current = onShowNotification;
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // Track whether we initiated a session to avoid double-start
  const sessionActiveRef = useRef(false);

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setVoiceStatus(prev => {
      if (prev === newStatus) return prev;
      onStatusChangeRef.current?.(newStatus);
      return newStatus;
    });
  }, []);

  const handleError = useCallback((error: Error) => {
    devError(`[ElevenLabsAgent] Error for agent "${agent}":`, error.message);
    reportProviderError({
      provider: 'elevenlabs',
      action: 'agent_session',
      error,
      component: 'useElevenLabsAgent',
    });
    Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs agent error', level: 'error', data: { agent, error: error.message } });
    Sentry.captureException(error, {
      tags: { voice_agent: agent, provider: 'elevenlabs', voice_code: 'AGENT_SESSION_ERROR' },
    });
    updateStatus('error');
    onErrorRef.current?.(error);
  }, [agent, updateStatus]);

  // Client tools that the agent can invoke to trigger UI actions.
  // Each tool calls the corresponding callback ref so consumers can
  // handle navigation, modals, toasts, etc. without coupling this hook
  // to expo-router or a specific toast library.
  const clientTools = useRef({
    show_draft: async (params: { draft_id: string; type: string; summary: string }): Promise<string> => {
      devLog(`[ElevenLabsAgent] show_draft called:`, params);
      onShowDraftRef.current?.(params.draft_id, params.type, params.summary);
      return JSON.stringify({ shown: true, draft_id: params.draft_id });
    },
    show_receipt: async (params: { receipt_id: string }): Promise<string> => {
      devLog(`[ElevenLabsAgent] show_receipt called:`, params);
      onShowReceiptRef.current?.(params.receipt_id);
      return JSON.stringify({ shown: true, receipt_id: params.receipt_id });
    },
    navigate: async (params: { path: string }): Promise<string> => {
      devLog(`[ElevenLabsAgent] navigate called:`, params);
      onNavigateRef.current?.(params.path);
      return JSON.stringify({ navigated: true, path: params.path });
    },
    show_notification: async (params: { message: string; type: 'success' | 'warning' | 'error' }): Promise<string> => {
      devLog(`[ElevenLabsAgent] show_notification called:`, params);
      onShowNotificationRef.current?.(params.message, params.type);
      return JSON.stringify({ shown: true });
    },
  }).current;

  const conversation = useConversation({
    clientTools,
    micMuted: isMuted,
    // Prevent device from sleeping during voice session
    useWakeLock: true,
    // Allow mic audio mode to settle before connecting (prevents initial audio glitch)
    connectionDelay: {
      android: 3000,  // Android needs more time for audio mode switch
      ios: 500,       // iOS needs a brief moment
      default: 200,   // Desktop browsers — small buffer
    },
    onConnect: ({ conversationId }) => {
      devLog(`[ElevenLabsAgent] Connected: ${conversationId} (agent: ${agent})`);
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session connected', level: 'info', data: { agent, conversationId } });
      updateStatus('listening');
    },
    onDisconnect: (details) => {
      devLog(`[ElevenLabsAgent] Disconnected:`, details.reason);
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session disconnected', level: 'info', data: { agent, reason: details.reason } });
      sessionActiveRef.current = false;
      updateStatus('idle');
      if (details.reason === 'error') {
        handleError(new Error(`Session disconnected: ${'message' in details ? details.message : 'unknown error'}`));
      }
    },
    onError: (message: string) => {
      handleError(new Error(message));
    },
    onMessage: (payload) => {
      if (payload.role === 'user') {
        setTranscript(payload.message);
        onTranscriptRef.current?.(payload.message);
      } else if (payload.role === 'agent') {
        setLastResponse(payload.message);
        onResponseRef.current?.(payload.message);
        // Ensure status is speaking when agent message arrives
        updateStatus('speaking');
      }
    },
    onStatusChange: ({ status: sdkStatus }) => {
      const mapped = mapStatus(sdkStatus);
      updateStatus(mapped);
    },
    onModeChange: ({ mode }) => {
      // Mode is 'speaking' | 'listening' — refine the connected status
      if (conversation.status === 'connected') {
        updateStatus(mode === 'speaking' ? 'speaking' : 'listening');
      }
    },
  });

  const startSession = useCallback(async () => {
    if (sessionActiveRef.current) {
      devWarn('[ElevenLabsAgent] Session already active, ignoring startSession call');
      return;
    }

    try {
      sessionActiveRef.current = true;
      updateStatus('thinking');
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session starting', level: 'info', data: { agent } });

      // Fetch signed URL from server (Law #9: API key stays server-side)
      const { signed_url, dynamic_variables: serverVars } = await fetchSignedUrl(
        agent,
        accessTokenRef.current,
      );

      // Build dynamic variables for session personalization
      // Extract last name from ownerName if lastName not provided separately
      const ownerName = userProfile?.ownerName || '';
      const lastName = userProfile?.lastName || ownerName.trim().split(' ').pop() || '';

      const dynamicVariables: Record<string, string | number | boolean> = {
        suite_id: suiteId || '',
        user_id: userId || '',
        salutation: userProfile?.salutation || (lastName ? 'Mr.' : ''),
        last_name: lastName,
        owner_name: ownerName,
        business_name: userProfile?.businessName || '',
        industry: userProfile?.industry || '',
        time_of_day: getTimeOfDay(),
        current_date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        ...serverVars,
      };

      await conversation.startSession({
        signedUrl: signed_url,
        dynamicVariables,
        ...(userId ? { userId } : {}),
        overrides: {
          tts: {
            modelId: "eleven_v3",
            // Latency 2 = balanced (0=none, 1=low, 2=balanced, 3=high, 4=max)
            // 4 was causing audio artifacts and crackling
            optimizeStreamingLatency: 2,
            // Remove outputFormat — let SDK use native format for the connection type
            // WebRTC mode is hardcoded to pcm_48000; forcing pcm_22050 caused resampling glitches
            stability: 0.6,
            similarity_boost: 0.8,
          },
          agent: {
            // Turn detection: allow natural speech pauses
            // 0.3 was too aggressive — cut off mid-sentence
            turn_threshold: 0.6,
            // Silence detection: longer tolerance for thinking pauses
            // 0.4 was too aggressive — treated brief pauses as end of speech
            silence_threshold: 0.8,
            // Mic sensitivity: higher = picks up more, less missed speech
            // 0.3 was too low — missed quiet words causing garbled responses
            sensitivity: 0.6,
            prompt: {
              system: "You are Ava. Be extremely concise, natural, and business-efficient. 1 short sentence per response unless absolutely necessary. No filler."
            }
          }
        },
      });

      devLog(`[ElevenLabsAgent] Session started for agent "${agent}"`);
    } catch (err) {
      sessionActiveRef.current = false;
      const error = err instanceof Error ? err : new Error(String(err));
      handleError(error);
    }
  }, [agent, suiteId, userId, userProfile, conversation, updateStatus, handleError]);

  const endSession = useCallback(async () => {
    if (!sessionActiveRef.current) return;
    try {
      await conversation.endSession();
      sessionActiveRef.current = false;
      updateStatus('idle');
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session ended', level: 'info', data: { agent } });
      devLog(`[ElevenLabsAgent] Session ended for agent "${agent}"`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      devError('[ElevenLabsAgent] Error ending session:', error.message);
      sessionActiveRef.current = false;
      updateStatus('idle');
    }
  }, [agent, conversation, updateStatus]);

  const setMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    // The SDK picks up the new value via the controlled `micMuted` prop on useConversation
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionActiveRef.current) {
        conversation.endSession().catch(() => {
          // Swallow cleanup errors
        });
        sessionActiveRef.current = false;
      }
    };
  }, [conversation]);

  const sendTextMessage = useCallback((text: string) => {
    if (!sessionActiveRef.current) {
      devWarn('[ElevenLabsAgent] Cannot send text — no active session');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    devLog(`[ElevenLabsAgent] Sending text message to agent "${agent}":`, trimmed);
    conversation.sendUserMessage(trimmed);
  }, [agent, conversation]);

  return {
    status: voiceStatus,
    startSession,
    endSession,
    isMuted,
    setMuted,
    transcript,
    lastResponse,
    sendTextMessage,
    isSessionActive: sessionActiveRef.current,
  };
}
