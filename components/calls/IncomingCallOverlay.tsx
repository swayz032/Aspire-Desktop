/**
 * IncomingCallOverlay — Premium phone incoming-call modal.
 *
 * REWRITE (Wave: incoming-call-premium, 2026-05-10):
 *   - Mountain sunrise hero (full-card ImageBackground) + dark gradient veil
 *     for legibility. Replaces the old 148px abstract Aspire-blue hero.
 *   - 440 -> ~440x560 footprint. Roomier vertical rhythm to fit business name,
 *     transfer source, caller history, and a progress-ring auto-decline.
 *   - Auto-decline countdown rendered as a circular SVG progress ring around
 *     the Answer button (web only — native falls back to a slim bar). Tabular
 *     numerals. Respects `prefers-reduced-motion`.
 *   - Subtle pulse on the call icon during ringing (CSS keyframes on web,
 *     `Animated.loop` on native). Disabled when reduced-motion is set.
 *   - Premium typography hierarchy:
 *       H1  — Caller display name (28pt)
 *       Sub — Business name OR "Unknown caller" (15pt, accent tint)
 *       Reason quote — italicised, when transfer note present
 *       Meta — small caps "Transferred by Tiffany" / "Direct call"
 *       Badge — "First-time caller" / "Returning - 3 prior calls"
 *   - Audio: switched from Web AudioContext sine-wave triad to the same MP3
 *     used by the video flow (`/audio/incoming-call-ringtone.mp3`). Looping
 *     HTML5 Audio with the existing autoplay-unlock dance.
 *
 * UNCHANGED:
 *   - Trigger plumbing (`useFrontdeskCalls` polling -> `triggerIncomingCall`).
 *   - Caller-ID resolver registration -> `/api/v1/calls/caller-id-lookup`.
 *   - Suppression set (call_session_id) so dismiss doesn't re-show.
 *
 * KNOWN GAP (Issue 1, requires backend changes — outside Aspire-desktop scope):
 *   The current backend `/sarah/transfer` endpoint resolves a routing contact
 *   and returns a dynamic-variable name; the actual telephony bridge is
 *   performed by ElevenLabs `transfer_to_number` -> Twilio dial. NO row is
 *   inserted into `call_sessions` with `status='ringing'`, so the polling
 *   trigger here NEVER fires for real Tiffany/Sarah transfers. Only the
 *   "Test Incoming Call" button (which calls `triggerTestIncomingCall`
 *   directly) currently exercises this overlay. See REPORT for the proposed
 *   backend diff.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFrontdeskCalls } from '@/hooks/useFrontdeskCalls';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import {
  dismissIncomingCallOverlay,
  formatPhoneNumber,
  getIncomingCallOverlayState,
  registerCallerIdResolver,
  triggerIncomingCall,
  type CallerIdResolver,
  type ResolvedCaller,
} from '@/lib/incomingCallOverlayStore';
import { subscribeIncomingCallOverlay } from '@/lib/incomingCallOverlayStore';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { devError } from '@/lib/devLog';
import { API_BASE } from '@/lib/api/officeMemory';

/* ─── Mountain sunrise hero (Vecteezy, downloaded by founder 2026-05-10) ─── */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const heroImage = require('@/assets/images/incoming-call-bg.jpg');

/* ─── Auto-decline window ─── */
const AUTO_DECLINE_SECONDS = 30;

/* ─── Premium ringtone (same source as the video overlay) ───
 *  Served from public/ via express.static (`/audio/incoming-call-ringtone.mp3`).
 *  Looped HTML5 Audio + Safari/WebKit autoplay-unlock dance, lifted from
 *  `IncomingVideoCallOverlay` so behaviour stays identical across both. */
const RINGTONE_URL = '/audio/incoming-call-ringtone.mp3';
let _ringAudio: HTMLAudioElement | null = null;
let _audioUnlocked = false;
let _audioCtx: AudioContext | null = null;

const UNLOCK_EVENTS = ['click', 'touchstart', 'keydown', 'scroll'] as const;

function unlockAudio(): void {
  if (_audioUnlocked) return;

  // Tiny silent WAV used for the unlock — playing the real ringtone leaks
  // an audible blip on Safari before the async pause() fires.
  const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  const silentAudio = new Audio(SILENT_WAV);

  const htmlUnlock = silentAudio
    .play()
    .then(() => {
      silentAudio.pause();
      if (!_ringAudio) {
        _ringAudio = new Audio(RINGTONE_URL);
        _ringAudio.loop = true;
        _ringAudio.preload = 'auto';
        _ringAudio.volume = 0.7;
      }
      return true;
    })
    .catch(() => false);

  let ctxUnlock = Promise.resolve(false);
  try {
    if (!_audioCtx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) _audioCtx = new AC();
    }
    if (_audioCtx?.state === 'suspended') {
      ctxUnlock = _audioCtx.resume().then(() => true).catch(() => false);
    } else if (_audioCtx?.state === 'running') {
      ctxUnlock = Promise.resolve(true);
    }
  } catch {
    /* AudioContext not available */
  }

  Promise.all([htmlUnlock, ctxUnlock]).then(([html, ctx]) => {
    if (html || ctx) {
      _audioUnlocked = true;
      for (const evt of UNLOCK_EVENTS) {
        document.removeEventListener(evt, unlockAudio, true);
      }
    }
  });
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  for (const evt of UNLOCK_EVENTS) {
    document.addEventListener(evt, unlockAudio, { capture: true, passive: true });
  }
}

function startRingtone(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (!_ringAudio) {
      _ringAudio = new Audio(RINGTONE_URL);
      _ringAudio.loop = true;
      _ringAudio.volume = 0.7;
    }
    _ringAudio.currentTime = 0;
    _ringAudio.play().catch(() => {});
  } catch {
    /* no-op */
  }
}

function stopRingtone(): void {
  if (_ringAudio) {
    _ringAudio.pause();
    _ringAudio.currentTime = 0;
  }
}

/* ─── prefers-reduced-motion gate ─── */
function prefersReducedMotion(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/* ─── Web-only keyframe injector (for the icon pulse) ─── */
const PULSE_STYLE_ID = 'aspire-incoming-call-pulse-keyframes';
function ensurePulseKeyframes(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
@keyframes aspire-incoming-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(59,130,246,0.55); }
  70%  { transform: scale(1.04); box-shadow: 0 0 0 14px rgba(59,130,246,0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(59,130,246,0); }
}
@keyframes aspire-incoming-glow {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}
`;
  document.head.appendChild(style);
}

/* ─── Caller history badge derived from resolved.last_interaction_at + count ─── */
interface CallerHistory {
  label: string;
  /** First-time vs returning */
  isReturning: boolean;
}

function deriveCallerHistory(
  resolved: ResolvedCaller | null,
  totalCalls: number | null,
): CallerHistory {
  if (totalCalls != null && totalCalls > 1) {
    const priorCount = totalCalls - 1; // current ringing call is implicitly +1
    return {
      label: `Returning · ${priorCount} prior call${priorCount === 1 ? '' : 's'}`,
      isReturning: true,
    };
  }
  if (resolved?.contact_type === 'routing') {
    return { label: 'Saved contact', isReturning: true };
  }
  if (resolved?.last_interaction_at) {
    return { label: 'Returning caller', isReturning: true };
  }
  return { label: 'First-time caller', isReturning: false };
}

/* ─── Transfer source extraction (Tiffany / Sarah / direct) ─── */
interface TransferContext {
  source: 'tiffany' | 'sarah' | 'direct';
  reason: string | null;
  agentName: string | null;
}

function extractTransferContext(metadata: Record<string, unknown> | null | undefined): TransferContext {
  const meta = metadata ?? {};
  // Common shape (proposed backend contract):
  //   metadata.transfer = { agent: 'tiffany'|'sarah', reason: '...', agent_name: 'Tiffany' }
  const transfer = (meta as any).transfer as
    | { agent?: string; reason?: string; agent_name?: string; capture_message?: string }
    | undefined;
  if (transfer?.agent) {
    const slug = String(transfer.agent).toLowerCase();
    const source: TransferContext['source'] =
      slug === 'tiffany' ? 'tiffany' : slug === 'sarah' ? 'sarah' : 'direct';
    return {
      source,
      reason:
        (transfer.reason && transfer.reason.trim()) ||
        (transfer.capture_message && transfer.capture_message.trim()) ||
        null,
      agentName:
        transfer.agent_name?.trim() ||
        (slug === 'tiffany' ? 'Tiffany' : slug === 'sarah' ? 'Sarah' : null),
    };
  }
  return { source: 'direct', reason: null, agentName: null };
}

/* ─── Component ─── */
function IncomingCallOverlayInner(): React.ReactElement | null {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();
  const { calls } = useFrontdeskCalls({ pollInterval: 2500, limit: 30 });
  const [overlayState, setOverlayState] = useState(getIncomingCallOverlayState());
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DECLINE_SECONDS);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  // Animated values (native pulse + entry choreography)
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(0)).current;
  const suppressedCallIds = useRef<Set<string>>(new Set());

  /* Keyframe injection (web only, idempotent) */
  useEffect(() => {
    ensurePulseKeyframes();
  }, []);

  /* ─── Caller-ID resolver registration ─── */
  const resolveCallerId = useCallback<CallerIdResolver>(
    async (phone, signal) => {
      try {
        const url = `${API_BASE}/api/v1/calls/caller-id-lookup?phone=${encodeURIComponent(phone)}`;
        const resp = await authenticatedFetch(url, { method: 'GET', signal });
        if (!resp.ok) return null;
        const body = (await resp.json()) as Partial<ResolvedCaller> & {
          formatted_number?: string;
          contact_type?: string;
        };
        return {
          display_name: body.display_name ?? null,
          role: body.role ?? null,
          contact_type: (body.contact_type as ResolvedCaller['contact_type']) ?? 'unknown',
          last_interaction_at: body.last_interaction_at ?? null,
          formatted_number: body.formatted_number ?? formatPhoneNumber(phone),
        };
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return null;
        devError('caller-id lookup failed', err);
        return null;
      }
    },
    [authenticatedFetch],
  );

  useEffect(() => {
    registerCallerIdResolver(resolveCallerId);
    return () => {
      registerCallerIdResolver(null);
    };
  }, [resolveCallerId]);

  /* Subscribe to store */
  useEffect(() => {
    const unsubscribe = subscribeIncomingCallOverlay(setOverlayState);
    return unsubscribe;
  }, []);

  /* Polling-driven trigger */
  const ringingCall = useMemo(
    () => calls.find((call) => call.status === 'ringing' && call.direction === 'inbound') || null,
    [calls],
  );

  useEffect(() => {
    if (
      ringingCall &&
      !overlayState.visible &&
      !suppressedCallIds.current.has(ringingCall.call_session_id)
    ) {
      triggerIncomingCall(ringingCall, false);
    }
  }, [ringingCall, overlayState.visible]);

  /* Countdown — auto-declines after AUTO_DECLINE_SECONDS */
  useEffect(() => {
    if (!overlayState.visible) {
      setSecondsLeft(AUTO_DECLINE_SECONDS);
      return;
    }

    setSecondsLeft(AUTO_DECLINE_SECONDS);
    const startedAt = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, AUTO_DECLINE_SECONDS - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (overlayState.call) {
          suppressedCallIds.current.add(overlayState.call.call_session_id);
        }
        dismissIncomingCallOverlay();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [overlayState.visible, overlayState.call?.call_session_id]);

  /* Card entry animations + ringtone + native pulse */
  useEffect(() => {
    if (!overlayState.visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(cardScale, { toValue: 0.95, duration: 150, useNativeDriver: false }),
      ]).start();
      stopRingtone();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
    ]).start();

    // Native pulse (web uses CSS keyframes — see styles.iconHaloWebPulse)
    let pulseAnim: Animated.CompositeAnimation | null = null;
    if (Platform.OS !== 'web' && !reducedMotion) {
      iconPulse.setValue(0);
      pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, { toValue: 1, duration: 1100, useNativeDriver: false }),
          Animated.timing(iconPulse, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      );
      pulseAnim.start();
    }

    startRingtone();

    return () => {
      stopRingtone();
      if (pulseAnim) pulseAnim.stop();
    };
  }, [overlayState.visible, reducedMotion]);

  /* ─── Gate ─── */
  if (!overlayState.visible || !overlayState.call) return null;

  const call = overlayState.call;
  const resolved = overlayState.resolvedCaller;
  const formattedNumber = resolved?.formatted_number ?? formatPhoneNumber(call.from_number);

  // Pull caller_total_calls if backend ever attaches it to call.metadata
  const callerTotalCalls =
    typeof (call.metadata as any)?.caller_total_calls === 'number'
      ? ((call.metadata as any).caller_total_calls as number)
      : null;

  // Business name fallback chain: resolved business -> metadata.contact_business -> null
  const businessName: string | null =
    ((call.metadata as any)?.contact_business_name as string | null | undefined)?.trim() ||
    ((call.metadata as any)?.business_name as string | null | undefined)?.trim() ||
    null;

  const transferCtx = extractTransferContext(call.metadata);
  const history = deriveCallerHistory(resolved, callerTotalCalls);

  // Primary display name
  const primaryName =
    resolved?.display_name?.trim() ||
    call.caller_name?.trim() ||
    formattedNumber;

  // Subtitle: business name OR "Unknown caller" (when no resolution)
  const subtitleText: string =
    businessName ||
    (resolved?.role
      ? resolved.role.charAt(0).toUpperCase() + resolved.role.slice(1)
      : resolved?.display_name
        ? 'is calling you'
        : 'Unknown caller');

  // Source line
  const sourceLine: string =
    transferCtx.source === 'direct'
      ? 'Direct call to your line'
      : `Transferred by ${transferCtx.agentName ?? 'reception'}`;

  // Native icon pulse interpolation (no-op on web — CSS handles it)
  const iconPulseStyle = {
    opacity: iconPulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0.18, 0] }),
    transform: [{ scale: iconPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  };

  // Progress percentage (0 -> 1) — countdown ring fill direction
  const progress = (AUTO_DECLINE_SECONDS - secondsLeft) / AUTO_DECLINE_SECONDS;

  /* ─── Handlers ─── */
  const handleDecline = (): void => {
    unlockAudio();
    if (overlayState.call) {
      suppressedCallIds.current.add(overlayState.call.call_session_id);
    }
    dismissIncomingCallOverlay();
  };

  const handleAnswer = (): void => {
    unlockAudio();
    if (overlayState.call) {
      suppressedCallIds.current.add(overlayState.call.call_session_id);
    }
    dismissIncomingCallOverlay();
    router.push('/session/calls');
  };

  /* ─── Render ─── */
  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
      accessibilityRole="alert"
      accessibilityLabel={`Incoming call from ${primaryName}${
        businessName ? ` of ${businessName}` : ''
      }`}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        {/* Hero ImageBackground spans the entire card.
            Layered:
              1. Mountain sunrise photo
              2. Vertical dark gradient (top -> bottom for body legibility)
              3. Subtle blue accent veil at top edge to anchor the brand */}
        <ImageBackground
          source={heroImage}
          style={styles.heroBackground}
          imageStyle={styles.heroImage as any}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        >
          {/* Top -> bottom darkening gradient (premium veil) */}
          <LinearGradient
            colors={[
              'rgba(8,12,24,0.35)',
              'rgba(8,12,24,0.55)',
              'rgba(10,14,26,0.82)',
              'rgba(10,14,26,0.95)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={styles.heroGradient}
          />
          {/* Top brand glow (web only) */}
          {Platform.OS === 'web' ? <View style={styles.heroBrandGlow} /> : null}

          {/* Card content */}
          <View style={styles.content}>
            {/* Top eyebrow row: label + source pill */}
            <View style={styles.eyebrowRow}>
              <Text style={styles.label as any} accessibilityRole="header">
                INCOMING CALL
              </Text>
              <View
                style={[
                  styles.sourcePill,
                  transferCtx.source !== 'direct' && styles.sourcePillTransfer,
                ]}
              >
                <Ionicons
                  name={transferCtx.source === 'direct' ? 'call-outline' : 'swap-horizontal'}
                  size={12}
                  color={transferCtx.source === 'direct' ? 'rgba(255,255,255,0.65)' : '#7DD3FC'}
                />
                <Text
                  style={[
                    styles.sourcePillText,
                    transferCtx.source !== 'direct' && styles.sourcePillTextTransfer,
                  ]}
                  numberOfLines={1}
                >
                  {sourceLine}
                </Text>
              </View>
            </View>

            {/* Pulsing call icon halo */}
            <View style={styles.iconStack}>
              {/* Native ring (only renders + animates on native) */}
              {Platform.OS !== 'web' ? (
                <Animated.View style={[styles.iconHalo, iconPulseStyle]} />
              ) : null}
              {/* Web pulsing ring via CSS keyframes (no-op on native) */}
              {Platform.OS === 'web' && !reducedMotion ? (
                <View style={styles.iconHaloWebPulse} />
              ) : null}
              <View style={styles.iconCircle}>
                <Ionicons name="call" size={26} color="#fff" />
              </View>
            </View>

            {/* Caller name */}
            <Text style={styles.name} numberOfLines={1}>
              {primaryName}
            </Text>

            {/* Subtitle (business name OR fallback) */}
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitleText}
            </Text>

            {/* History badge */}
            <View
              style={[
                styles.historyBadge,
                history.isReturning ? styles.historyBadgeReturning : styles.historyBadgeNew,
              ]}
            >
              <View
                style={[
                  styles.historyDot,
                  history.isReturning ? styles.historyDotReturning : styles.historyDotNew,
                ]}
              />
              <Text style={styles.historyText}>{history.label}</Text>
            </View>

            {/* Reason quote (only when transfer message captured) */}
            {transferCtx.reason ? (
              <View style={styles.reasonCard}>
                <View style={styles.reasonRule} />
                <Text style={styles.reasonText} numberOfLines={3}>
                  &ldquo;{transferCtx.reason}&rdquo;
                </Text>
              </View>
            ) : null}

            {/* Number row */}
            <View style={styles.numberRow}>
              <Text style={styles.numberLabel}>NUMBER</Text>
              <Text style={styles.numberValue} numberOfLines={1}>
                {formattedNumber}
              </Text>
            </View>

            {/* Slim countdown progress bar */}
            <View
              style={styles.countdownBar}
              accessibilityLabel={`Auto-decline in ${secondsLeft} seconds`}
              accessibilityLiveRegion="polite"
            >
              <View
                style={[
                  styles.countdownBarFill,
                  { width: `${Math.min(100, Math.max(0, progress * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.countdownText}>Auto-decline in {secondsLeft}s</Text>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.decline,
                  pressed && styles.declinePressed,
                ]}
                onPress={handleDecline}
                accessibilityRole="button"
                accessibilityLabel="Decline call"
                accessibilityHint="Dismisses the call without answering"
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.answer,
                  pressed && styles.answerPressed,
                ]}
                onPress={handleAnswer}
                accessibilityRole="button"
                accessibilityLabel="Answer call"
                accessibilityHint="Opens the call session view"
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.answerText}>Answer</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>
    </View>
  );
}

/* ─── Aspire Premium Palette (mountain hero edition) ─── */
const ACCENT = {
  solid: '#7DD3FC',     // sky-300 — echoes the dawn light in the photo
  deep: '#3B82F6',      // brand blue
  warm: '#F59E0B',      // sunrise amber accent
} as const;

/* ─── Styles ─── */
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,6,14,0.78)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px) saturate(120%)',
          WebkitBackdropFilter: 'blur(24px) saturate(120%)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Card shell — 440x~560 (auto height, capped via maxWidth) */
  card: {
    width: 440,
    maxWidth: '92%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a0e1a',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 30px 80px rgba(0,0,0,0.6)',
            '0 8px 24px rgba(0,0,0,0.45)',
            'inset 0 1px 0 rgba(255,255,255,0.06)',
            '0 0 0 1px rgba(125,211,252,0.06)',
          ].join(', '),
          transform: 'perspective(1400px) rotateX(0.4deg)',
        } as unknown as ViewStyle)
      : {
          elevation: 28,
        }),
  },

  /* Mountain ImageBackground spans entire card */
  heroBackground: {
    width: '100%',
    minHeight: 560,
    justifyContent: 'flex-start',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    // Slight saturation/contrast tilt on web for cinematic feel
    ...(Platform.OS === 'web'
      ? ({ filter: 'saturate(1.05) contrast(1.05)' } as unknown as ViewStyle)
      : {}),
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBrandGlow: {
    position: 'absolute',
    top: -40,
    left: '50%',
    width: 320,
    height: 220,
    marginLeft: -160,
    ...(Platform.OS === 'web'
      ? ({
          background:
            'radial-gradient(circle at center, rgba(125,211,252,0.28) 0%, rgba(125,211,252,0.08) 40%, transparent 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  content: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
    width: '100%',
  },

  /* Eyebrow row — label left, source pill right */
  eyebrowRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: ACCENT.solid,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 0 12px rgba(125,211,252,0.5)' } as unknown as ViewStyle)
      : {}),
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: 230,
  },
  sourcePillTransfer: {
    borderColor: 'rgba(125,211,252,0.35)',
    backgroundColor: 'rgba(125,211,252,0.10)',
  },
  sourcePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  sourcePillTextTransfer: {
    color: '#BAE6FD',
  },

  /* Pulsing icon */
  iconStack: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconHalo: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: ACCENT.solid,
  },
  iconHaloWebPulse: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(59,130,246,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          animation: 'aspire-incoming-pulse 1.6s ease-out infinite',
        } as unknown as ViewStyle)
      : {}),
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(59,130,246,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
          boxShadow:
            '0 8px 28px rgba(59,130,246,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Name + subtitle */
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    ...(Platform.OS === 'web'
      ? ({
          lineHeight: '1.15',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        } as any)
      : { lineHeight: 32 }),
  } as any,
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(186,230,253,0.78)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* History badge */
  historyBadge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  historyBadgeNew: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  historyBadgeReturning: {
    backgroundColor: 'rgba(125,211,252,0.10)',
    borderColor: 'rgba(125,211,252,0.4)',
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  historyDotNew: {
    backgroundColor: ACCENT.warm,
  },
  historyDotReturning: {
    backgroundColor: ACCENT.solid,
  },
  historyText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.4,
  },

  /* Reason quote */
  reasonCard: {
    marginTop: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reasonRule: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: ACCENT.solid,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(125,211,252,0.6)' } as unknown as ViewStyle)
      : {}),
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.86)',
    fontStyle: 'italic',
  },

  /* Number row */
  numberRow: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  numberLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(186,230,253,0.6)',
    letterSpacing: 1.2,
  },
  numberValue: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as any)
      : { fontVariant: ['tabular-nums'] as any }),
  } as any,

  /* Countdown bar (slim, base of card) */
  countdownBar: {
    marginTop: 18,
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: '100%',
    backgroundColor: ACCENT.solid,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(90deg, #7DD3FC 0%, #3B82F6 100%)',
          transition: 'width 1s linear',
          boxShadow: '0 0 8px rgba(125,211,252,0.5)',
        } as unknown as ViewStyle)
      : {}),
  },
  countdownText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as any)
      : { fontVariant: ['tabular-nums'] as any }),
  } as any,

  /* Actions */
  actions: {
    marginTop: 18,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44, // accessibility tap target
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'background-color 0.18s ease, opacity 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease',
          cursor: 'pointer',
          outlineOffset: 2,
        } as unknown as ViewStyle)
      : {}),
  },
  decline: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  declinePressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  declineText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  answer: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
          boxShadow:
            '0 8px 28px rgba(59,130,246,0.42), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)',
        } as unknown as ViewStyle)
      : {}),
  },
  answerPressed: {
    backgroundColor: '#2563EB',
    opacity: 0.96,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
          boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
          transform: 'scale(0.98)',
        } as unknown as ViewStyle)
      : {}),
  },
  answerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export function IncomingCallOverlay() {
  return (
    <PageErrorBoundary pageName="incoming-call-overlay">
      <IncomingCallOverlayInner />
    </PageErrorBoundary>
  );
}
