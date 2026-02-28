/**
 * Anam Avatar SDK Integration
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

import { createClient } from '@anam-ai/js-sdk';

export type AnamClientInstance = ReturnType<typeof createClient>;

/** Conversation message for multi-turn context */
export interface AnamMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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

/**
 * Set up MESSAGE_HISTORY_UPDATED listener for conversation continuity.
 * Stores messages so the orchestrator has full context for multi-turn reasoning.
 */
export function setupMessageHistoryListener(client: AnamClientInstance): void {
  try {
    // Listen for message history updates from Anam SDK
    client.addListener('MESSAGE_HISTORY_UPDATED' as any, (event: any) => {
      if (event?.messages && Array.isArray(event.messages)) {
        conversationHistory = event.messages.map((msg: any) => ({
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp || Date.now(),
        }));
      }
    });
  } catch {
    // SDK version may not support this event — degrade gracefully
    console.warn('Anam MESSAGE_HISTORY_UPDATED listener not available');
  }
}

/**
 * Full connect flow: fetch token → create client → setup listeners → stream to video.
 * Returns the client instance for subsequent talk() calls.
 */
export async function connectAnamAvatar(
  videoElementId: string,
  accessToken?: string,
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
  setupMessageHistoryListener(client);

  try {
    await client.streamToVideoElement(videoElementId);
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
 * Set up MESSAGE_HISTORY_UPDATED listener for Finn's conversation.
 */
export function setupFinnMessageHistoryListener(client: AnamClientInstance): void {
  try {
    client.addListener('MESSAGE_HISTORY_UPDATED' as any, (event: any) => {
      if (event?.messages && Array.isArray(event.messages)) {
        finnConversationHistory = event.messages.map((msg: any) => ({
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp || Date.now(),
        }));
      }
    });
  } catch {
    console.warn('Anam MESSAGE_HISTORY_UPDATED listener not available for Finn');
  }
}

/**
 * Full connect flow for Finn avatar: fetch token → create client → setup listeners → stream.
 */
export async function connectFinnAvatar(
  videoElementId: string,
  accessToken?: string,
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
  setupFinnMessageHistoryListener(client);

  try {
    await client.streamToVideoElement(videoElementId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Anam stream failed for #${videoElementId}: ${msg}`);
  }
  return client;
}
