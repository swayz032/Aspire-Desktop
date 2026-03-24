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

import { devError } from '@/lib/devLog';
import { Sentry } from '@/lib/sentry';

export interface VoiceConfig {
  /** Agent display name */
  name: string;
  /** ElevenLabs Voice ID for TTS output */
  voiceId: string;
  /** Voice model to use */
  model: string;
  /** Optional voice tuning for more natural delivery */
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
}

/**
 * Voice IDs are fixed per-agent. These map to specific ElevenLabs voices.
 * NO agent IDs — ElevenLabs is TTS only, not a conversational agent.
 */
export const AGENT_VOICES: Record<string, VoiceConfig> = {
  ava: {
    name: 'Ava',
    voiceId: 'uYXf8XasLslADfZ2MB4u',
    model: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.55,          // Higher = clearer pronunciation, more consistent delivery
      similarity_boost: 0.88,
      style: 0.12,              // Lower = less dramatic, steadier pacing
      use_speaker_boost: true,
      speed: 0.94,              // Slightly slower for clarity — natural CEO briefing pace
    },
  },
  eli: {
    name: 'Eli',
    voiceId: 'c6kFzbpMaJ8UMD5P6l72',
    model: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.36,
      similarity_boost: 0.92,
      style: 0.22,
      use_speaker_boost: true,
      speed: 1.0,
    },
  },
  finn: {
    name: 'Finn',
    voiceId: 's3TPKV1kjDlVtZbl4Ksh',
    model: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.44,
      similarity_boost: 0.9,
      style: 0.16,
      use_speaker_boost: true,
      speed: 1.0,
    },
  },
  nora: {
    name: 'Nora',
    voiceId: '6aDn1KB0hjpdcocrUkmq',
    model: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.4,
      similarity_boost: 0.9,
      style: 0.18,
      use_speaker_boost: true,
      speed: 1.0,
    },
  },
  sarah: {
    name: 'Sarah',
    voiceId: 'DODLEQrClDo8wCz460ld',
    model: 'eleven_flash_v2_5',
    voiceSettings: {
      stability: 0.46,
      similarity_boost: 0.86,
      style: 0.14,
      use_speaker_boost: true,
      speed: 1.0,
    },
  },
};

import { reportProviderError } from '@/lib/providerErrorReporter';

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
  accessToken?: string,
  traceId?: string,
): Promise<Blob | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (traceId) {
      headers['X-Trace-Id'] = traceId;
      headers['X-Correlation-Id'] = traceId;
    }
    const config = getVoiceConfig(agent);
    const resp = await fetch('/api/elevenlabs/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent,
        text,
        voiceId: config.voiceId,
        model: config.model,
        voiceSettings: config.voiceSettings,
      }),
    });
    if (!resp.ok) {
      devError(`[TTS] ElevenLabs returned ${resp.status} for agent "${agent}"`);
      reportProviderError({ provider: 'elevenlabs', action: 'tts', error: new Error(`HTTP ${resp.status} for agent "${agent}"`), component: 'speakText' });
      Sentry.captureException(new Error(`ElevenLabs TTS HTTP ${resp.status} for ${agent}`), {
        tags: { voice_agent: agent, voice_stage: 'tts', provider: 'elevenlabs' },
      });
      return null;
    }
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('audio/')) {
      devError('[TTS] Server returned non-audio content-type:', contentType);
      reportProviderError({ provider: 'elevenlabs', action: 'tts_content_type', error: new Error(`Non-audio content-type: ${contentType}`), component: 'speakText' });
      return null;
    }
    return await resp.blob();
  } catch (err) {
    devError('[TTS] ElevenLabs request failed:', err instanceof Error ? err.message : err);
    reportProviderError({ provider: 'elevenlabs', action: 'tts', error: err, component: 'speakText' });
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { voice_agent: agent, voice_stage: 'tts', provider: 'elevenlabs', voice_code: 'TTS_REQUEST_FAILED' },
    });
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
  accessToken?: string,
  traceId?: string,
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (traceId) {
      headers['X-Trace-Id'] = traceId;
      headers['X-Correlation-Id'] = traceId;
    }
    const config = getVoiceConfig(agent);
    const resp = await fetch('/api/elevenlabs/tts/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agent,
        text,
        voiceId: config.voiceId,
        model: config.model,
        voiceSettings: config.voiceSettings,
      }),
    });
    if (!resp.ok || !resp.body) {
      reportProviderError({ provider: 'elevenlabs', action: 'tts_stream', error: new Error(`HTTP ${resp.status}`), component: 'streamSpeak' });
      Sentry.captureException(new Error(`ElevenLabs stream TTS HTTP ${resp.status} for ${agent}`), {
        tags: { voice_agent: agent, voice_stage: 'tts', provider: 'elevenlabs', voice_code: 'TTS_STREAM_HTTP_FAIL' },
      });
      return null;
    }
    return resp.body;
  } catch (err) {
    reportProviderError({ provider: 'elevenlabs', action: 'tts_stream', error: err, component: 'streamSpeak' });
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { voice_agent: agent, voice_stage: 'tts', provider: 'elevenlabs', voice_code: 'TTS_STREAM_FAILED' },
    });
    return null;
  }
}
