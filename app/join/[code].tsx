/**
 * Guest Join Page — Public, NO auth required.
 *
 * External guests receive a link like /join/{code} and land on this page
 * to join a Zoom Video SDK conference. The join code is resolved via
 * GET /api/conference/join/:code (a PUBLIC endpoint).
 *
 * Flow: loading → prejoin (name + device preview) → connecting → active → disconnected
 * Error states: expired (410) | invalid (404) | error
 *
 * Uses Zoom Video SDK via:
 * - ZoomConferenceProvider: session management + context
 * - ZoomVideoTile: participant video rendering
 * - Custom ZoomPreJoin: name entry + camera preview (before connecting)
 * - Custom ZoomGuestControlBar: mic/camera/disconnect controls
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { Image } from 'expo-image';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { ZoomConferenceProvider, useZoomContext, useZoomParticipants } from '@/components/session/ZoomConferenceProvider';
import type { ZoomParticipant } from '@/components/session/ZoomConferenceProvider';
import { ZoomVideoTile } from '@/components/session/ZoomVideoTile';
import { injectZoomStyles } from '@/lib/zoom-styles';
import { reportProviderError } from '@/lib/providerErrorReporter';

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinResponse {
  token: string;
  topic?: string;
  roomName: string;
  guestName: string;
}

type PageState =
  | 'loading'
  | 'prejoin'
  | 'connecting'
  | 'active'
  | 'disconnected'
  | 'expired'
  | 'invalid'
  | 'error';

/** Lightweight replacement for LiveKit's LocalUserChoices */
interface GuestUserChoices {
  username: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// Aspire "A" logo for Nora AI tile (matches internal conference AvaTile)
const avaLogoSrc = require('../../assets/images/ava-logo.png');

// ── Guest-specific color refinements ─────────────────────────────────────────

/** Guest page colors — derived from Aspire design tokens for consistency */
const GuestColors = {
  /** Deep background matching Aspire's #0a0a0c background.primary */
  canvas: Colors.background.primary,
  guestBadgeBg: Colors.accent.cyanLight,
  guestBadgeBorder: 'rgba(59, 130, 246, 0.18)',
  ringPulse: 'rgba(59, 130, 246, 0.25)',
  /** Error card surface — slightly elevated above canvas */
  errorCard: Colors.background.elevated,
  errorCardBorder: Colors.border.subtle,
} as const;

// ── Web Setup ────────────────────────────────────────────────────────────────

/**
 * Ensure mobile viewport is set correctly for the guest page.
 * Defense-in-depth: also handles the case where _layout.tsx already set width=1440.
 */
function ensureMobileViewport() {
  if (Platform.OS !== 'web') return;
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

function injectGuestKeyframes() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('aspire-guest-join-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'aspire-guest-join-keyframes';
  style.textContent = `
    @keyframes guestRingPulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.18); opacity: 0.15; }
    }
    @keyframes guestRingPulseOuter {
      0%, 100% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.25); opacity: 0.05; }
    }
    @keyframes guestRingRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes guestRingRotateReverse {
      from { transform: rotate(360deg); }
      to { transform: rotate(0deg); }
    }
    @keyframes guestFadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes guestBreatheDot {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    @keyframes guestLogoGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.08), inset 0 0 12px rgba(59, 130, 246, 0.04); }
      50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.15), inset 0 0 16px rgba(59, 130, 246, 0.08); }
    }
    @keyframes errorCardShimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
    @keyframes noraPulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 8px 2px rgba(79, 172, 254, 0.6), 0 0 15px 3px rgba(0, 242, 254, 0.4), 0 0 25px 5px rgba(79, 172, 254, 0.3);
      }
      50% {
        transform: scale(1.04);
        box-shadow: 0 0 12px 4px rgba(0, 255, 255, 0.8), 0 0 25px 8px rgba(79, 172, 254, 0.6), 0 0 40px 12px rgba(0, 242, 254, 0.4);
      }
    }

    /* ── iOS / Mobile Web Optimization ── */

    /* Fallback for browsers without dvh support (older iOS Safari <15.4) */
    @supports not (height: 100dvh) {
      .aspire-guest-conference-root {
        height: -webkit-fill-available !important;
      }
    }

    /* Prevent iOS Safari overscroll / rubber-banding on conference page */
    html, body {
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
    }

    /* iOS Safari: prevent text selection on interactive elements */
    .aspire-guest-conference-root button,
    .aspire-guest-conference-root [role="button"] {
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* Mobile: ensure Zoom control bar has safe area padding at bottom */
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
      .aspire-guest-conference-root > div:last-child {
        padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
      }
    }

    /* Mobile: ensure touch targets are at least 44px (Apple HIG) */
    @media (max-width: 768px) {
      .aspire-guest-conference-root button {
        min-width: 44px !important;
        min-height: 44px !important;
      }
    }

    /* Extra small screens (phones in portrait) */
    @media (max-width: 480px) {
      /* Guest badge compact on small screens */
      .guest-badge-overlay {
        top: calc(4px + env(safe-area-inset-top, 0px)) !important;
        left: 4px !important;
        padding: 4px 10px !important;
        font-size: 10px !important;
      }
    }

    /* Landscape orientation on mobile — maximize video area */
    @media (max-height: 500px) and (orientation: landscape) {
      .guest-badge-overlay {
        opacity: 0.6 !important;
        transform: scale(0.85) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingView() {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.12, duration: 1200, useNativeDriver: false }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ]),
    ).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 600, delay: 100, useNativeDriver: false }).start();
  }, []);

  return (
    <Animated.View
      style={[styles.centerContainer, { opacity: fadeIn }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Joining conference, please wait"
    >
      <View
        style={[
          styles.ringOutermost,
          Platform.OS === 'web' ? {
            animationName: 'guestRingPulseOuter',
            animationDuration: '3.2s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as unknown as ViewStyle : undefined,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Animated.View
        style={[
          styles.ringOuter,
          Platform.OS !== 'web' ? { transform: [{ scale: breatheAnim }] } : undefined,
          Platform.OS === 'web' ? {
            animationName: 'guestRingPulse',
            animationDuration: '2.4s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as unknown as ViewStyle : undefined,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[
          styles.ringDashed,
          Platform.OS === 'web' ? {
            animationName: 'guestRingRotate',
            animationDuration: '12s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          } as unknown as ViewStyle : undefined,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[
          styles.ringInnerAccent,
          Platform.OS === 'web' ? {
            animationName: 'guestRingRotateReverse',
            animationDuration: '16s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          } as unknown as ViewStyle : undefined,
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[
          styles.logoContainer,
          Platform.OS === 'web' ? {
            animationName: 'guestLogoGlow',
            animationDuration: '2.4s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as unknown as ViewStyle : undefined,
        ]}
        accessibilityElementsHidden
      >
        <View style={styles.logoInner}>
          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
        </View>
      </View>
      <View
        style={[
          styles.loadingTextContainer,
          Platform.OS === 'web' ? {
            animationName: 'guestFadeInUp',
            animationDuration: '0.6s',
            animationDelay: '0.3s',
            animationFillMode: 'both',
          } as unknown as ViewStyle : undefined,
        ]}
      >
        <Text style={styles.loadingTitle} accessibilityRole="header">Joining Conference</Text>
        <View style={styles.loadingDotRow} accessibilityElementsHidden>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                styles.loadingDot,
                Platform.OS === 'web' ? {
                  animationName: 'guestBreatheDot',
                  animationDuration: '1.4s',
                  animationIterationCount: 'infinite',
                  animationDelay: `${i * 0.25}s`,
                } as unknown as ViewStyle : undefined,
              ]}
            />
          ))}
        </View>
        <Text style={styles.loadingSubtitle}>Establishing secure connection</Text>
      </View>
    </Animated.View>
  );
}

// ── Error / Expired / Invalid State ──────────────────────────────────────────

function ErrorView({
  state,
  message,
  onRetry,
}: {
  state: 'expired' | 'invalid' | 'error';
  message: string;
  onRetry?: () => void;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, []);

  const config = {
    expired: {
      icon: 'time-outline' as const,
      title: 'Link Expired',
      subtitle: 'This conference link is no longer valid. Join links expire after 60 minutes.',
      iconColor: Colors.semantic.warning,
      borderColor: 'rgba(212, 160, 23, 0.2)',
      showRetry: false,
    },
    invalid: {
      icon: 'close-circle-outline' as const,
      title: 'Invalid Link',
      subtitle: 'This conference link could not be found. It may have already been used or the code is incorrect.',
      iconColor: Colors.semantic.error,
      borderColor: 'rgba(255, 59, 48, 0.15)',
      showRetry: false,
    },
    error: {
      icon: 'warning-outline' as const,
      title: 'Connection Error',
      subtitle: message || 'Something went wrong while joining the conference. Please try again.',
      iconColor: Colors.semantic.error,
      borderColor: 'rgba(255, 59, 48, 0.15)',
      showRetry: true,
    },
  }[state];

  return (
    <Animated.View
      style={[styles.centerContainer, { opacity: fadeIn }]}
      accessibilityRole="alert"
      accessibilityLabel={`${config.title}. ${config.subtitle}`}
    >
      <View
        style={[
          styles.errorCard,
          { borderColor: config.borderColor },
          Platform.OS === 'web' ? {
            animationName: 'guestFadeInUp',
            animationDuration: '0.5s',
            animationFillMode: 'both',
            boxShadow: `0 24px 64px -16px rgba(0, 0, 0, 0.6), 0 0 0 1px ${config.borderColor}`,
          } as unknown as ViewStyle : undefined,
        ]}
      >
        <View
          style={[
            styles.errorAccentStripe,
            { background: `linear-gradient(90deg, ${config.iconColor}40, transparent)` } as unknown as ViewStyle,
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          style={[
            styles.errorIconRing,
            { borderColor: config.borderColor },
            Platform.OS === 'web' ? {
              boxShadow: `0 0 24px ${config.iconColor}20, inset 0 0 12px ${config.iconColor}08`,
            } as unknown as ViewStyle : undefined,
          ]}
          accessibilityElementsHidden
        >
          <Ionicons name={config.icon} size={36} color={config.iconColor} />
        </View>
        <Text style={styles.errorTitle} accessibilityRole="header">{config.title}</Text>
        <Text style={styles.errorSubtitle}>{config.subtitle}</Text>
        {config.showRetry && onRetry && (
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Ionicons name="refresh-outline" size={16} color={Colors.text.primary} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        )}
        <View style={styles.errorBranding}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── PreJoin Lobby (Zoom — custom camera preview) ─────────────────────────────

function GuestPreJoin({
  onJoin,
  onDeviceError,
}: {
  onJoin: (choices: GuestUserChoices) => void;
  onDeviceError: (error: Error) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [guestName, setGuestName] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  // Start camera preview on mount
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      })
      .catch((err: Error) => {
        setCameraActive(false);
        onDeviceError(err);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onDeviceError]);

  const handleSubmit = useCallback(() => {
    if (guestName.trim().length < 2) return;
    // Stop preview stream before joining
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onJoin({ username: guestName.trim(), audioEnabled: micActive, videoEnabled: cameraActive });
  }, [guestName, micActive, cameraActive, onJoin]);

  const isValid = guestName.trim().length >= 2;

  return (
    <View style={styles.prejoinContainer}>
      {/* Aspire branding header */}
      <View style={styles.prejoinHeader}>
        <View style={styles.prejoinIconRow}>
          <Ionicons name="videocam" size={24} color={Colors.accent.cyan} />
        </View>
        <Text style={styles.prejoinTitle} accessibilityRole="header">Aspire Conference</Text>
        <Text style={styles.prejoinSubtitle}>
          Enter your name and check your devices before joining
        </Text>
      </View>

      {/* Camera preview + controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        gap: '16px',
      }}>
        {/* Camera preview */}
        <div style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#111',
          position: 'relative' as const,
          border: '1px solid rgba(59, 130, 246, 0.15)',
        }}>
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="videocam-off" size={48} color={Colors.text.muted} />
            </div>
          )}
        </div>

        {/* Device toggle row */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}>
          <button
            type="button"
            onClick={() => setMicActive((v) => !v)}
            aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: 'none',
              background: micActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 59, 48, 0.2)',
              color: micActive ? Colors.accent.cyan : Colors.semantic.error,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <Ionicons name={micActive ? 'mic' : 'mic-off'} size={20} color={micActive ? Colors.accent.cyan : Colors.semantic.error} />
          </button>
          <button
            type="button"
            onClick={() => setCameraActive((v) => !v)}
            aria-label={cameraActive ? 'Turn off camera' : 'Turn on camera'}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: 'none',
              background: cameraActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 59, 48, 0.2)',
              color: cameraActive ? Colors.accent.cyan : Colors.semantic.error,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            <Ionicons name={cameraActive ? 'videocam' : 'videocam-off'} size={20} color={cameraActive ? Colors.accent.cyan : Colors.semantic.error} />
          </button>
        </div>

        {/* Name input */}
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && isValid) handleSubmit(); }}
          placeholder="Your Name"
          aria-label="Your Name"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        {/* Join button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          aria-label="Join Conference"
          style={{
            width: '100%',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: isValid ? Colors.accent.cyan : 'rgba(59, 130, 246, 0.3)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isValid ? 'pointer' : 'not-allowed',
            opacity: isValid ? 1 : 0.5,
            transition: 'opacity 0.2s ease',
          }}
        >
          Join Conference
        </button>
      </div>

      {/* Footer branding */}
      <View style={styles.prejoinFooter}>
        <View style={styles.brandingDotSmall} />
        <Text style={styles.brandingFooterText}>Powered by Aspire</Text>
      </View>
    </View>
  );
}

// ── Connecting State ──────────────────────────────────────────────────────────

function ConnectingView() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[styles.centerContainer, { opacity: fadeIn }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Connecting to conference, setting up audio and video"
    >
      <View style={styles.logoContainer} accessibilityElementsHidden>
        <View style={styles.logoInner}>
          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
        </View>
      </View>
      <Text style={styles.loadingTitle} accessibilityRole="header">Connecting</Text>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Text style={styles.loadingSubtitle}>Setting up your audio and video...</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Disconnected State ───────────────────────────────────────────────────────

function DisconnectedView({
  reason,
  onRejoin,
}: {
  reason: string;
  onRejoin: (() => void) | null;
}) {
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, []);

  return (
    <Animated.View
      style={[styles.centerContainer, { opacity: fadeIn }]}
      accessibilityRole="alert"
      accessibilityLabel={`Call ended. ${reason}`}
    >
      <View
        style={[
          styles.errorCard,
          { borderColor: Colors.accent.cyanMedium },
          Platform.OS === 'web' ? {
            animationName: 'guestFadeInUp',
            animationDuration: '0.5s',
            animationFillMode: 'both',
            boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.15)',
          } as unknown as ViewStyle : undefined,
        ]}
      >
        <View
          style={[
            styles.errorAccentStripe,
            { background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.4), transparent)' } as unknown as ViewStyle,
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          style={[
            styles.errorIconRing,
            { borderColor: Colors.accent.cyanMedium },
          ]}
          accessibilityElementsHidden
        >
          <Ionicons name="call-outline" size={36} color={Colors.accent.cyan} />
        </View>
        <Text style={styles.errorTitle} accessibilityRole="header">Call Ended</Text>
        <Text style={styles.errorSubtitle}>{reason}</Text>
        {onRejoin && (
          <Pressable
            style={({ pressed }) => [
              styles.rejoinButton,
              pressed && styles.rejoinButtonPressed,
            ]}
            onPress={onRejoin}
            accessibilityRole="button"
            accessibilityLabel="Rejoin conference"
          >
            <Ionicons name="arrow-forward-circle-outline" size={18} color={Colors.text.primary} />
            <Text style={styles.rejoinButtonText}>Rejoin</Text>
          </Pressable>
        )}
        <View style={styles.errorBranding}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Active Conference (Zoom Video SDK) ────────────────────────────────────────

function GuestActiveConference({
  token,
  topic,
  guestName,
  userChoices,
  onDisconnected,
  onError,
  onConnected,
}: {
  token: string;
  topic: string;
  guestName: string;
  userChoices: GuestUserChoices | null;
  onDisconnected: (reason?: string) => void;
  onError: (error: Error) => void;
  onConnected: () => void;
}) {
  return (
    <div
      className="aspire-guest-conference-root"
      style={{
        height: '100dvh',
        width: '100vw',
        background: Colors.background.primary,
        position: 'relative',
        // iOS Safari safe area insets for notched devices
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        // Prevent iOS rubber-band overscroll
        overflow: 'hidden',
        touchAction: 'manipulation',
      } as React.CSSProperties}
    >
      <ZoomConferenceProvider
        token={token}
        topic={topic}
        userName={guestName}
      >
        <GuestVideoConference userChoices={userChoices} onConnected={onConnected} onError={onError} />
        <GuestBadgeOverlay guestName={guestName} />
        <ZoomGuestControlBar onDisconnected={onDisconnected} />
      </ZoomConferenceProvider>
    </div>
  );
}

// ── Guest Badge Overlay ──────────────────────────────────────────────────────

function GuestBadgeOverlay({ guestName }: { guestName: string }) {
  return (
    <>
      {/* Guest badge — floating frosted pill, top-left */}
      <div
        className="guest-badge-overlay"
        role="status"
        aria-label={`Joined as guest: ${guestName}`}
        style={{
          position: 'absolute',
          top: Spacing.md,
          left: Spacing.md,
          zIndex: 10,
          background: GuestColors.guestBadgeBg,
          border: `1px solid ${GuestColors.guestBadgeBorder}`,
          borderRadius: BorderRadius.full,
          padding: `${Spacing.sm - 2}px ${Spacing.lg - 2}px`,
          display: 'flex',
          alignItems: 'center',
          gap: Spacing.sm,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'opacity 0.3s ease',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: Colors.accent.blue,
          display: 'inline-block',
          boxShadow: `0 0 6px ${Colors.accent.blueMedium}`,
        }} />
        <span style={{
          color: Colors.text.tertiary,
          fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.8px',
        }}>Guest</span>
        <span style={{ color: Colors.text.disabled, fontSize: 11 }}>|</span>
        <span style={{ color: Colors.text.secondary, fontSize: 11 }}>{guestName}</span>
      </div>

      {/* Powered by Aspire — bottom-left, above control bar */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 80,
          left: Spacing.lg,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: Spacing.sm - 2,
          opacity: 0.5,
          transition: 'opacity 0.3s ease',
        }}
      >
        <span style={{
          width: Spacing.xs, height: Spacing.xs,
          borderRadius: 2,
          background: Colors.accent.blue,
          display: 'inline-block',
        }} />
        <span style={{ color: Colors.text.muted, fontSize: 11 }}>Powered by Aspire</span>
      </div>
    </>
  );
}

// ── Nora AI Participant Tile ─────────────────────────────────────────────────
// Full participant tile for Nora (AI room assistant) in the guest conference grid.
// Matches the AvaTile from internal conference (conference-live.tsx):
// 180x180 inner glow box, cyan border, Aspire "A" logo, pulse animation,
// "Nora - Room Assistant" label with green status dot.

function NoraTile() {
  return (
    <div
      role="status"
      aria-label="Nora - AI Room Assistant"
      style={{
        position: 'relative' as const,
        overflow: 'hidden',
        borderRadius: '8px',
        border: '2px solid #3B82F6',
        background: '#000000',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}
    >
      {/* Inner glow box with animated pulse — matches avaInnerGlowBox */}
      <div style={{
        width: '180px',
        height: '180px',
        borderRadius: '12px',
        background: '#000000',
        border: '2px solid #3B82F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'noraPulse 2.4s ease-in-out infinite',
      }}>
        <Image
          source={avaLogoSrc}
          style={{ width: 140, height: 140 }}
          contentFit="contain"
        />
      </div>

      {/* Label row — matches avaLabelContainer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.9)',
          letterSpacing: '0.3px',
        }}>Nora - Room Assistant</span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '4px',
          background: '#4ade80',
          display: 'inline-block',
          boxShadow: '0 0 6px rgba(74, 222, 128, 0.5)',
        }} />
      </div>
    </div>
  );
}

// ── Custom Video Conference with Nora Tile (Zoom) ───────────────────────────
// Uses ZoomConferenceProvider context to render participant tiles in a grid,
// with the Nora AI tile injected to match the internal conference experience.

function GuestVideoConference({
  userChoices,
  onConnected,
  onError,
}: {
  userChoices: GuestUserChoices | null;
  onConnected: () => void;
  onError: (error: Error) => void;
}) {
  const participants = useZoomParticipants();
  const { stream } = useZoomContext();
  const hasConnectedRef = useRef(false);

  // Start audio/video after Zoom session connects
  useEffect(() => {
    if (!stream || hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    const init = async () => {
      try {
        const audioEnabled = userChoices?.audioEnabled ?? true;
        const videoEnabled = userChoices?.videoEnabled ?? true;
        if (audioEnabled) await stream.startAudio();
        if (videoEnabled) await stream.startVideo();
        onConnected();
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error('Failed to start media');
        onError(error);
      }
    };
    init();
  }, [stream, userChoices, onConnected, onError]);

  const tileCount = participants.length + 1; // +1 for Nora tile

  // Grid columns: 1 col for solo, 2 cols for 2-4 tiles, 3 cols for 5-9, 4 for more
  const cols = tileCount <= 1 ? 1 : tileCount <= 4 ? 2 : tileCount <= 9 ? 3 : 4;

  return (
    <div style={{
      position: 'relative' as const,
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    }}>
      {/* Video grid: participants + Nora */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '1fr',
          gap: '0.25rem',
          padding: '0.25rem',
        }}
      >
        {participants.map((participant: ZoomParticipant) => (
          <ZoomVideoTile key={participant.userId} participant={participant} />
        ))}
        <NoraTile />
      </div>
    </div>
  );
}

// ── Guest Control Bar (Zoom) ────────────────────────────────────────────────

function ZoomGuestControlBar({
  onDisconnected,
}: {
  onDisconnected: (reason?: string) => void;
}) {
  const { stream, client } = useZoomContext();
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const toggleMic = useCallback(async () => {
    if (!stream) return;
    try {
      if (micMuted) {
        await stream.unmuteAudio();
      } else {
        await stream.muteAudio();
      }
      setMicMuted((v) => !v);
    } catch (_e: unknown) {
      // Non-fatal — user can retry
    }
  }, [stream, micMuted]);

  const toggleCam = useCallback(async () => {
    if (!stream) return;
    try {
      if (camOff) {
        await stream.startVideo();
      } else {
        await stream.stopVideo();
      }
      setCamOff((v) => !v);
    } catch (_e: unknown) {
      // Non-fatal — user can retry
    }
  }, [stream, camOff]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (client) await client.leave();
    } catch (_e: unknown) {
      // Best-effort leave
    }
    onDisconnected('You have left the conference.');
  }, [client, onDisconnected]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      {/* Mic toggle */}
      <button
        type="button"
        onClick={toggleMic}
        aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          border: 'none',
          background: micMuted ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={micMuted ? 'mic-off' : 'mic'}
          size={22}
          color={micMuted ? Colors.semantic.error : Colors.text.primary}
        />
      </button>

      {/* Camera toggle */}
      <button
        type="button"
        onClick={toggleCam}
        aria-label={camOff ? 'Turn on camera' : 'Turn off camera'}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          border: 'none',
          background: camOff ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={camOff ? 'videocam-off' : 'videocam'}
          size={22}
          color={camOff ? Colors.semantic.error : Colors.text.primary}
        />
      </button>

      {/* Disconnect */}
      <button
        type="button"
        onClick={handleDisconnect}
        aria-label="Leave conference"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          border: 'none',
          background: 'rgba(255, 59, 48, 0.8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function GuestJoinContent() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [disconnectReason, setDisconnectReason] = useState('');
  const [userChoices, setUserChoices] = useState<GuestUserChoices | null>(null);

  // Inject styles + mobile viewport on mount
  useEffect(() => {
    ensureMobileViewport();
    injectGuestKeyframes();
    if (Platform.OS === 'web') {
      injectZoomStyles();
    }
  }, []);

  // Step 1: Validate join code exists (loading → prejoin or error)
  useEffect(() => {
    if (!code) {
      setPageState('invalid');
      setErrorMessage('No join code provided');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`${API_BASE}/api/conference/join/${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (res.status === 404) {
          setPageState('invalid');
          return null;
        }
        if (res.status === 410) {
          setPageState('expired');
          return null;
        }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data: JoinResponse | null) => {
        if (!data) return;
        if (!data.token) {
          setPageState('error');
          setErrorMessage('Invalid response from server');
          return;
        }
        // Store initial data but go to PreJoin for name entry
        setJoinData(data);
        setPageState('prejoin');
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setPageState('error');
          setErrorMessage('Connection timed out. Please check your network and try again.');
          return;
        }
        setPageState('error');
        setErrorMessage(err.message || 'Failed to join conference');
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [code]);

  // Step 2: PreJoin submit → fetch token with guest's chosen name → connect
  const handlePreJoinSubmit = useCallback(async (choices: GuestUserChoices) => {
    setUserChoices(choices);
    setPageState('connecting');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(
        `${API_BASE}/api/conference/join/${encodeURIComponent(code!)}?name=${encodeURIComponent(choices.username)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (res.status === 410) {
        setPageState('expired');
        return;
      }
      if (res.status === 404) {
        setPageState('invalid');
        return;
      }
      if (!res.ok) throw new Error('Failed to get conference token');

      const data: JoinResponse = await res.json();
      setJoinData(data);
      // Move to 'active' — ZoomConferenceProvider mounts and handles session join.
      setPageState('active');
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMessage('Connection timed out. Please check your network and try again.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to join conference';
        setErrorMessage(msg);
      }
      setPageState('error');
    }
  }, [code]);

  // Handle PreJoin device errors (camera/mic permission denied)
  const handleDeviceError = useCallback((error: Error) => {
    // Don't crash — prejoin will still render with camera-off placeholder.
    reportProviderError({ provider: 'zoom', action: 'guest_device_error', error, component: 'GuestJoinPage' });
  }, []);

  // Zoom session event handlers
  const handleConnected = useCallback(() => {
    setPageState('active');
  }, []);

  const handleDisconnected = useCallback((reason?: string) => {
    const message = reason || 'You have left the conference.';
    setDisconnectReason(message);
    setPageState('disconnected');
  }, []);

  const handleRoomError = useCallback((error: Error) => {
    reportProviderError({ provider: 'zoom', action: 'guest_room_error', error, component: 'GuestJoinPage' });
    setErrorMessage(error.message || 'A connection error occurred.');
    setPageState('error');
  }, []);

  // Retry handler — reload the page to re-validate join code and start fresh
  const handleRetry = useCallback(() => {
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  }, []);

  // Rejoin handler — go back to PreJoin so guest can recheck devices
  const handleRejoin = useCallback(() => {
    if (joinData) {
      setDisconnectReason('');
      setPageState('prejoin');
    }
  }, [joinData]);

  return (
    <View style={styles.page}>
      {pageState === 'loading' && <LoadingView />}

      {pageState === 'prejoin' && (
        <GuestPreJoin
          onJoin={handlePreJoinSubmit}
          onDeviceError={handleDeviceError}
        />
      )}

      {pageState === 'connecting' && <ConnectingView />}

      {pageState === 'active' && joinData && (
        <GuestActiveConference
          token={joinData.token}
          topic={joinData.topic || joinData.roomName}
          guestName={joinData.guestName}
          userChoices={userChoices}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleRoomError}
        />
      )}

      {pageState === 'disconnected' && (
        <DisconnectedView
          reason={disconnectReason}
          onRejoin={joinData ? handleRejoin : null}
        />
      )}

      {(pageState === 'expired' || pageState === 'invalid' || pageState === 'error') && (
        <ErrorView state={pageState} message={errorMessage} onRetry={handleRetry} />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────


export default function GuestJoinPage() {
  return (
    <PageErrorBoundary pageName="join-conference">
      <GuestJoinContent />
    </PageErrorBoundary>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: GuestColors.canvas,
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%)',
    } as unknown as ViewStyle : {}),
  },

  // ── Center container (loading + error) ──
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },

  // ── Loading — multi-layer concentric rings ──
  ringOutermost: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.06)',
  },
  ringOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: GuestColors.ringPulse,
  },
  ringDashed: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
    borderStyle: 'dashed',
  },
  ringInnerAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.06)',
    borderStyle: 'dotted',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl + Spacing.lg, /* 48px — visual separation between orb and text */
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: '30%' as unknown as number,
  },
  loadingTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  loadingDotRow: {
    flexDirection: 'row',
    gap: Spacing.sm - 2, /* 6px — tight spacing between loading indicator dots */
    marginBottom: Spacing.md,
  },
  loadingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
  },
  loadingSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // ── Error — premium card with accent stripe ──
  errorCard: {
    backgroundColor: GuestColors.errorCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xxxl,
    paddingTop: Spacing.xxxl + 4,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%' as unknown as number,
    overflow: 'hidden',
    position: 'relative',
  },
  errorAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  errorIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  errorTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  errorSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: Spacing.xxl,
  },
  errorBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    width: '100%' as unknown as number,
    justifyContent: 'center',
  },
  brandingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  brandingText: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // ── PreJoin lobby ──
  prejoinContainer: {
    flex: 1,
    backgroundColor: GuestColors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  prejoinHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  prejoinIconRow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  prejoinTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  prejoinSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 320,
  },
  prejoinFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm - 2, /* 6px — compact branding footer spacing */
    marginTop: Spacing.xxl,
    opacity: 0.4,
  },

  // ── Retry button (error state) ──
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    minHeight: 44, /* a11y minimum tap target */
  },
  retryButtonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  retryButtonText: {
    ...Typography.small,
    color: Colors.text.primary,
    fontWeight: '500' as const,
  },

  // ── Rejoin button (disconnected state) ──
  rejoinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    minHeight: 44, /* a11y minimum tap target */
  },
  rejoinButtonPressed: {
    opacity: 0.8,
  },
  rejoinButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600' as const,
  },

  // ── Shared branding elements ──
  brandingDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
  },
  brandingFooterText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
});
