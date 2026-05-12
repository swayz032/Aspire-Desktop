/**
 * useTiffanyVoiceSession — Front Desk Tiffany voice session hook (Pass D).
 *
 * Thin wrapper around `useElevenLabsAgent` that locks the agent to the
 * Tiffany-FrontDesk EL agent and exposes a Front-Desk-shaped state machine
 * tailored to the Front Desk Hub UI (timer, error overlay, blob playback
 * rate, end-session morph button).
 *
 * Law #1: ElevenLabs server-side agent config owns the brain. This hook is
 * a transport + UI-state shim only.
 * Law #2: Best-effort receipts on session start/end. Server route is
 * optional — failures do not block the UX.
 * Law #3: Fail closed — mic permission denied / token mint failure surface
 * as `state === 'error'` with a human-readable `errorMessage`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useElevenLabsAgent,
  type VoiceStatus,
} from '@/hooks/useElevenLabsAgent';
import { devLog, devWarn } from '@/lib/devLog';

export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'error';

export interface UseTiffanyVoiceSession {
  state: VoiceSessionState;
  start: () => Promise<void>;
  end: () => Promise<void>;
  transcript: string;
  errorMessage: string | null;
  lastReceiptId: string | null;
  /** Elapsed seconds while the session is active. Resets to 0 on idle. */
  elapsedSec: number;
}

const MIC_DENIED_MESSAGE =
  'Microphone permission denied. Allow mic access to talk to Tiffany.';
const GENERIC_ERROR_MESSAGE =
  'Voice session failed to start. Please try again.';
// Pass I P0 #7: hard cap on EL handshake. If the SDK doesn't transition
// to listening/responding within this window we fail closed (Law #3).
const START_TIMEOUT_MS = 15_000;
const START_TIMEOUT_MESSAGE =
  'Could not reach Tiffany — check your connection and try again.';

function mapVoiceStatusToSessionState(
  status: VoiceStatus,
  sessionActive: boolean,
): VoiceSessionState {
  switch (status) {
    case 'idle':
      return sessionActive ? 'connecting' : 'idle';
    case 'thinking':
      // SDK 'thinking' covers both initial connect AND mid-turn LLM
      // processing. Distinguish by `sessionActive` (false = connecting).
      return sessionActive ? 'processing' : 'connecting';
    case 'listening':
      return 'listening';
    case 'speaking':
      return 'responding';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

function generateReceiptId(): string {
  // Best-effort id. crypto.randomUUID is widely available; fall back to
  // a timestamp-based id if not.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `voice_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `voice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function emitVoiceReceipt(
  kind: 'voice_session_started' | 'voice_session_ended',
  payload: { receiptId: string; agent: 'tiffany'; durationSec?: number },
): Promise<void> {
  // Fire-and-forget. Server endpoint may not exist yet — that is OK; we
  // only need the receipt id to surface in the UI for the Verified toast.
  try {
    await fetch('/api/receipts/voice-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...payload }),
      // Don't block teardown on the network.
      keepalive: true,
    });
  } catch {
    /* swallow — best-effort */
  }
}

export function useTiffanyVoiceSession(): UseTiffanyVoiceSession {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [explicitlyConnecting, setExplicitlyConnecting] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const activeReceiptIdRef = useRef<string | null>(null);

  const agent = useElevenLabsAgent({
    agent: 'tiffany' as any,
    onError: (err) => {
      setErrorMessage(err.message || GENERIC_ERROR_MESSAGE);
    },
  });

  // Derive UX state from SDK status + our connecting flag.
  const state: VoiceSessionState = useMemo(() => {
    if (errorMessage) return 'error';
    if (explicitlyConnecting && !agent.isSessionActive) return 'connecting';
    return mapVoiceStatusToSessionState(agent.status, agent.isSessionActive);
  }, [agent.status, agent.isSessionActive, explicitlyConnecting, errorMessage]);

  // Once the SDK transitions out of idle, clear our connecting override.
  useEffect(() => {
    if (explicitlyConnecting && agent.isSessionActive) {
      setExplicitlyConnecting(false);
    }
  }, [explicitlyConnecting, agent.isSessionActive]);

  // Elapsed-seconds ticker — runs while the session is active.
  useEffect(() => {
    const isActive =
      state === 'connecting' ||
      state === 'listening' ||
      state === 'processing' ||
      state === 'responding';

    if (!isActive) {
      // Reset on idle. Keep last value momentarily for end-of-call display.
      if (state === 'idle') {
        startedAtRef.current = null;
        setElapsedSec(0);
      }
      return;
    }

    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const id = setInterval(() => {
      if (startedAtRef.current === null) return;
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setLastReceiptId(null);
    setExplicitlyConnecting(true);
    startedAtRef.current = Date.now();
    setElapsedSec(0);

    const receiptId = generateReceiptId();
    activeReceiptIdRef.current = receiptId;

    try {
      // Best-effort: pre-check mic so we can surface a friendly denied
      // message before the SDK throws an opaque error. The SDK acquires
      // its own track after this — the test track is released immediately.
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
          probe.getTracks().forEach((t) => t.stop());
        } catch (permErr: any) {
          const name = permErr?.name || '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setErrorMessage(MIC_DENIED_MESSAGE);
            setExplicitlyConnecting(false);
            startedAtRef.current = null;
            return;
          }
          // Other errors (NotFoundError etc) — surface and stop.
          setErrorMessage(
            permErr?.message ||
              'Could not access microphone. Check device settings.',
          );
          setExplicitlyConnecting(false);
          startedAtRef.current = null;
          return;
        }
      }

      // Pass I P0 #7: 15s timeout via Promise.race. If the EL handshake
      // hangs (network drop, agent mint failure, mic stuck) we fail closed
      // instead of leaving the UI parked in `connecting` indefinitely.
      const startPromise = agent.startSession();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('VOICE_SESSION_TIMEOUT'));
        }, START_TIMEOUT_MS);
      });

      try {
        await Promise.race([startPromise, timeoutPromise]);
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
      }

      // Receipt: best-effort, do not await.
      void emitVoiceReceipt('voice_session_started', {
        receiptId,
        agent: 'tiffany',
      });
      devLog('[useTiffanyVoiceSession] session started', { receiptId });
    } catch (err) {
      const isTimeout =
        err instanceof Error && err.message === 'VOICE_SESSION_TIMEOUT';
      const message = isTimeout
        ? START_TIMEOUT_MESSAGE
        : err instanceof Error
          ? err.message
          : GENERIC_ERROR_MESSAGE;
      setErrorMessage(message);
      setExplicitlyConnecting(false);
      startedAtRef.current = null;

      // Cleanup any partial session state — release mic, end SDK session if
      // it limped to a half-state. Swallow errors; we're already in fail mode.
      try {
        await agent.endSession();
      } catch {
        /* swallow */
      }

      if (isTimeout) {
        // Pass I P0 #7: fire-and-forget receipt event for the timeout so
        // ops can graph it. Server-side may need to whitelist this event
        // type — POST is keepalive so unmount doesn't drop it.
        try {
          void fetch('/api/receipts/voice-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'voice_session_timeout',
              receiptId,
              agent: 'tiffany',
              timeoutMs: START_TIMEOUT_MS,
            }),
            keepalive: true,
          });
        } catch {
          /* swallow — best-effort */
        }
      }

      devWarn('[useTiffanyVoiceSession] start failed', { message, isTimeout });
    }
  }, [agent]);

  const end = useCallback(async () => {
    setExplicitlyConnecting(false);
    const durationSec = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0;
    const receiptId = activeReceiptIdRef.current || generateReceiptId();

    try {
      await agent.endSession();
    } catch {
      /* swallow — we still want to surface the receipt */
    }

    setLastReceiptId(receiptId);
    activeReceiptIdRef.current = null;
    startedAtRef.current = null;

    void emitVoiceReceipt('voice_session_ended', {
      receiptId,
      agent: 'tiffany',
      durationSec,
    });
    devLog('[useTiffanyVoiceSession] session ended', { receiptId, durationSec });
  }, [agent]);

  return {
    state,
    start,
    end,
    transcript: agent.transcript,
    errorMessage,
    lastReceiptId,
    elapsedSec,
  };
}
