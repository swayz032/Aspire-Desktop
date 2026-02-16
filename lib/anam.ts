/**
 * Anam Avatar SDK Integration
 *
 * Aspire uses Anam for visual avatar rendering (Cara) + voice output (Emma).
 * The LLM brain is 100% Aspire's own orchestrator (GPT-5 via LangGraph).
 * `disableBrains: true` ensures Anam never makes autonomous decisions (Law #1).
 *
 * Flow:
 *   1. Fetch session token from server (POST /api/anam/session)
 *   2. Create client with disableBrains: true
 *   3. Stream Cara avatar to <video> element
 *   4. Orchestrator response text → anamClient.talk() → Cara speaks with Emma voice
 */

import { createClient } from '@anam-ai/js-sdk';

export type AnamClientInstance = ReturnType<typeof createClient>;

/**
 * Fetch a short-lived Anam session token from our server.
 * The API key never leaves the server (Law #9: secrets server-side only).
 */
export async function fetchAnamSessionToken(): Promise<string> {
  const resp = await fetch('/api/anam/session', { method: 'POST' });
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
 * Create an Anam client with brains disabled.
 * Cara avatar + Emma voice — visual/audio only, no Anam LLM.
 */
export function createAnamClient(sessionToken: string): AnamClientInstance {
  return createClient(sessionToken, {
    disableBrains: true,
  });
}

/**
 * Full connect flow: fetch token → create client → stream to video element.
 * Returns the client instance for subsequent talk() calls.
 */
export async function connectAnamAvatar(videoElementId: string): Promise<AnamClientInstance> {
  const sessionToken = await fetchAnamSessionToken();
  const client = createAnamClient(sessionToken);
  await client.streamToVideoElement(videoElementId);
  return client;
}
