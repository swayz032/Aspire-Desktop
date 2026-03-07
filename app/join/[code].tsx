/**
 * Guest Join Page — Public, NO auth required.
 *
 * External guests receive a link like /join/{code} and land on this page
 * to join a LiveKit conference room. The join code is resolved via
 * GET /api/conference/join/:code (a PUBLIC endpoint).
 *
 * Flow: loading → prejoin (name + device preview) → active (full conference)
 * Error states: expired (410) | invalid (404) | error
 *
 * Uses LiveKit's official prefab components:
 * - PreJoin: name entry + camera/mic preview (before connecting)
 * - VideoConference: full conference UI (grid, controls, chat, screen share)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  PreJoin,
} from '@livekit/components-react';
import { VideoPreset } from 'livekit-client';
import { injectLiveKitStyles } from '@/lib/livekit-styles';

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinResponse {
  token: string;
  roomName: string;
  guestName: string;
  serverUrl: string;
}

/** PreJoin onSubmit returns these user choices */
interface PreJoinChoices {
  username: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
}

type PageState = 'loading' | 'prejoin' | 'active' | 'expired' | 'invalid' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// ── Guest-specific color refinements ─────────────────────────────────────────

const GuestColors = {
  canvas: '#060608',
  guestBadgeBg: 'rgba(59, 130, 246, 0.08)',
  guestBadgeBorder: 'rgba(59, 130, 246, 0.18)',
  ringPulse: 'rgba(59, 130, 246, 0.25)',
  errorCard: '#111114',
  errorCardBorder: '#1e1e22',
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
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
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
        Animated.timing(breatheAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.centerContainer, { opacity: fadeIn }]}>
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
        <Text style={styles.loadingTitle}>Joining Conference</Text>
        <View style={styles.loadingDotRow}>
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

function ErrorView({ state, message }: { state: 'expired' | 'invalid' | 'error'; message: string }) {
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const config = {
    expired: {
      icon: 'time-outline' as const,
      title: 'Link Expired',
      subtitle: 'This conference link is no longer valid. Join links expire after 60 minutes.',
      iconColor: Colors.semantic.warning,
      borderColor: 'rgba(212, 160, 23, 0.2)',
    },
    invalid: {
      icon: 'close-circle-outline' as const,
      title: 'Invalid Link',
      subtitle: 'This conference link could not be found. It may have already been used or the code is incorrect.',
      iconColor: Colors.semantic.error,
      borderColor: 'rgba(255, 59, 48, 0.15)',
    },
    error: {
      icon: 'warning-outline' as const,
      title: 'Connection Error',
      subtitle: message || 'Something went wrong while joining the conference. Please try again.',
      iconColor: Colors.semantic.error,
      borderColor: 'rgba(255, 59, 48, 0.15)',
    },
  }[state];

  return (
    <Animated.View style={[styles.centerContainer, { opacity: fadeIn }]}>
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
        />
        <View
          style={[
            styles.errorIconRing,
            { borderColor: config.borderColor },
            Platform.OS === 'web' ? {
              boxShadow: `0 0 24px ${config.iconColor}20, inset 0 0 12px ${config.iconColor}08`,
            } as unknown as ViewStyle : undefined,
          ]}
        >
          <Ionicons name={config.icon} size={36} color={config.iconColor} />
        </View>
        <Text style={styles.errorTitle}>{config.title}</Text>
        <Text style={styles.errorSubtitle}>{config.subtitle}</Text>
        <View style={styles.errorBranding}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── PreJoin Lobby ─────────────────────────────────────────────────────────────

function GuestPreJoin({ onJoin }: { onJoin: (choices: PreJoinChoices) => void }) {
  return (
    <View style={styles.prejoinContainer}>
      {/* Aspire branding header */}
      <View style={styles.prejoinHeader}>
        <View style={styles.prejoinIconRow}>
          <Ionicons name="videocam" size={24} color={Colors.accent.cyan} />
        </View>
        <Text style={styles.prejoinTitle}>Aspire Conference</Text>
        <Text style={styles.prejoinSubtitle}>
          Enter your name and check your devices before joining
        </Text>
      </View>

      {/* LiveKit PreJoin — handles camera preview, mic/cam toggles, device menus, username input */}
      <div
        data-lk-theme="default"
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
        }}
      >
        <PreJoin
          defaults={{ username: '', audioEnabled: true, videoEnabled: true }}
          onSubmit={onJoin}
          joinLabel="Join Conference"
          userLabel="Your Name"
          onValidate={(values) => values.username.trim().length >= 2}
        />
      </div>

      {/* Footer branding */}
      <View style={styles.prejoinFooter}>
        <View style={styles.brandingDotSmall} />
        <Text style={styles.brandingFooterText}>Powered by Aspire</Text>
      </View>
    </View>
  );
}

// ── Active Conference (Full LiveKit Prefab) ──────────────────────────────────

function GuestActiveConference({
  token,
  serverUrl,
  guestName,
}: {
  token: string;
  serverUrl: string;
  guestName: string;
}) {
  return (
    <div
      data-lk-theme="default"
      style={{
        height: '100vh',
        width: '100vw',
        background: '#0a0a0c',
        position: 'relative',
      }}
    >
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        audio={true}
        video={true}
        style={{ height: '100%', width: '100%' }}
        options={{
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1920, height: 1080, frameRate: 30 },
            facingMode: 'user',
          },
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          publishDefaults: {
            videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
            simulcast: true,
            videoSimulcastLayers: [
              new VideoPreset(1280, 720, 1_500_000, 30),
              new VideoPreset(640, 360, 400_000, 24),
            ],
            screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 15 },
            screenShareSimulcastLayers: [],
            dtx: true,
            red: true,
            audioPreset: { maxBitrate: 48_000 },
          },
        }}
      >
        <VideoConference />
        <RoomAudioRenderer />
        <GuestBadgeOverlay guestName={guestName} />
      </LiveKitRoom>
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
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.18)',
          borderRadius: 20,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#3B82F6', display: 'inline-block' }} />
        <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Guest</span>
        <span style={{ color: '#4B5563', fontSize: 11 }}>|</span>
        <span style={{ color: '#D1D5DB', fontSize: 11 }}>{guestName}</span>
      </div>

      {/* Powered by Aspire — bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 16,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: 0.5,
      }}>
        <span style={{ width: 4, height: 4, borderRadius: 2, background: '#3B82F6', display: 'inline-block' }} />
        <span style={{ color: '#6B7280', fontSize: 11 }}>Powered by Aspire</span>
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function GuestJoinPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Inject styles + mobile viewport on mount
  useEffect(() => {
    ensureMobileViewport();
    injectGuestKeyframes();
    if (Platform.OS === 'web') {
      injectLiveKitStyles();
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
        if (!data.serverUrl) {
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
  const handlePreJoinSubmit = async (choices: PreJoinChoices) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/conference/join/${encodeURIComponent(code!)}?name=${encodeURIComponent(choices.username)}`
      );
      if (!res.ok) throw new Error('Failed to get conference token');
      const data: JoinResponse = await res.json();
      setJoinData(data);
      setPageState('active');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join conference';
      setErrorMessage(msg);
      setPageState('error');
    }
  };

  return (
    <View style={styles.page}>
      {pageState === 'loading' && <LoadingView />}

      {pageState === 'prejoin' && (
        <GuestPreJoin onJoin={handlePreJoinSubmit} />
      )}

      {pageState === 'active' && joinData && (
        <GuestActiveConference
          token={joinData.token}
          serverUrl={joinData.serverUrl}
          guestName={joinData.guestName}
        />
      )}

      {(pageState === 'expired' || pageState === 'invalid' || pageState === 'error') && (
        <ErrorView state={pageState} message={errorMessage} />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
    marginBottom: 48,
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
    gap: 6,
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
    gap: 6,
    marginTop: Spacing.xxl,
    opacity: 0.4,
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
