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

/* ─── Ringer (reused from IncomingCallOverlay) ─── */
function playRingTone(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [740, 880, 988];

    notes.forEach((freq: number, index: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.14);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(
        0.08,
        ctx.currentTime + index * 0.14 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + index * 0.14 + 0.16,
      );
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
  }, [overlayState.visible, overlayState.invitation]);

  /* Animations + ringer */
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

    /* Ring pulse loop */
    ringPulse.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    /* Ringer */
    playRingTone();
    const interval = setInterval(playRingTone, 2000);
    return () => clearInterval(interval);
  }, [overlayState.visible]);

  /* ─── Gate ─── */
  if (!overlayState.visible || !overlayState.invitation) return null;

  const invitation = overlayState.invitation;
  const callerName = invitation.inviterName || 'Unknown';
  const suiteDisplay = invitation.inviterSuiteDisplayId
    ? `Suite ${invitation.inviterSuiteDisplayId}`
    : null;
  const officeDisplay = invitation.inviterOfficeDisplayId
    ? `Office ${invitation.inviterOfficeDisplayId}`
    : null;
  const locationLine = [suiteDisplay, officeDisplay].filter(Boolean).join(' \u2022 ');
  const businessName = invitation.inviterBusinessName || null;

  /* Ring pulse style */
  const ringStyle = {
    opacity: ringPulse.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.4, 0.1, 0],
    }),
    transform: [
      {
        scale: ringPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.3],
        }),
      },
    ],
  };

  /* ─── Handlers ─── */
  const handleAccept = async (): Promise<void> => {
    if (!invitation || !session?.access_token) return;
    try {
      const result = await acceptVideoCall(invitation.id, session.access_token, suiteId ?? undefined);
      dismissIncomingVideoCall();
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
      // Best effort
    }
    dismissIncomingVideoCall();
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
              colors={['transparent', 'rgba(10,18,34,0.9)']}
              style={styles.heroGradient}
            />
          </ImageBackground>

          {/* Pulsing ring glow overlaying hero */}
          <Animated.View style={[styles.heroRing, ringStyle]} />
        </View>

        {/* Label */}
        <Text style={styles.label}>INCOMING VIDEO CALL</Text>

        {/* Caller info */}
        <Text style={styles.name} numberOfLines={1}>
          {callerName}
        </Text>
        {locationLine ? (
          <Text style={styles.detail} numberOfLines={1}>
            {locationLine}
          </Text>
        ) : null}
        {businessName ? (
          <Text style={styles.business} numberOfLines={1}>
            {businessName}
          </Text>
        ) : null}

        {/* Countdown */}
        <Text style={styles.countdown}>
          {'\u23F1'} {secondsLeft}s
        </Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.decline]}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline video call"
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.actionText}>Decline</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.join]}
            onPress={handleAccept}
            accessibilityRole="button"
            accessibilityLabel="Join video session"
          >
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text style={styles.actionText}>Join Session</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

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
          backdropFilter: 'blur(12px)',
        } as unknown as ViewStyle)
      : {}),
  },
  card: {
    width: 340,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    backgroundColor: 'rgba(10,18,34,0.9)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.2)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18,
        }),
  },

  /* Hero image */
  heroContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
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
    bottom: 10,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(56,189,248,0.65)',
  },

  /* Label */
  label: {
    marginTop: 16,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#38BDF8',
  },

  /* Caller info */
  name: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  detail: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  business: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 20,
    textAlign: 'center',
  },

  /* Countdown */
  countdown: {
    marginTop: 12,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },

  /* Actions */
  actions: {
    marginTop: 16,
    marginBottom: 20,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  decline: {
    backgroundColor: '#EF4444',
  },
  join: {
    backgroundColor: '#22C55E',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
