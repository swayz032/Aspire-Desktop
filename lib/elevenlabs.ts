/**
 * ElevenLabs Voice Configuration — STT + TTS
 *
 * ElevenLabs provides both speech-to-text (Scribe) and text-to-speech for Aspire agents.
 * It is NOT the agent brain — all intelligence comes from the
 * LangGraph orchestrator via OpenAI SDK skill packs (Law #1: Single Brain).
 *
 * Flow: User speaks → ElevenLabs STT (Scribe) → Orchestrator → Skill Pack → response text → ElevenLabs TTS → User hears
 * Exception: Nora uses Deepgram STT (conference transcription via LiveKit)
 */

export interface VoiceConfig {
  /** Agent display name */
  name: string;
  /** ElevenLabs Voice ID for TTS output */
  voiceId: string;
  /** Voice model to use */
  model: string;
}

/**
 * Voice IDs are fixed per-agent. These map to specific ElevenLabs voices.
 * NO agent IDs — ElevenLabs is TTS only, not a conversational agent.
 */
export const AGENT_VOICES: Record<string, VoiceConfig> = {
  ava: {
    name: 'Ava',
    voiceId: 'uYXf8XasLslADfZ2MB4u',
    model: 'eleven_turbo_v2_5',
  },
  eli: {
    name: 'Eli',
    voiceId: 'c6kFzbpMaJ8UMD5P6l72',
    model: 'eleven_turbo_v2_5',
  },
  finn: {
    name: 'Finn',
    voiceId: 's3TPKV1kjDlVtZbl4Ksh',
    model: 'eleven_turbo_v2_5',
  },
  nora: {
    name: 'Nora',
    voiceId: '6aDn1KB0hjpdcocrUkmq',
    model: 'eleven_turbo_v2_5',
  },
  sarah: {
    name: 'Sarah',
    voiceId: 'DODLEQrClDo8wCz460ld',
    model: 'eleven_turbo_v2_5',
  },
};

export type AgentName = keyof typeof AGENT_VOICES;

/**
 * Get the voice ID for a given agent.
 */
export function getVoiceId(agent: AgentName): string {
  const config = AGENT_VOICES[agent];
  if (!config) throw new Error(`Unknown agent: ${agent}`);
  return config.voiceId;
}

/**
 * Get full voice config for a given agent.
 */
export function getVoiceConfig(agent: AgentName): VoiceConfig {
  const config = AGENT_VOICES[agent];
  if (!config) throw new Error(`Unknown agent: ${agent}`);
  return config;
}

/**
 * Speak text using ElevenLabs TTS via server-side proxy.
 * Returns an audio blob that can be played in the browser.
 *
 * The server route handles the ElevenLabs API key — client never touches secrets.
 */
export async function speakText(
  agent: AgentName,
  text: string,
): Promise<Blob | null> {
  try {
    const resp = await fetch('/api/elevenlabs/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        text,
        voiceId: getVoiceId(agent),
      }),
    });
    if (!resp.ok) {
      console.error(`[TTS] ElevenLabs returned ${resp.status} for agent "${agent}"`);
      return null;
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('audio/')) {
      console.error('[TTS] Server returned non-audio content-type:', contentType);
      return null;
    }
    return await resp.blob();
  } catch (err) {
    console.error('[TTS] ElevenLabs request failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Stream TTS audio using ElevenLabs streaming endpoint via server proxy.
 * Returns a ReadableStream for low-latency playback.
 */
export async function streamSpeak(
  agent: AgentName,
  text: string,
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const resp = await fetch('/api/elevenlabs/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        text,
        voiceId: getVoiceId(agent),
      }),
    });
    if (!resp.ok || !resp.body) return null;
    return resp.body;
  } catch {
    return null;
  }
}
