/**
 * useElevenLabsAgent — ElevenLabs Conversational AI Hook (SDK v1.0)
 *
 * Wraps the ElevenLabs React SDK v1.0 `useConversation` hook with Aspire's
 * voice interface. Requires `ElevenLabsAgentProvider` wrapper in the component tree.
 *
 * v1.0 features used:
 * - ConversationProvider with controlled mute state
 * - useConversation for session management
 * - sendMultimodalMessage for rich content
 * - sendContextualUpdate for background context injection
 * - connectionDelay for mobile audio mode settling
 * - useWakeLock for preventing device sleep
 *
 * Flow: Mic → ElevenLabs Agent (managed session) → Speaker
 *
 * Law #1: The agent's LLM is configured server-side; client is a transport layer.
 * Law #3: Fail closed — missing signed URL or config errors set status to 'error'.
 * Law #6: Tenant isolation via suite_id in dynamic variables.
 * Law #9: API key stays server-side — client uses signed URLs only.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ConversationProvider,
  useConversation,
  type ConversationStatus,
} from '@elevenlabs/react';
import { devLog, devWarn, devError } from '@/lib/devLog';
import { Sentry } from '@/lib/sentry';
import { reportProviderError } from '@/lib/providerErrorReporter';
import type { AgentName } from '@/lib/elevenlabs';
import { getTimeOfDay } from '@/lib/elevenlabs-agents';
// browserAudioUnlock removed — ElevenLabs SDK v1.0 handles its own audio unlock
import { supabase } from '@/lib/supabase';

const AUTH_COOLDOWN_MS = 60_000;

class AgentSessionHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Re-export VoiceStatus so consumers can import from either hook
export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface UseElevenLabsAgentOptions {
  agent: AgentName;
  suiteId?: string;
  userId?: string;
  accessToken?: string;
  userProfile?: {
    ownerName?: string;
    businessName?: string;
    salutation?: string;
    lastName?: string;
    industry?: string;
  };
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: Error) => void;
  onShowDraft?: (draftId: string, type: string, summary: string) => void;
  onShowReceipt?: (receiptId: string) => void;
  onNavigate?: (path: string) => void;
  onShowNotification?: (message: string, type: 'success' | 'warning' | 'error') => void;
  /** Called when Adam research results should be displayed as visual cards. */
  onShowCards?: (data: { artifact_type: string; records: any[]; summary: string; confidence?: any }) => void;
}

export interface UseElevenLabsAgentReturn {
  status: VoiceStatus;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  transcript: string;
  lastResponse: string;
  sendTextMessage: (text: string) => void;
  /** v1.0: Send contextual update to agent (background info, not shown to user) */
  sendContextualUpdate: (text: string) => void;
  isSessionActive: boolean;
  /** v1.0: Whether the agent is currently speaking */
  isSpeaking: boolean;
  /** v1.0: Whether the agent is currently listening */
  isListening: boolean;
  /** v1.0: Send feedback on the conversation */
  canSendFeedback: boolean;
  sendFeedback: (like: boolean) => void;
}

/**
 * Maps ElevenLabs SDK v1.0 status to our VoiceStatus.
 */
function mapStatus(elStatus: ConversationStatus, mode?: 'speaking' | 'listening'): VoiceStatus {
  switch (elStatus) {
    case 'disconnected':
      return 'idle';
    case 'connecting':
      return 'thinking';
    case 'connected':
      return mode === 'speaking' ? 'speaking' : 'listening';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

/**
 * Fetches a signed URL from the server for a secure agent session.
 */
async function fetchSignedUrl(
  agent: AgentName,
  accessToken?: string,
): Promise<{ signed_url: string; dynamic_variables?: Record<string, string | number | boolean> }> {
  const doFetch = async (token?: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    try {
      return await fetch('/api/elevenlabs/agent-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ agent }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Voice service timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let resp = await doFetch(accessToken);

  // If JWT expired, refresh once and retry.
  if (resp.status === 401 || resp.status === 403) {
    try {
      const { data } = await supabase.auth.refreshSession();
      const refreshedToken = data.session?.access_token;
      if (refreshedToken) {
        resp = await doFetch(refreshedToken);
      }
    } catch (_e) {
      // fall through to structured error below
    }
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new AgentSessionHttpError(resp.status, `Agent session request failed: HTTP ${resp.status} — ${body}`);
  }

  const data = await resp.json();
  if (!data.signed_url) throw new Error('Server returned no signed_url');
  return data;
}

// ── Provider Component ────────────────────────────────────────────────────

/**
 * ElevenLabsAgentProvider — wraps children with ConversationProvider.
 * Must be placed in the component tree above any useElevenLabsAgent consumer.
 *
 * v1.0 requirement: useConversation needs ConversationProvider ancestor.
 */
export function ElevenLabsAgentProvider({ children }: { children: React.ReactNode }) {
  // ElevenLabs SDK v1.0 handles browser audio unlock internally via
  // ConversationProvider — no manual unlock listeners needed.

  return (
    <ConversationProvider
      connectionDelay={{
        android: 3000,
        ios: 500,
        default: 0,
      }}
      useWakeLock={true}
    >
      {children}
    </ConversationProvider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

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
    onShowCards,
  } = options;

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [isSessionActiveState, setIsSessionActiveState] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');

  // Refs to avoid stale closures
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
  const onShowCardsRef = useRef(onShowCards);
  onShowCardsRef.current = onShowCards;
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const authBlockedUntilRef = useRef(0);

  const sessionActiveRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startSessionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    authBlockedUntilRef.current = 0;
  }, [accessToken]);

  // ensureMicrophoneReady removed — ElevenLabs SDK v1.0 acquires the mic
  // internally. Pre-acquiring via getUserMedia then stopping tracks causes
  // hardware audio contention and crackling on some browsers/devices.

  const updateStatus = useCallback((newStatus: VoiceStatus) => {
    setVoiceStatus(prev => {
      if (prev === newStatus) return prev;
      onStatusChangeRef.current?.(newStatus);
      return newStatus;
    });
  }, []);

  const handleError = useCallback((error: Error) => {
    devError(`[ElevenLabsAgent] Error for agent "${agent}":`, error.message);
    reportProviderError({ provider: 'elevenlabs', action: 'agent_session', error, component: 'useElevenLabsAgent' });
    Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs agent error', level: 'error', data: { agent, error: error.message } });
    Sentry.captureException(error, { tags: { voice_agent: agent, provider: 'elevenlabs' } });
    updateStatus('error');
    onErrorRef.current?.(error);
  }, [agent, updateStatus]);

  // Client tools
  const clientTools = useRef({
    show_draft: async (params: { draft_id: string; type: string; summary: string }) => {
      devLog(`[ElevenLabsAgent] show_draft:`, params);
      onShowDraftRef.current?.(params.draft_id, params.type, params.summary);
      return JSON.stringify({ shown: true, draft_id: params.draft_id });
    },
    show_receipt: async (params: { receipt_id: string }) => {
      devLog(`[ElevenLabsAgent] show_receipt:`, params);
      onShowReceiptRef.current?.(params.receipt_id);
      return JSON.stringify({ shown: true, receipt_id: params.receipt_id });
    },
    navigate: async (params: { path: string }) => {
      devLog(`[ElevenLabsAgent] navigate:`, params);
      onNavigateRef.current?.(params.path);
      return JSON.stringify({ navigated: true, path: params.path });
    },
    show_notification: async (params: { message: string; type: 'success' | 'warning' | 'error' }) => {
      devLog(`[ElevenLabsAgent] show_notification:`, params);
      onShowNotificationRef.current?.(params.message, params.type);
      return JSON.stringify({ shown: true });
    },
    show_cards: async (params: { artifact_type: string; records: any[]; summary: string; confidence?: any }) => {
      devLog(`[ElevenLabsAgent] show_cards:`, params.artifact_type, `${params.records?.length ?? 0} records`);

      // THREAT-004: Validate payload before rendering (Law #3: fail closed)
      if (!params.artifact_type || typeof params.artifact_type !== 'string') {
        devLog(`[ElevenLabsAgent] show_cards BLOCKED: missing artifact_type`);
        return JSON.stringify({ shown: false, reason: 'invalid_artifact_type' });
      }
      if (!Array.isArray(params.records) || params.records.length === 0) {
        devLog(`[ElevenLabsAgent] show_cards BLOCKED: empty records`);
        return JSON.stringify({ shown: false, reason: 'empty_records' });
      }

      let finalRecords = params.records;
      let artifactType = params.artifact_type;

      // Always try to fetch full records from gateway cache.
      // The records ElevenLabs passes are slim (heavy arrays stripped to keep LLM fast).
      // The gateway caches full records (sale_history, foreclosure_records, permits,
      // schools, comps) when invoke_adam returns card_records.
      // Fetch /api/card-data/latest — single-user desktop app, latest is always correct.
      try {
        const resp = await fetch('/api/card-data/latest');
        if (resp.ok) {
          const cached = await resp.json();
          if (cached.records && Array.isArray(cached.records) && cached.records.length > 0) {
            devLog(`[ElevenLabsAgent] show_cards: upgraded to ${cached.records.length} full records from gateway cache`);
            finalRecords = cached.records;
            if (cached.artifactType) {
              artifactType = cached.artifactType;
            }
          }
        } else {
          devLog(`[ElevenLabsAgent] show_cards: no cached full records (${resp.status}), using LLM records`);
        }
      } catch (err) {
        devLog(`[ElevenLabsAgent] show_cards: cache fetch failed, using LLM records`, err);
      }

      // Cap records at 20 to prevent DoS (THREAT-008)
      const safeRecords = finalRecords.slice(0, 20);
      // Cap summary length
      const safeSummary = typeof params.summary === 'string' ? params.summary.slice(0, 500) : '';

      onShowCardsRef.current?.({
        artifact_type: artifactType,
        records: safeRecords,
        summary: safeSummary,
        confidence: params.confidence,
      });
      return JSON.stringify({ shown: true, count: safeRecords.length });
    },
  }).current;

  // v1.0 useConversation — must be inside ConversationProvider
  const conversation = useConversation({
    clientTools,
    onConnect: ({ conversationId }) => {
      devLog(`[ElevenLabsAgent] Connected: ${conversationId} (agent: ${agent})`);
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session connected', level: 'info', data: { agent, conversationId } });
      reconnectAttemptsRef.current = 0;
      updateStatus('listening');
    },
    onDisconnect: (details) => {
      devLog(`[ElevenLabsAgent] Disconnected:`, details.reason);
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session disconnected', level: 'info', data: { agent, reason: details.reason } });
      sessionActiveRef.current = false;
      setIsSessionActiveState(false);

      if (details.reason === 'error' && reconnectAttemptsRef.current < 3) {
        // Auto-reconnect with exponential backoff (1s, 2s, 4s)
        const attempt = reconnectAttemptsRef.current;
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        reconnectAttemptsRef.current = attempt + 1;
        devLog(`[ElevenLabsAgent] Auto-reconnect attempt ${attempt + 1}/3 in ${delayMs}ms`);
        updateStatus('thinking');
        reconnectTimerRef.current = setTimeout(() => {
          // startSession is defined below — use the ref pattern to avoid stale closure
          startSessionRef.current?.();
        }, delayMs);
      } else {
        updateStatus('idle');
        if (details.reason === 'error') {
          handleError(new Error(`Session disconnected: ${'message' in details ? details.message : 'unknown error'}`));
        }
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
      }
    },
    onStatusChange: ({ status: sdkStatus }) => {
      const mapped = mapStatus(sdkStatus as ConversationStatus, conversation.mode);
      updateStatus(mapped);
    },
    onModeChange: ({ mode }) => {
      if (conversation.status === 'connected') {
        updateStatus(mode === 'speaking' ? 'speaking' : 'listening');
      }
    },
  });

  const startSession = useCallback(async () => {
    // If a previous session is still active (same hook or lingering SDK connection
    // from a different agent page), end it and wait briefly for WebRTC teardown.
    const needsCleanup = sessionActiveRef.current || conversation.status === 'connected';
    if (needsCleanup) {
      devLog('[ElevenLabsAgent] Cleaning up previous session before starting new one');
      try { conversation.endSession(); } catch (_e) { /* swallow */ }
      sessionActiveRef.current = false;
      setIsSessionActiveState(false);
      // Brief wait for SDK to release WebRTC connections and audio hardware
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (Date.now() < authBlockedUntilRef.current) {
      const waitSeconds = Math.ceil((authBlockedUntilRef.current - Date.now()) / 1000);
      handleError(new Error(`Authentication expired. Please re-authenticate and retry in ${waitSeconds}s.`));
      return;
    }

    try {
      sessionActiveRef.current = true;
      setIsSessionActiveState(true);
      updateStatus('thinking');
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session starting', level: 'info', data: { agent } });

      // ElevenLabs SDK v1.0 manages its own AudioContext, mic acquisition,
      // and browser autoplay unlock via ConversationProvider. Pre-acquiring the
      // mic via getUserMedia or creating AudioContexts before the SDK causes
      // hardware audio contention and crackling artifacts. Let the SDK handle it.

      const { signed_url, dynamic_variables: serverVars } = await fetchSignedUrl(agent, accessTokenRef.current);

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
        // No TTS/agent overrides — server-side agent config controls voice settings.
        // Passing stability/similarityBoost causes "Override for field not allowed by config" disconnect.
      });

      devLog(`[ElevenLabsAgent] Session started for agent "${agent}"`);
    } catch (err) {
      sessionActiveRef.current = false;
      setIsSessionActiveState(false);
      if (err instanceof AgentSessionHttpError && (err.status === 401 || err.status === 403)) {
        authBlockedUntilRef.current = Date.now() + AUTH_COOLDOWN_MS;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      handleError(error);
    }
  }, [agent, suiteId, userId, userProfile, conversation, updateStatus, handleError]);

  // Keep ref in sync for reconnect callback (avoids stale closure in onDisconnect)
  startSessionRef.current = startSession;

  const endSession = useCallback(async () => {
    if (!sessionActiveRef.current) return;
    // Cancel any pending reconnect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    try {
      conversation.endSession();
      sessionActiveRef.current = false;
      setIsSessionActiveState(false);
      updateStatus('idle');
      Sentry.addBreadcrumb({ category: 'voice', message: 'ElevenLabs session ended', level: 'info', data: { agent } });
      devLog(`[ElevenLabsAgent] Session ended for agent "${agent}"`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      devError('[ElevenLabsAgent] Error ending session:', error.message);
      sessionActiveRef.current = false;
      setIsSessionActiveState(false);
      updateStatus('idle');
    }
  }, [agent, conversation, updateStatus]);

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

  // v1.0: Send background context to agent (not shown to user)
  const sendContextualUpdate = useCallback((text: string) => {
    if (!sessionActiveRef.current) return;
    conversation.sendContextualUpdate(text);
  }, [conversation]);

  // Mute mic when tab is hidden, unmute when visible (prevents background capture)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (!sessionActiveRef.current) return;
      if (document.hidden) {
        conversation.setMuted(true);
        devLog('[ElevenLabsAgent] Tab hidden — mic muted');
      } else {
        conversation.setMuted(false);
        devLog('[ElevenLabsAgent] Tab visible — mic unmuted');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (sessionActiveRef.current) {
        try { conversation.endSession(); } catch (_e) { /* swallow */ }
        sessionActiveRef.current = false;
      }
    };
  }, [conversation]);

  return {
    status: voiceStatus,
    startSession,
    endSession,
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    transcript,
    lastResponse,
    sendTextMessage,
    sendContextualUpdate,
    isSessionActive: isSessionActiveState,
    isSpeaking: conversation.isSpeaking,
    isListening: conversation.isListening,
    canSendFeedback: conversation.canSendFeedback,
    sendFeedback: conversation.sendFeedback,
  };
}
