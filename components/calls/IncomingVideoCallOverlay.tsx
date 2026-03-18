import React, { useEffect, useRef, useState } from 'react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
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
import { useSupabase } from '@/providers';
import {
  acceptVideoCall,
  declineVideoCall,
  dismissIncomingVideoCall,
  getIncomingVideoCallState,
  subscribeIncomingVideoCall,
} from '@/lib/incomingVideoCallStore';

/* ─── Conference room hero image ─── */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const conferenceHero = require('@/assets/images/conference-room-meeting.jpg');

/* ─── Premium Ringtone (served from public/ via express.static) ─── */
const RINGTONE_URL = '/audio/incoming-call-ringtone.mp3';
let _ringAudio: HTMLAudioElement | null = null;
let _audioUnlocked = false;
let _audioCtx: AudioContext | null = null;

/**
 * Safari/WebKit autoplay policy: Audio.play() is blocked unless the
 * element was first interacted with during a user gesture. This is a
 * hard browser constraint — Slack, Teams, Discord all face it.
 *
 * Strategy (production-grade):
 * 1. Self-invoke at module load (before React mount) to attach listeners
 * 2. On ANY user gesture (click/touch/key/scroll), silently unlock both
 *    the HTML5 Audio element AND a Web AudioContext (belt + suspenders)
 * 3. Listeners use capture phase to fire before any stopPropagation
 * 4. On unlock failure, keep listeners alive to retry on next gesture
 *
 * In a desktop productivity app, users interact within seconds of load.
 */
const UNLOCK_EVENTS = ['click', 'touchstart', 'keydown', 'scroll'] as const;

function unlockAudio(): void {
  if (_audioUnlocked) return;

  // Create and pre-load the Audio element
  if (!_ringAudio) {
    _ringAudio = new Audio(RINGTONE_URL);
    _ringAudio.loop = true;
    _ringAudio.preload = 'auto';
    _ringAudio.volume = 0;
  }

  // Strategy 1: HTML5 Audio silent play+pause
  const htmlUnlock = _ringAudio.play().then(() => {
    _ringAudio!.pause();
    _ringAudio!.currentTime = 0;
    _ringAudio!.volume = 0.7;
    return true;
  }).catch(() => false);

  // Strategy 2: Web AudioContext resume (some Safari versions need this)
  let ctxUnlock = Promise.resolve(false);
  try {
    if (!_audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) _audioCtx = new AC();
    }
    if (_audioCtx?.state === 'suspended') {
      ctxUnlock = _audioCtx.resume().then(() => true).catch(() => false);
    } else if (_audioCtx?.state === 'running') {
      ctxUnlock = Promise.resolve(true);
    }
  } catch { /* AudioContext not available */ }

  Promise.all([htmlUnlock, ctxUnlock]).then(([html, ctx]) => {
    if (html || ctx) {
      _audioUnlocked = true;
      // Clean up all listeners
      for (const evt of UNLOCK_EVENTS) {
        document.removeEventListener(evt, unlockAudio, true);
      }
    }
    // If both failed, listeners stay alive to retry on next gesture
  });
}

// Self-invoke at module load — attaches listeners before React mount
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
  } catch { /* no-op */ }
}

function stopRingtone(): void {
  if (_ringAudio) {
    _ringAudio.pause();
    _ringAudio.currentTime = 0;
  }
}

/* ─── Browser Notification ─── */
let notificationPermissionRequested = false;

function requestNotificationPermission(): void {
  if (
    Platform.OS !== 'web' ||
    typeof Notification === 'undefined' ||
    notificationPermissionRequested
  )
    return;
  notificationPermissionRequested = true;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function showBrowserNotification(callerName: string, businessName: string | null): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    new Notification('Incoming Video Call', {
      body: businessName
        ? `${callerName} from ${businessName} is calling`
        : `${callerName} is calling you`,
      icon: '/favicon.ico',
      requireInteraction: true,
      tag: 'aspire-video-call',
    });
  } catch {
    // no-op
  }
}

/* ─── Caller Detail Row ─── */
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
function IncomingVideoCallOverlayInner(): React.ReactElement | null {
  const router = useRouter();
  const { session, suiteId } = useSupabase();
  const [overlayState, setOverlayState] = useState(getIncomingVideoCallState());
  const [secondsLeft, setSecondsLeft] = useState(0);

  /* Animation values */
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  /* Request notification permission on first mount */
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  /* Subscribe to store */
  useEffect(() => {
    const unsubscribe = subscribeIncomingVideoCall(setOverlayState);
    return unsubscribe;
  }, []);

  /* Countdown timer */
  useEffect(() => {
    if (!overlayState.visible || !overlayState.invitation) return;

    const computeRemaining = (): number => {
      if (!overlayState.invitation) return 0;
      const expires = new Date(overlayState.invitation.expiresAt).getTime();
      return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
    };

    setSecondsLeft(computeRemaining());

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        dismissIncomingVideoCall();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [overlayState.visible, overlayState.invitation?.id]);

  /* Animations + ringer + browser notification */
  useEffect(() => {
    if (!overlayState.visible) {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    /* Ringer — served from public/ via express.static */
    startRingtone();

    /* Browser notification for away users */
    if (overlayState.invitation) {
      showBrowserNotification(
        overlayState.invitation.inviterName,
        overlayState.invitation.inviterBusinessName,
      );
    }

    return () => {
      stopRingtone();
    };
  }, [overlayState.visible]);

  /* ─── Gate ─── */
  if (!overlayState.visible || !overlayState.invitation) return null;

  const invitation = overlayState.invitation;
  const callerName = invitation.inviterName || 'Unknown';
  const businessName = invitation.inviterBusinessName || null;
  const callerRole = invitation.inviterRole || null;
  const suiteDisplay = invitation.inviterSuiteDisplayId || null;
  const officeDisplay = invitation.inviterOfficeDisplayId || null;

  // Build caller details array
  const callerDetails: { label: string; value: string }[] = [];
  if (businessName) callerDetails.push({ label: 'Company', value: businessName });
  if (callerRole) callerDetails.push({ label: 'Role', value: callerRole });
  if (suiteDisplay) callerDetails.push({ label: 'Suite', value: suiteDisplay });
  if (officeDisplay) callerDetails.push({ label: 'Office', value: officeDisplay });

  /* ─── Handlers ─── */
  const handleAccept = async (): Promise<void> => {
    if (!invitation || !session?.access_token) return;
    try {
      const result = await acceptVideoCall(invitation.id, session.access_token, suiteId ?? undefined);
      router.push({
        pathname: '/session/conference-live' as any,
        params: {
          roomName: result.roomName,
          token: result.token,
          serverUrl: result.serverUrl,
        },
      });
    } catch (err) {
      console.error('Failed to accept video call:', err);
    }
  };

  const handleDecline = async (): Promise<void> => {
    if (!invitation || !session?.access_token) return;
    try {
      await declineVideoCall(invitation.id, session.access_token, suiteId ?? undefined);
    } catch {
      dismissIncomingVideoCall();
    }
  };

  /* ─── Render ─── */
  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
      accessibilityRole="alert"
      accessibilityLabel="Incoming video call"
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
        {/* Hero image */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={conferenceHero}
            style={styles.heroImage}
            resizeMode="cover"
            accessibilityLabel="Conference room"
          >
            <LinearGradient
              colors={['transparent', CARD_BG]}
              style={styles.heroGradient}
            />
          </ImageBackground>
        </View>

        {/* Label */}
        <Text style={styles.label}>INCOMING VIDEO CALL</Text>

        {/* Caller name */}
        <Text style={styles.name} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={styles.subtitle}>is calling you</Text>

        {/* Accent divider */}
        <View style={styles.divider} />

        {/* Caller details card */}
        {callerDetails.length > 0 && (
          <View style={styles.detailsCard}>
            {callerDetails.map((detail, index) => (
              <CallerDetailRow
                key={detail.label}
                label={detail.label}
                value={detail.value}
                isLast={index === callerDetails.length - 1}
              />
            ))}
          </View>
        )}

        {/* Countdown */}
        <Text style={styles.countdown}>
          Expires in {secondsLeft}s
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
            accessibilityLabel="Decline video call"
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.join,
              pressed && styles.joinPressed,
            ]}
            onPress={handleAccept}
            accessibilityRole="button"
            accessibilityLabel="Join video session"
          >
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text style={styles.joinText}>Join Session</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ─── Aspire Enterprise Palette ─── */
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

  /* Hero image */
  heroContainer: {
    width: '100%',
    height: 148,
    position: 'relative',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
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

  /* Caller info */
  name: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 24,
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ lineHeight: '1.2' } as unknown as ViewStyle)
      : { lineHeight: 30 }),
  },
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
          boxShadow: '0 0 8px rgba(59,130,246,0.3)',
        } as unknown as ViewStyle)
      : {}),
  },

  /* Caller details card — CanvasTokens.innerCard */
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

  /* Countdown — clean text, no emoji */
  countdown: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as unknown as ViewStyle)
      : { fontVariant: ['tabular-nums'] as any }),
  },

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

  /* Decline — ghost style */
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

  /* Join — Aspire blue-500 gradient */
  join: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          boxShadow: '0 4px 16px rgba(59,130,246,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        } as unknown as ViewStyle)
      : {}),
  },
  joinPressed: {
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
  joinText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export function IncomingVideoCallOverlay() {
  return (
    <PageErrorBoundary pageName="incoming-video-call-overlay">
      <IncomingVideoCallOverlayInner />
    </PageErrorBoundary>
  );
}
