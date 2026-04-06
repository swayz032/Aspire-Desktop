/**
 * useVoice -- Feature-flagged voice hook barrel export.
 *
 * When EXPO_PUBLIC_USE_ELEVENLABS_AGENTS=true, delegates to useElevenLabsAgent
 * (ElevenLabs Conversational AI native agents) wrapped in an adapter that
 * matches the useAgentVoice return interface.
 *
 * Otherwise uses the existing useAgentVoice (orchestrator-routed STT -> LangGraph -> TTS).
 *
 * This barrel exists so all consumers import from one place and the switch
 * is atomic -- flip the env var to roll back instantly.
 *
 * Law #1: Both paths ultimately route through orchestrator for decisions.
 * Law #3: Fail closed -- if the new hook isn't available, fall back to legacy.
 */

// Re-export types so consumers don't need a separate import
export type { VoiceStatus, VoiceDiagnosticEvent } from '@/hooks/useAgentVoice';

import { useAgentVoice } from '@/hooks/useAgentVoice';
import type { VoiceStatus } from '@/hooks/useAgentVoice';

/**
 * Feature flag: set EXPO_PUBLIC_USE_ELEVENLABS_AGENTS=true in .env to
 * switch all voice consumers to the new ElevenLabs agent hook.
 *
 * Evaluated once at module load -- requires app restart to change.
 */
const USE_ELEVENLABS_AGENTS = process.env.EXPO_PUBLIC_USE_ELEVENLABS_AGENTS === 'true';

/**
 * Attempt to import useElevenLabsAgent. If the module doesn't exist yet
 * (Pass 2A hasn't landed), fall back to useAgentVoice regardless of flag.
 */
type ElevenLabsHookFn = (options: {
  agent: string;
  suiteId?: string;
  userId?: string;
  accessToken?: string;
  userProfile?: Record<string, unknown>;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: Error) => void;
}) => {
  status: VoiceStatus;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  transcript: string;
  lastResponse: string;
  sendTextMessage: (text: string) => void;
  sendContextualUpdate: (text: string) => void;
  isSessionActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  canSendFeedback: boolean;
  sendFeedback: (like: boolean) => void;
};

let elevenLabsHook: ElevenLabsHookFn | null = null;
if (USE_ELEVENLABS_AGENTS) {
  try {
    // Dynamic require so build doesn't fail if file doesn't exist yet
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@/hooks/useElevenLabsAgent');
    elevenLabsHook = mod.useElevenLabsAgent ?? null;
  } catch {
    // Pass 2A hasn't landed yet -- fall back silently
    elevenLabsHook = null;
  }
}

/**
 * Common return shape that all consumers depend on.
 * Matches UseAgentVoiceReturn so existing code doesn't break.
 */
interface UseVoiceReturn {
  status: VoiceStatus;
  isActive: boolean;
  transcript: string;
  interimTranscript: string;
  lastResponse: string;
  lastReceiptId: string | null;
  startSession: () => Promise<void>;
  endSession: () => void;
  sendText: (text: string, options?: { silent?: boolean }) => Promise<void>;
  setMuted: (muted: boolean) => void;
  replayLastAudio: () => Promise<boolean>;
}

/**
 * Unified voice hook. Drop-in replacement for useAgentVoice.
 *
 * When the ElevenLabs agent flag is active AND the hook module exists,
 * this delegates to useElevenLabsAgent and adapts the return value to
 * match the UseAgentVoiceReturn contract. Otherwise it uses useAgentVoice.
 *
 * Note: The flag is a module-level constant, not a runtime branch, so
 * React's rules of hooks are satisfied -- only one hook path runs per build.
 */
export function useVoice(options: Parameters<typeof useAgentVoice>[0]): UseVoiceReturn {
  if (USE_ELEVENLABS_AGENTS && elevenLabsHook) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Flag is a module-level constant, not a runtime condition
    return useElevenLabsAgentAdapter(options);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Flag is a module-level constant, not a runtime condition
  return useAgentVoice(options);
}

/**
 * Adapter that wraps useElevenLabsAgent to match UseAgentVoiceReturn.
 *
 * Fills in missing properties with safe defaults:
 * - isActive: derived from status !== 'idle' && status !== 'error'
 * - interimTranscript: alias for transcript (ElevenLabs doesn't distinguish)
 * - lastReceiptId: null (agent manages receipts server-side)
 * - sendText: no-op (agent handles all interaction via voice)
 * - replayLastAudio: no-op (agent handles audio playback internally)
 * - endSession: wrapped to return void (matches old interface)
 */
function useElevenLabsAgentAdapter(options: Parameters<typeof useAgentVoice>[0]): UseVoiceReturn {
  // Extract only the fields that useElevenLabsAgent accepts
  const result = elevenLabsHook!({
    agent: options.agent,
    suiteId: options.suiteId,
    userId: options.userId,
    accessToken: options.accessToken,
    userProfile: options.userProfile,
    onTranscript: options.onTranscript,
    onResponse: options.onResponse ? (text: string) => options.onResponse!(text) : undefined,
    onStatusChange: options.onStatusChange,
    onError: options.onError,
    onShowCards: (options as any).onShowCards,
  });

  const isActive = result.status !== 'idle' && result.status !== 'error';

  return {
    status: result.status,
    isActive,
    transcript: result.transcript,
    interimTranscript: result.transcript,
    lastResponse: result.lastResponse,
    lastReceiptId: null,
    startSession: result.startSession,
    endSession: () => { result.endSession(); },
    sendText: async (text: string) => { result.sendTextMessage(text); },
    setMuted: result.setMuted,
    replayLastAudio: async () => false,
  };
}
