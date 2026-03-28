/**
 * ElevenLabs Conversational AI Agent Configuration
 *
 * Maps Aspire agent names to ElevenLabs Agent IDs for the Conversational AI platform.
 * Agent IDs are configured per-environment via EXPO_PUBLIC_ env vars (client-safe).
 *
 * This is SEPARATE from lib/elevenlabs.ts which handles TTS-only voice config.
 * The agent platform replaces the full STT -> Orchestrator -> TTS pipeline with
 * a single managed conversation session.
 *
 * Law #9: API keys stay server-side — only agent IDs (public) are on the client.
 */

import type { AgentName } from './elevenlabs';

/** Feature flag: ElevenLabs voice agent sessions (STT + TTS). */
export const USE_ELEVENLABS_AGENTS =
  process.env.EXPO_PUBLIC_USE_ELEVENLABS_AGENTS === 'true';

/**
 * ElevenLabs Agent IDs (public, safe for client).
 * These map to agents configured in the ElevenLabs dashboard.
 */
export const ELEVENLABS_AGENTS: Record<AgentName, string> = {
  ava: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_AVA || '',
  eli: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ELI || '',
  finn: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_FINN || '',
  nora: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_NORA || '',
  sarah: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_SARAH || '',
};

/**
 * Returns current time of day for personalized greetings.
 * Used as a dynamic variable in agent sessions.
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Validates that an agent ID is configured for the given agent name.
 * Law #3: Fail closed — missing agent ID = deny.
 */
export function getAgentId(agent: AgentName): string | null {
  const id = ELEVENLABS_AGENTS[agent];
  if (!id) return null;
  return id;
}
