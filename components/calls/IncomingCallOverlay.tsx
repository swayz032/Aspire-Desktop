/**
 * IncomingCallOverlay — Phone incoming-call modal.
 *
 * Visual chrome is intentionally identical to `IncomingVideoCallOverlay` per
 * plan §3.10 alignment table (440px card, `#1E1E1E` bg, 16 radius, 20px
 * backdrop blur, blue accent `#3B82F6`, hero block, accent divider with glow,
 * inner detail card, countdown, ghost Decline / blue gradient Answer).
 *
 * Only the contextual content differs:
 *   - "INCOMING CALL" label (vs "INCOMING VIDEO CALL")
 *   - Caller name resolved from `routing_contacts` → `sms_thread` → call memory
 *   - Detail card rows: Number / Resolved Contact / Routing Role / Note
 *   - Hero is a tinted ambient gradient (NOT a literal conference photo —
 *     a voice call has no video room context, so we use the Aspire-blue
 *     ambient backdrop with a low-opacity AvaOrb tint to anchor the brand).
 *   - Decline button (matches video Decline) + Answer button (label "Answer",
 *     same blue gradient as video Join Session).
 *
 * Caller-ID resolution flow:
 *   1. `useFrontdeskCalls` polling sees a ringing inbound call → calls
 *      `triggerIncomingCall(call)` (replaces legacy `showIncomingCallOverlay`
 *      so the lookup actually fires).
 *   2. Store kicks off `GET /api/v1/calls/caller-id-lookup?phone=...` via the
 *      resolver registered by this component on mount.
 *   3. Result lands in store → re-renders this component smoothly. If lookup
 *      fails or returns 'unknown', overlay shows formatted E.164.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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

/* ─── Auto-decline window (matches plan §3.10 "Auto-decline in 30s") ─── */
const AUTO_DECLINE_SECONDS = 30;

/* ─── Ringtone unlock (Safari/WebKit autoplay policy) ─── */
let ringAudioUnlocked = false;
const RING_UNLOCK_EVENTS = ['click', 'touchstart', 'keydown', 'scroll'] as const;

function unlockRingAudio(): void {
  if (ringAudioUnlocked || Platform.OS !== 'web' || typeof window === 'undefined') return;
  ringAudioUnlocked = true;
  for (const eventName of RING_UNLOCK_EVENTS) {
    document.removeEventListener(eventName, unlockRingAudio, true);
  }
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  for (const eventName of RING_UNLOCK_EVENTS) {
    document.addEventListener(eventName, unlockRingAudio, { capture: true, passive: true });
  }
}

function playRingTone(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!ringAudioUnlocked) return;

  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [740, 880, 988];

    notes.forEach((freq: number, index: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.14);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + index * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.14 + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + index * 0.14);
      oscillator.stop(ctx.currentTime + index * 0.14 + 0.18);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // no-op
  }
}

/* ─── Timestamp humanizer (last_interaction_at → "2 days ago") ─── */
function humanizeTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const deltaMs = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/* ─── Detail row (matches video overlay's CallerDetailRow) ─── */
function CallerDetailRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast: boolean;
}): React.ReactElement {
  return (
    <View
      style={[
        styles.detailRow,
        !isLast && styles.detailRowBorder,
      ]}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ─── Component ─── */
function IncomingCallOverlayInner(): React.ReactElement | null {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();
  const { calls } = useFrontdeskCalls({ pollInterval: 2500, limit: 30 });
  const [overlayState, setOverlayState] = useState(getIncomingCallOverlayState());
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DECLINE_SECONDS);

  /* Animation values — same shape/timings as the video overlay */
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const suppressedCallIds = useRef<Set<string>>(new Set());

  /* ─── Caller-ID resolver registration ───
   * Wires the store's lookup hook into `useAuthFetch` so the lookup
   * carries the right Authorization + tenant headers. We register on
   * mount and unregister on unmount; replacing it on re-render is fine
   * because the store treats it as idempotent. */
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
        // Backend may return a minimal `{contact_type: 'unknown', formatted_number}`
        // or a full payload — normalize both into ResolvedCaller shape.
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

  /* Polling loop watches for new ringing inbound calls and triggers the
   * overlay (with a parallel caller-ID lookup). Suppress duplicates by
   * call_session_id to avoid re-showing after dismiss. */
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

  /* Card + backdrop animations + ringer + ring pulse */
  useEffect(() => {
    if (!overlayState.visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(cardScale, { toValue: 0.95, duration: 150, useNativeDriver: false }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();

    /* Pulsing avatar ring — preserved from old overlay, relocated to detail card */
    ringPulse.setValue(0);
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(ringPulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    pulseAnim.start();

    playRingTone();
    const interval = setInterval(playRingTone, 2000);

    return () => {
      clearInterval(interval);
      pulseAnim.stop();
    };
  }, [overlayState.visible]);

  /* ─── Gate ─── */
  if (!overlayState.visible || !overlayState.call) return null;

  const call = overlayState.call;
  const resolved = overlayState.resolvedCaller;
  const formattedNumber = resolved?.formatted_number ?? formatPhoneNumber(call.from_number);

  /* Choose primary display name with this fall-through:
   *   1. Resolved display_name (from caller-ID lookup)
   *   2. Provider-supplied caller_name (Twilio CNAM)
   *   3. Formatted E.164 (last resort) */
  const primaryName =
    resolved?.display_name?.trim() ||
    call.caller_name?.trim() ||
    formattedNumber;

  // Detail card rows — mirror the video overlay's structured rows
  const detailRows: { label: string; value: string }[] = [
    { label: 'Number', value: formattedNumber },
  ];
  if (resolved?.display_name) {
    detailRows.push({ label: 'Contact', value: resolved.display_name });
  }
  if (resolved?.role) {
    // Capitalize role for display ("owner" → "Owner")
    const roleDisplay = resolved.role.charAt(0).toUpperCase() + resolved.role.slice(1);
    detailRows.push({ label: 'Role', value: roleDisplay });
  }
  const noteText = humanizeTimestamp(resolved?.last_interaction_at ?? null);
  if (noteText) {
    detailRows.push({ label: 'Last seen', value: noteText });
  }

  // Animated ring around supplementary avatar (inside detail card)
  const ringStyle = {
    opacity: ringPulse.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.55, 0.15, 0] }),
    transform: [
      { scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
    ],
  };

  /* ─── Handlers ─── */
  const handleDecline = (): void => {
    unlockRingAudio();
    if (overlayState.call) {
      suppressedCallIds.current.add(overlayState.call.call_session_id);
    }
    dismissIncomingCallOverlay();
  };

  const handleAnswer = (): void => {
    unlockRingAudio();
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
      accessibilityLabel={`Incoming call from ${primaryName}`}
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
        {/* Hero — Aspire-blue ambient backdrop (NOT a conference photo).
            Matches video overlay's 148px hero block. Three layers:
              1. Solid card-bg fill (so the gradient sits on the right base)
              2. LinearGradient: deep navy → blue glow → fade into card-bg
              3. Radial-style accent dot (web-only) for premium ambient feel */}
        <View style={styles.heroContainer}>
          <View style={styles.heroBaseFill} />
          <LinearGradient
            colors={['#0E1E3A', '#1E3A6B', '#1E1E1E']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          />
          {Platform.OS === 'web' ? (
            <View style={styles.heroAmbientGlow} />
          ) : null}
          {/* Final fade overlay ensures clean handoff to caller name region */}
          <LinearGradient
            colors={['transparent', CARD_BG]}
            style={styles.heroFinalFade}
          />
        </View>

        {/* Label */}
        <Text style={styles.label} accessibilityRole="header">
          INCOMING CALL
        </Text>

        {/* Caller name */}
        <Text style={styles.name} numberOfLines={1}>
          {primaryName}
        </Text>
        <Text style={styles.subtitle}>is calling you</Text>

        {/* Accent divider with glow */}
        <View style={styles.divider} />

        {/* Detail card with structured rows + supplementary pulsing avatar */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsCardInner}>
            <View style={styles.detailsRows}>
              {detailRows.map((row, index) => (
                <CallerDetailRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  isLast={index === detailRows.length - 1}
                />
              ))}
            </View>

            {/* Supplementary 56px pulsing avatar — visual continuity with the
                old overlay; signals "an actual person is on the line" without
                competing with the primary name above. */}
            <View style={styles.avatarSlot}>
              <Animated.View style={[styles.avatarRing, ringStyle]} />
              <View style={styles.avatar}>
                <Ionicons name="call" size={22} color="rgba(255,255,255,0.92)" />
              </View>
            </View>
          </View>
        </View>

        {/* Countdown */}
        <Text style={styles.countdown} accessibilityLiveRegion="polite">
          Auto-decline in {secondsLeft}s
        </Text>

        {/* Action buttons */}
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
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
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
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.answerText}>Answer</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ─── Aspire Enterprise Palette (mirrors IncomingVideoCallOverlay) ─── */
const ACCENT = {
  solid: '#3B82F6',
  border: 'rgba(59,130,246,0.15)',
  glow: 'rgba(59,130,246,0.08)',
} as const;

const CARD_BG = '#1E1E1E';

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
    backgroundColor: 'rgba(0,0,0,0.72)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as unknown as ViewStyle)
      : {}),
  },
  card: {
    width: 440,
    maxWidth: '92%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 16px 48px rgba(0,0,0,0.5)',
            '0 4px 16px rgba(0,0,0,0.4)',
            'inset 0 1px 0 rgba(255,255,255,0.04)',
            '0 0 0 1px rgba(255,255,255,0.06)',
          ].join(', '),
          transform: 'perspective(1200px) rotateX(0.5deg)',
        } as unknown as ViewStyle)
      : {
          elevation: 24,
        }),
  },

  /* Hero — abstract Aspire-blue ambient backdrop */
  heroContainer: {
    width: '100%',
    height: 148,
    position: 'relative',
    alignItems: 'center',
    backgroundColor: '#0E1E3A',
  },
  heroBaseFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E1E3A',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroAmbientGlow: {
    // Web-only radial-glow accent — softens the hero with an ambient
    // blue light that echoes the AvaOrb without rendering it literally.
    position: 'absolute',
    top: 18,
    left: '50%',
    width: 220,
    height: 220,
    marginLeft: -110,
    borderRadius: 110,
    ...(Platform.OS === 'web'
      ? ({
          background: 'radial-gradient(circle at center, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0.18) 35%, transparent 70%)',
          filter: 'blur(24px)',
          opacity: 0.85,
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  heroFinalFade: {
    ...StyleSheet.absoluteFillObject,
  },

  /* Label */
  label: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ACCENT.solid,
  },

  /* Caller name + subtitle */
  name: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 24,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ lineHeight: '1.2' } as any)
      : { lineHeight: 30 }),
  } as any,
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* Accent divider with glow */
  divider: {
    marginTop: 16,
    width: 48,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.3)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 8px rgba(59,130,246,0.5)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Detail card — `#242426` bg, structured rows + supplementary avatar slot.
     Layout: rows on the left, avatar slot on the right (anchored vertically). */
  detailsCard: {
    marginTop: 16,
    marginHorizontal: 24,
    alignSelf: 'stretch',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#242426',
    paddingVertical: 4,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {}),
  },
  detailsCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailsRows: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  /* Supplementary avatar — 56px (down from 80px in legacy overlay) */
  avatarSlot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: ACCENT.solid,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Countdown */
  countdown: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as any)
      : { fontVariant: ['tabular-nums'] as any }),
  } as any,

  /* Actions */
  actions: {
    marginTop: 18,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
          cursor: 'pointer',
          outlineOffset: 2,
        } as unknown as ViewStyle)
      : {}),
  },

  /* Decline — ghost transparent border */
  decline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  declinePressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  declineText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Answer — Aspire blue gradient */
  answer: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          boxShadow: '0 4px 16px rgba(59,130,246,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        } as unknown as ViewStyle)
      : {}),
  },
  answerPressed: {
    backgroundColor: '#2563EB',
    opacity: 0.92,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          boxShadow: '0 2px 8px rgba(59,130,246,0.2)',
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
