import React, { useEffect, useRef, useState } from 'react';
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

/* ─── Premium Ringtone (HTML5 Audio — real MP3, loops) ─── */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ringtoneSrc = require('@/assets/audio/incoming-call-ringtone.mp3');
let _ringAudio: HTMLAudioElement | null = null;

function startRingtone(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (!_ringAudio) {
      _ringAudio = new Audio(ringtoneSrc);
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
function CallerDetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ─── Component ─── */
export function IncomingVideoCallOverlay(): React.ReactElement | null {
  const router = useRouter();
  const { session, suiteId } = useSupabase();
  const [overlayState, setOverlayState] = useState(getIncomingVideoCallState());
  const [secondsLeft, setSecondsLeft] = useState(0);

  /* Animation values */
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);

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
      // Stop ring pulse loop
      if (ringLoopRef.current) {
        ringLoopRef.current.stop();
        ringLoopRef.current = null;
      }

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

    /* Ring pulse loop */
    ringPulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    ringLoopRef.current = loop;
    loop.start();

    /* Ringer — real MP3, loops automatically */
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
      if (ringLoopRef.current) {
        ringLoopRef.current.stop();
        ringLoopRef.current = null;
      }
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

  /* Ring pulse style — gentler expansion with smooth fade */
  const ringStyle = {
    opacity: ringPulse.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.45, 0.2, 0],
    }),
    transform: [
      {
        scale: ringPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.0],
        }),
      },
    ],
  };

  /* ─── Handlers ─── */
  const handleAccept = async (): Promise<void> => {
    if (!invitation || !session?.access_token) return;
    try {
      const result = await acceptVideoCall(invitation.id, session.access_token, suiteId ?? undefined);
      // dismissIncomingVideoCall is already called inside acceptVideoCall
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
      // declineVideoCall calls dismissIncomingVideoCall internally on success
      await declineVideoCall(invitation.id, session.access_token, suiteId ?? undefined);
    } catch {
      // API failed — still dismiss the overlay locally
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
              colors={['transparent', 'rgba(8,12,28,0.95)']}
              style={styles.heroGradient}
            />
          </ImageBackground>

          {/* Pulsing ring glow overlaying hero */}
          <Animated.View style={[styles.heroRing, ringStyle]} />
          {/* Static inner ring */}
          <View style={styles.heroRingInner} />
        </View>

        {/* Label */}
        <Text style={styles.label}>INCOMING VIDEO CALL</Text>

        {/* Caller name */}
        <Text style={styles.name} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={styles.subtitle}>is calling you</Text>

        {/* Caller details grid */}
        {callerDetails.length > 0 && (
          <View style={styles.detailsCard}>
            {callerDetails.map((detail) => (
              <CallerDetailRow
                key={detail.label}
                label={detail.label}
                value={detail.value}
              />
            ))}
          </View>
        )}

        {/* Countdown */}
        <Text style={styles.countdown}>
          {'\u23F1'} {secondsLeft}s
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
            <Ionicons name="close" size={18} color="#EF4444" />
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

/* ─── Accent color palette (sky-400 family, consistent throughout) ─── */
const ACCENT = {
  solid: '#38BDF8',
  ring: 'rgba(56,189,248,0.6)',
  ringDim: 'rgba(56,189,248,0.3)',
  ringFill: 'rgba(56,189,248,0.08)',
  border: 'rgba(56,189,248,0.15)',
  borderInner: 'rgba(56,189,248,0.12)',
  glow: 'rgba(56,189,248,0.08)',
} as const;

const CARD_BG = 'rgba(8,12,28,0.95)';

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
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as unknown as ViewStyle)
      : {}),
  },
  card: {
    width: 480,
    maxWidth: '92%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ACCENT.border,
    alignItems: 'center',
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 1px 3px rgba(0,0,0,0.25)',
            '0 8px 24px rgba(0,0,0,0.4)',
            '0 24px 64px rgba(0,0,0,0.5)',
            '0 0 0 1px rgba(255,255,255,0.06)',
            'inset 0 1px 0 rgba(255,255,255,0.04)',
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
  heroRing: {
    position: 'absolute',
    bottom: -8,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: ACCENT.ring,
  },
  heroRingInner: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: ACCENT.ringDim,
    backgroundColor: ACCENT.ringFill,
  },

  /* Label */
  label: {
    marginTop: 24,
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

  /* Caller details grid */
  detailsCard: {
    marginTop: 20,
    marginHorizontal: 32,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    width: 72,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },

  /* Countdown */
  countdown: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
  },

  /* Actions */
  actions: {
    marginTop: 20,
    marginBottom: 28,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 32,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease',
          cursor: 'pointer',
        } as unknown as ViewStyle)
      : {}),
  },
  decline: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
  },
  declinePressed: {
    backgroundColor: 'rgba(239,68,68,0.22)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  declineText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  join: {
    backgroundColor: '#22C55E',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          boxShadow: '0 4px 16px rgba(34,197,94,0.25)',
        } as unknown as ViewStyle)
      : {}),
  },
  joinPressed: {
    backgroundColor: '#16A34A',
    opacity: 0.9,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
          boxShadow: '0 2px 8px rgba(34,197,94,0.20)',
        } as unknown as ViewStyle)
      : {}),
  },
  joinText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
