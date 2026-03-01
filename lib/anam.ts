/**
 * Anam Avatar SDK Integration (v4.8)
 *
 * Aspire uses Anam for visual avatar rendering (Cara) + voice output (Hope).
 * The LLM brain is 100% Aspire's own orchestrator (GPT-5 via LangGraph).
 *
 * Persona "Ava" (ID: 15d55733-5383-4c3a-84b7-20d9f48bcdb6) created in Anam dashboard:
 *   - Avatar: Cara at desk (30fa96d0-26c4-4e55-94a0-517025942e18)
 *   - Voice: Hope (0c8b52f4-f26d-4810-855c-c90e5f599cbc)
 *   - LLM: CUSTOMER_CLIENT_V1 → routes to /api/ava/chat-stream
 *
 * With CUSTOMER_CLIENT_V1:
 *   - Anam captures mic audio, transcribes via its built-in Deepgram
 *   - Sends transcript to /api/ava/chat-stream (our orchestrator bridge)
 *   - Receives response text back, speaks it via Hope voice
 *
 * When avatar is NOT connected (voice-only mode):
 *   - useDeepgramSTT captures mic audio directly
 *   - Routes through /api/orchestrator/intent
 *   - speakText() plays response via ElevenLabs TTS
 *
 * Flow (avatar mode):
 *   1. Fetch session token from server (POST /api/anam/session)
 *   2. Create client with CUSTOMER_CLIENT_V1 brain config
 *   3. Stream Cara avatar to <video> element
 *   4. User speaks → Anam STT → /api/ava/chat-stream → Orchestrator → response → Cara speaks (Hope voice)
 */

import { createClient, AnamEvent } from '@anam-ai/js-sdk';

export type AnamClientInstance = ReturnType<typeof createClient>;

/** Conversation message for multi-turn context */
export interface AnamMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** Options for connecting Anam avatars with event callbacks */
export interface AnamConnectOptions {
  onSessionReady?: (sessionId?: string) => void;
  onInterrupted?: () => void;
  onMessageStream?: (text: string, role: string) => void;
  onWarning?: (message: string) => void;
  onConnectionEstablished?: () => void;
  onVideoStarted?: () => void;
  onConnectionClosed?: (reason?: string, details?: string) => void;
  onUserMessage?: (message: string, messageHistory: AnamMessage[]) => void;
}

/** In-memory conversation history for the current session */
let conversationHistory: AnamMessage[] = [];

/**
 * Get the current conversation history (for debugging/display).
 */
export function getConversationHistory(): AnamMessage[] {
  return [...conversationHistory];
}

/**
 * Clear conversation history (call on session end).
 */
export function clearConversationHistory(): void {
  conversationHistory = [];
}

/**
 * Fetch a short-lived Anam session token from our server.
 * The API key never leaves the server (Law #9: secrets server-side only).
 * Now requires JWT (Law #3: Fail Closed).
 */
export async function fetchAnamSessionToken(accessToken?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const resp = await fetch('/api/anam/session', { method: 'POST', headers });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
    throw new Error(err.message || `Anam session failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (!data.sessionToken) {
    throw new Error('No session token returned from server');
  }
  return data.sessionToken;
}

/**
 * Create an Anam client configured for CUSTOMER_CLIENT_V1 brain routing.
 *
 * disableInputAudio: false — Anam captures mic, sends to its STT,
 * then routes transcript to our /api/ava/chat-stream via CUSTOMER_CLIENT_V1.
 *
 * disableBrains: false — we WANT brain routing, but to OUR brain
 * via the CUSTOMER_CLIENT_V1 llmId configured in the persona.
 */
export function createAnamClient(sessionToken: string): AnamClientInstance {
  return createClient(sessionToken, {
    disableInputAudio: false,
  });
}

// ─── SDK v4.8 Wrapper Functions ─────────────────────────────

export function interruptPersona(client: AnamClientInstance): void {
  if (client && typeof (client as any).interruptPersona === 'function') {
    (client as any).interruptPersona();
  }
}

export function sendUserMessage(client: AnamClientInstance, text: string): void {
  if (client && typeof (client as any).sendUserMessage === 'function') {
    (client as any).sendUserMessage(text);
  }
}

export function muteAnamInput(client: AnamClientInstance): void {
  if (client && typeof (client as any).muteInputAudio === 'function') {
    (client as any).muteInputAudio();
  }
}

export function unmuteAnamInput(client: AnamClientInstance): void {
  if (client && typeof (client as any).unmuteInputAudio === 'function') {
    (client as any).unmuteInputAudio();
  }
}

export function getAnamInputAudioState(client: AnamClientInstance): boolean {
  if (client && typeof (client as any).getInputAudioState === 'function') {
    return (client as any).getInputAudioState();
  }
  return false;
}

export function getActiveAnamSessionId(client: AnamClientInstance): string | null {
  if (client && typeof (client as any).getActiveSessionId === 'function') {
    return (client as any).getActiveSessionId();
  }
  return null;
}

function extractSessionId(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidate =
      (typeof obj.sessionId === 'string' && obj.sessionId) ||
      (typeof obj.session_id === 'string' && obj.session_id) ||
      (typeof obj.id === 'string' && obj.id) ||
      '';
    const trimmed = candidate.trim();
    return trimmed || null;
  }
  return null;
}

async function bindAnamSession(
  sessionId: string | null | undefined,
  accessToken: string | undefined,
  persona: 'ava' | 'finn',
): Promise<void> {
  const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!normalized || !accessToken) return;
  try {
    const resp = await fetch('/api/anam/session/bind', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId: normalized, persona }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.warn(`[Anam ${persona}] Session bind failed (${resp.status})`, detail.slice(0, 180));
    }
  } catch (error) {
    console.warn(`[Anam ${persona}] Failed to bind session context`, error);
  }
}

export function createAnamTalkStream(client: AnamClientInstance): unknown {
  if (client && typeof (client as any).createTalkMessageStream === 'function') {
    return (client as any).createTalkMessageStream();
  }
  return null;
}

export function finnTalk(client: AnamClientInstance, text: string): void {
  if (client && typeof (client as any).talk === 'function') {
    (client as any).talk(text);
  }
}

/**
 * Stream a response to the Anam avatar for speech output.
 * Uses createTalkMessageStream() for long responses (lower latency),
 * falls back to talk() for short responses or on error.
 */
export async function streamResponseToAvatar(
  client: AnamClientInstance,
  responseText: string,
): Promise<void> {
  if (!client || !responseText?.trim()) return;

  // Short responses: use simple talk()
  if (responseText.length < 200) {
    if (typeof (client as any).talk === 'function') {
      (client as any).talk(responseText);
    }
    return;
  }

  // Longer responses: stream for lower latency
  const talkStream = createAnamTalkStream(client);
  if (!talkStream || typeof (talkStream as any).streamMessageChunk !== 'function') {
    // Fallback to talk()
    if (typeof (client as any).talk === 'function') {
      (client as any).talk(responseText);
    }
    return;
  }

  try {
    // Split into sentence chunks for natural speech pacing
    const chunks = responseText.match(/[^.!?]+[.!?]+\s*/g) || [responseText];
    for (let i = 0; i < chunks.length; i++) {
      if (typeof (talkStream as any).isActive === 'function' && (talkStream as any).isActive()) {
        await (talkStream as any).streamMessageChunk(chunks[i], i === chunks.length - 1);
      }
    }
    if (typeof (talkStream as any).endMessage === 'function') {
      (talkStream as any).endMessage();
    }
  } catch (err) {
    console.warn('[Anam] Talk stream error, falling back:', err);
    if (typeof (client as any).talk === 'function') {
      (client as any).talk(responseText);
    }
  }
}

// ─── Event Listener Setup ─────────────────────────────────

/**
 * Set up ALL Anam SDK event listeners using AnamEvent enum.
 * Replaces the old setupMessageHistoryListener with comprehensive event coverage.
 */
export function setupAllEventListeners(
  client: AnamClientInstance,
  historyTarget: 'ava' | 'finn',
  options?: AnamConnectOptions,
): void {
  // Message history — detect new user messages and forward to orchestrator via callback
  client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, (event: any) => {
    const msgArray = event?.messages || (Array.isArray(event) ? event : null);
    if (msgArray && Array.isArray(msgArray)) {
      const mapped: AnamMessage[] = msgArray.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
        timestamp: msg.timestamp || Date.now(),
      }));
      if (historyTarget === 'ava') {
        conversationHistory = mapped;
      } else {
        finnConversationHistory = mapped;
      }

      // Detect new user message and forward to orchestrator via callback
      const last = mapped[mapped.length - 1];
      if (last?.role === 'user' && last.content?.trim()) {
        options?.onUserMessage?.(last.content, mapped);
      }
    }
  });

  // Connection events
  client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
    console.log(`[Anam ${historyTarget}] Connection established`);
    options?.onConnectionEstablished?.();
  });

  client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
    console.log(`[Anam ${historyTarget}] Video play started`);
    options?.onVideoStarted?.();
  });

  client.addListener(AnamEvent.CONNECTION_CLOSED, (reason: unknown, details: unknown) => {
    const reasonText = typeof reason === 'string' ? reason : undefined;
    const detailsText = typeof details === 'string' ? details : undefined;
    console.log(`[Anam ${historyTarget}] Connection closed`, reasonText ? { reason: reasonText } : undefined);
    options?.onConnectionClosed?.(reasonText, detailsText);
  });

  // Session ready
  client.addListener(AnamEvent.SESSION_READY, (event: any) => {
    const sessionId = extractSessionId(event);
    console.log(`[Anam ${historyTarget}] Session ready`, sessionId ? { sessionId } : undefined);
    options?.onSessionReady?.(sessionId ?? undefined);
  });

  // Message streaming
  client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: any) => {
    if (event?.content) {
      options?.onMessageStream?.(event.content, event.role || 'assistant');
    }
  });

  // Interruption
  client.addListener(AnamEvent.TALK_STREAM_INTERRUPTED, () => {
    console.log(`[Anam ${historyTarget}] Talk stream interrupted`);
    options?.onInterrupted?.();
  });

  // Audio events
  client.addListener(AnamEvent.INPUT_AUDIO_STREAM_STARTED, () => {
    console.log(`[Anam ${historyTarget}] Input audio stream started`);
  });

  client.addListener(AnamEvent.AUDIO_STREAM_STARTED, () => {
    console.log(`[Anam ${historyTarget}] Audio stream started`);
  });

  // Warnings
  client.addListener(AnamEvent.SERVER_WARNING, (event: any) => {
    const msg = event?.message || 'Unknown warning';
    console.warn(`[Anam ${historyTarget}] Server warning: ${msg}`);
    options?.onWarning?.(msg);
  });
}

/**
 * Full connect flow: fetch token → create client → setup listeners → stream to video.
 * Returns the client instance for subsequent talk() calls.
 */
export async function connectAnamAvatar(
  videoElementId: string,
  accessToken?: string,
  options?: AnamConnectOptions,
): Promise<AnamClientInstance> {
  // DOM validation — fail fast with actionable message
  if (typeof document !== 'undefined') {
    const el = document.getElementById(videoElementId);
    if (!el) {
      throw new Error(`Video element #${videoElementId} not found in DOM. Ensure the <video> tag is rendered before connecting.`);
    }
  }

  clearConversationHistory();
  const sessionToken = await fetchAnamSessionToken(accessToken);
  const client = createAnamClient(sessionToken);
  const boundSessionIds = new Set<string>();
  const bindIfNeeded = async (sessionId: string | null | undefined) => {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized || boundSessionIds.has(normalized)) return;
    boundSessionIds.add(normalized);
    await bindAnamSession(normalized, accessToken, 'ava');
  };

  setupAllEventListeners(client, 'ava', {
    ...options,
    onSessionReady: async (sessionId?: string) => {
      await bindIfNeeded(sessionId);
      options?.onSessionReady?.(sessionId);
    },
  });

  try {
    await client.streamToVideoElement(videoElementId);
    await bindIfNeeded(getActiveAnamSessionId(client));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Anam stream failed for #${videoElementId}: ${msg}`);
  }
  return client;
}

// ─── Finn Avatar Configuration ─────────────────────────────

export const FINN_PERSONA = {
  avatarId: '45ddc55c-14a9-4b25-8e28-f6c1ce39ccc5',
  voiceId: '7db5f408-833c-49ce-97aa-eaec17077a4c',
} as const;

/** Finn conversation history (separate from Ava) */
let finnConversationHistory: AnamMessage[] = [];

export function getFinnConversationHistory(): AnamMessage[] {
  return [...finnConversationHistory];
}

export function clearFinnConversationHistory(): void {
  finnConversationHistory = [];
}

/**
 * Fetch Finn-specific Anam session token.
 * Uses the same server endpoint but passes Finn persona params.
 */
export async function fetchFinnSessionToken(accessToken?: string): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const resp = await fetch('/api/anam/session', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      persona: 'finn',
      avatarId: FINN_PERSONA.avatarId,
      voiceId: FINN_PERSONA.voiceId,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
    throw new Error(err.message || `Finn Anam session failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (!data.sessionToken) {
    throw new Error('No session token returned for Finn');
  }
  return data.sessionToken;
}

/**
 * Full connect flow for Finn avatar: fetch token → create client → setup listeners → stream.
 */
export async function connectFinnAvatar(
  videoElementId: string,
  accessToken?: string,
  options?: AnamConnectOptions,
): Promise<AnamClientInstance> {
  // DOM validation — fail fast with actionable message
  if (typeof document !== 'undefined') {
    const el = document.getElementById(videoElementId);
    if (!el) {
      throw new Error(`Video element #${videoElementId} not found in DOM. Ensure the <video> tag is rendered before connecting.`);
    }
  }

  clearFinnConversationHistory();
  const sessionToken = await fetchFinnSessionToken(accessToken);
  const client = createAnamClient(sessionToken);
  const boundSessionIds = new Set<string>();
  const bindIfNeeded = async (sessionId: string | null | undefined) => {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized || boundSessionIds.has(normalized)) return;
    boundSessionIds.add(normalized);
    await bindAnamSession(normalized, accessToken, 'finn');
  };

  setupAllEventListeners(client, 'finn', {
    ...options,
    onSessionReady: async (sessionId?: string) => {
      await bindIfNeeded(sessionId);
      options?.onSessionReady?.(sessionId);
    },
  });

  try {
    await client.streamToVideoElement(videoElementId);
    await bindIfNeeded(getActiveAnamSessionId(client));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Anam stream failed for #${videoElementId}: ${msg}`);
  }
  return client;
}
