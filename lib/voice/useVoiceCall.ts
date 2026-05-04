/**
 * useVoiceCall — Twilio Voice SDK wrapper for the Call Room.
 *
 * Owns the lifecycle of a single outbound call:
 *
 *   token + destination ─► Device.register() ─► device.connect({To}) ─► Call
 *                          (cleanup on unmount or hangup)
 *
 * Exposes a small reactive surface the Call Room components can consume:
 *
 *   { status, error, isMuted, audioLevel, durationMs, hangup, mute, sendDigits, hold, transfer }
 *
 * Status state machine:
 *   idle → dialing → ringing → connected → on_hold ↔ connected → ended
 *                                                              → error
 *
 * v1 scope cuts (per plan §9):
 *   - hold = mute outgoing audio. TwiML <Play> hold music ships v1.1.
 *   - transfer = hangup current call + redial chosen contact. Server-side
 *     participant_modify ships v1.1.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceCallStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'on_hold'
  | 'ended'
  | 'error';

export interface VoiceCallState {
  status: VoiceCallStatus;
  error: string | null;
  isMuted: boolean;
  /** Outgoing audio level 0..1, sampled from Call.on('volume'). Drives avatar pulse. */
  audioLevel: number;
  /** ms since the call connected (0 when not connected). */
  durationMs: number;
}

export interface VoiceCallControls {
  hangup: () => void;
  mute: (next?: boolean) => void;
  sendDigits: (digits: string) => void;
  hold: () => void;
  transfer: (toE164: string) => Promise<void>;
}

export type UseVoiceCallReturn = VoiceCallState & VoiceCallControls;

export interface UseVoiceCallOptions {
  /** JWT from `/api/twilio/voice-token`. Required to connect. */
  token: string | null;
  /** E.164 destination for the outbound call. Required to connect. */
  destination: string | null;
  /**
   * Optional callback fired when the call enters the 'ended' or 'error'
   * state — useful for navigating away from the Call Room.
   */
  onEnd?: (reason: 'completed' | 'error' | 'cancelled') => void;
}

const DEFAULT_STATE: VoiceCallState = {
  status: 'idle',
  error: null,
  isMuted: false,
  audioLevel: 0,
  durationMs: 0,
};

/**
 * The Twilio SDK is web-only. On native we render a fallback that
 * the Call Room can detect via `status === 'error'` + a clear error.
 */
function isWebRuntime(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/**
 * Twilio Voice SDK loader.
 *
 * We CANNOT use `import('@twilio/voice-sdk')` here. The 2.x package ships
 * an ES5 CommonJS build that does `exports.default = X` against `exports`,
 * which Metro/Expo's bundler hands us as a frozen ESM namespace object.
 * Result: `TypeError: Cannot set property default of #<Object> which has
 * only a getter` — fatal, every call attempt.
 *
 * Workaround: load Twilio's pre-bundled UMD `dist/twilio.min.js` via a
 * <script> tag at runtime. The UMD wrapper attaches `Twilio` (with
 * `Device`, `Call`, etc.) onto `window`, sidestepping the bundler entirely.
 *
 * The CDN URL is jsdelivr's mirror of the npm package — same hash, same
 * code, served with long-lived cache headers.
 */
const TWILIO_SDK_CDN =
  'https://cdn.jsdelivr.net/npm/@twilio/voice-sdk@2.18.2/dist/twilio.min.js';

interface TwilioCallLike {
  on: (event: string, cb: (...args: any[]) => void) => void;
  disconnect: () => void;
  mute: (m: boolean) => void;
  isMuted?: () => boolean;
  sendDigits: (d: string) => void;
}

interface TwilioDeviceLike {
  on: (event: string, cb: (...args: any[]) => void) => void;
  register: () => Promise<void>;
  connect: (opts: { params: Record<string, string> }) => Promise<TwilioCallLike>;
  destroy?: () => void;
}

interface TwilioGlobal {
  Device: new (token: string, opts?: Record<string, unknown>) => TwilioDeviceLike;
}

let _twilioLoadPromise: Promise<TwilioGlobal> | null = null;

function loadTwilioSDK(): Promise<TwilioGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Twilio Voice SDK requires a browser.'));
  }
  const w = window as unknown as { Twilio?: TwilioGlobal };
  if (w.Twilio?.Device) {
    return Promise.resolve(w.Twilio);
  }
  if (_twilioLoadPromise) return _twilioLoadPromise;

  _twilioLoadPromise = new Promise<TwilioGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-twilio-voice-sdk]`,
    );
    const script = existing ?? document.createElement('script');
    script.async = true;
    script.dataset.twilioVoiceSdk = '1';
    script.src = TWILIO_SDK_CDN;

    const onLoad = (): void => {
      const win = window as unknown as { Twilio?: TwilioGlobal };
      if (win.Twilio?.Device) {
        resolve(win.Twilio);
      } else {
        reject(
          new Error(
            'Twilio SDK loaded but window.Twilio.Device is not available.',
          ),
        );
      }
    };
    const onError = (): void => {
      _twilioLoadPromise = null; // allow retry
      reject(new Error(`Failed to load Twilio Voice SDK from ${TWILIO_SDK_CDN}`));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      document.head.appendChild(script);
    } else if ((window as unknown as { Twilio?: TwilioGlobal }).Twilio?.Device) {
      // Existing tag already loaded the SDK (e.g. previous Call Room session)
      onLoad();
    }
  });

  return _twilioLoadPromise;
}

export function useVoiceCall(opts: UseVoiceCallOptions): UseVoiceCallReturn {
  const [state, setState] = useState<VoiceCallState>(DEFAULT_STATE);

  // Refs for SDK instances so the cleanup path can reach them without
  // triggering re-renders.
  const deviceRef = useRef<unknown>(null);
  const callRef = useRef<unknown>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndRef = useRef(opts.onEnd);
  const tokenRef = useRef(opts.token);
  const destRef = useRef(opts.destination);

  useEffect(() => {
    onEndRef.current = opts.onEnd;
  }, [opts.onEnd]);
  useEffect(() => {
    tokenRef.current = opts.token;
  }, [opts.token]);
  useEffect(() => {
    destRef.current = opts.destination;
  }, [opts.destination]);

  /** Tear down both SDK instances + the duration ticker. Idempotent. */
  const cleanup = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    const call = callRef.current as { disconnect?: () => void } | null;
    if (call?.disconnect) {
      try {
        call.disconnect();
      } catch {
        /* swallow — already disconnected */
      }
    }
    callRef.current = null;
    const device = deviceRef.current as { destroy?: () => void } | null;
    if (device?.destroy) {
      try {
        device.destroy();
      } catch {
        /* swallow */
      }
    }
    deviceRef.current = null;
    startedAtRef.current = null;
  }, []);

  // Bootstrap the Device + place the call when token + destination arrive.
  useEffect(() => {
    if (!opts.token || !opts.destination) return;
    if (!isWebRuntime()) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: 'In-browser calling is web-only in v1.',
      }));
      return;
    }

    let cancelled = false;
    setState({ ...DEFAULT_STATE, status: 'dialing' });

    (async () => {
      try {
        // Load the SDK via <script> tag — see loadTwilioSDK() comment for why
        // dynamic import('@twilio/voice-sdk') breaks under Metro/Expo.
        // eslint-disable-next-line no-console
        console.info('[useVoiceCall] loading Twilio Voice SDK from CDN...');
        const Twilio = await loadTwilioSDK();
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.info('[useVoiceCall] SDK loaded, instantiating Device');
        const Device = Twilio.Device;
        const device = new Device(opts.token!, {
          // Closer = fewer dropped packets on retried PSTN segments.
          closeProtection: true,
          // Disable Twilio's incoming-call ringer — we're outbound-only.
          // (Plus the agent identity has incoming_allow=false on the JWT.)
        });
        deviceRef.current = device;

        // Surface SDK-level errors as 'error' status so the UI can recover.
        device.on('error', (err: { message?: string; code?: number }) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.error('[useVoiceCall] Device error', err);
          setState((s) => ({
            ...s,
            status: 'error',
            error: err?.message || `Voice SDK error ${err?.code ?? ''}`.trim(),
          }));
          // Do NOT auto-navigate away on Device errors — the UI surfaces the
          // error and lets the user retry. Auto-navigation hid the failure
          // mode from us in v0.
        });

        // Register with Twilio so the SDK is reachable. Outbound calls
        // technically work without register() in newer SDKs, but doing it
        // unblocks future incoming events without a re-init.
        // eslint-disable-next-line no-console
        console.info('[useVoiceCall] device.register()...');
        await device.register();
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.info('[useVoiceCall] registered, connecting to', opts.destination);

        const call = await device.connect({ params: { To: opts.destination! } });
        callRef.current = call;
        // eslint-disable-next-line no-console
        console.info('[useVoiceCall] device.connect() returned a Call');

        // Status transitions — Twilio's Call emits these in order.
        call.on('ringing', () => {
          if (cancelled) return;
          setState((s) => ({ ...s, status: 'ringing' }));
        });
        call.on('accept', () => {
          if (cancelled) return;
          startedAtRef.current = Date.now();
          // Start a 250ms ticker for duration display. Cheap; no animation.
          if (tickerRef.current) clearInterval(tickerRef.current);
          tickerRef.current = setInterval(() => {
            const startedAt = startedAtRef.current;
            if (!startedAt) return;
            setState((s) => ({ ...s, durationMs: Date.now() - startedAt }));
          }, 250);
          setState((s) => ({ ...s, status: 'connected', error: null }));
        });
        call.on('volume', (_inputVol: number, outputVol: number) => {
          if (cancelled) return;
          setState((s) => ({ ...s, audioLevel: Math.max(0, Math.min(1, outputVol)) }));
        });
        call.on('mute', (isMuted: boolean) => {
          if (cancelled) return;
          setState((s) => ({ ...s, isMuted }));
        });
        call.on('disconnect', () => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.info('[useVoiceCall] Call disconnect');
          setState((s) => ({ ...s, status: 'ended', audioLevel: 0 }));
          onEndRef.current?.('completed');
          cleanup();
        });
        call.on('cancel', () => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.warn('[useVoiceCall] Call cancel — never reached the destination');
          setState((s) => ({ ...s, status: 'ended' }));
          onEndRef.current?.('cancelled');
          cleanup();
        });
        call.on('error', (err: { message?: string; code?: number }) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.error('[useVoiceCall] Call error', err);
          setState((s) => ({
            ...s,
            status: 'error',
            error: err?.message || `Call error ${err?.code ?? ''}`.trim(),
          }));
          // Do NOT auto-navigate — surface the error.
        });
      } catch (err: unknown) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[useVoiceCall] setup failed', err);
        const msg = err instanceof Error ? err.message : 'Call setup failed.';
        setState((s) => ({ ...s, status: 'error', error: msg }));
        // Do NOT auto-navigate — surface the error so we can debug.
        cleanup();
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // We deliberately re-init when token OR destination flips. Tokens are
    // short-lived; if a refresh lands mid-call we want the next call to
    // use the fresh one. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.token, opts.destination, cleanup]);

  // ---- Controls --------------------------------------------------------

  const hangup = useCallback(() => {
    const call = callRef.current as { disconnect?: () => void } | null;
    if (call?.disconnect) {
      try {
        call.disconnect();
      } catch {
        /* swallow */
      }
    } else {
      // No active call — just transition to ended so the UI can navigate.
      setState((s) => ({ ...s, status: 'ended' }));
      onEndRef.current?.('cancelled');
      cleanup();
    }
  }, [cleanup]);

  const mute = useCallback((next?: boolean) => {
    const call = callRef.current as { mute?: (m: boolean) => void; isMuted?: () => boolean } | null;
    if (!call?.mute) return;
    const target = typeof next === 'boolean' ? next : !(call.isMuted?.() ?? false);
    try {
      call.mute(target);
      // Twilio fires 'mute' event which updates state; defensively also set here.
      setState((s) => ({ ...s, isMuted: target }));
    } catch {
      /* swallow */
    }
  }, []);

  const sendDigits = useCallback((digits: string) => {
    const call = callRef.current as { sendDigits?: (d: string) => void } | null;
    if (!call?.sendDigits || !digits) return;
    try {
      call.sendDigits(digits);
    } catch {
      /* swallow */
    }
  }, []);

  /**
   * v1 hold = local mute. Real TwiML <Play> hold music ships in v1.1.
   * The status flips to 'on_hold' (cosmetic) so the Hold button stays
   * highlighted and the avatar pulse pauses.
   */
  const hold = useCallback(() => {
    const call = callRef.current as { mute?: (m: boolean) => void } | null;
    const muteFn = call?.mute;
    if (!muteFn) return;
    setState((s) => {
      const goingOnHold = s.status !== 'on_hold';
      try {
        muteFn(goingOnHold);
      } catch {
        /* swallow */
      }
      return {
        ...s,
        status: goingOnHold ? 'on_hold' : 'connected',
        isMuted: goingOnHold,
      };
    });
  }, []);

  /**
   * v1 transfer = hangup current call + immediately re-init by changing
   * the destination prop. The Call Room owns the destination; this hook
   * just signals end-of-current-call. Real warm-transfer ships v1.1.
   */
  const transfer = useCallback(async (_toE164: string) => {
    hangup();
  }, [hangup]);

  return {
    ...state,
    hangup,
    mute,
    sendDigits,
    hold,
    transfer,
  };
}
