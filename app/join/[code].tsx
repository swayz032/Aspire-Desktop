/**
 * Guest Join Page — Public, NO auth required.
 *
 * External guests receive a link like /join/{code} and land on this page
 * to join a LiveKit conference room. The join code is resolved to a LiveKit
 * token via GET /api/conference/join/:code (a PUBLIC endpoint).
 *
 * States: loading -> active | expired (410) | invalid (404) | error
 *
 * Design: "Control Room" — utilitarian dark interface with floating control
 * island, frosted guest badge, and breathing ring loader. Guest-only: no
 * chat drawer, no authority queue, no Ava tile.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { LiveKitConferenceProvider } from '@/components/session/LiveKitConferenceProvider';
import { LiveKitVideoTile } from '@/components/session/LiveKitVideoTile';
import { useParticipants, useTracks, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinResponse {
  token: string;
  roomName: string;
  guestName: string;
  serverUrl: string;
}

type PageState = 'loading' | 'active' | 'expired' | 'invalid' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// ── Guest-specific color refinements ─────────────────────────────────────────

const GuestColors = {
  canvas: '#060608',
  controlIsland: 'rgba(20, 20, 22, 0.92)',
  controlIslandBorder: 'rgba(255, 255, 255, 0.06)',
  guestBadgeBg: 'rgba(59, 130, 246, 0.08)',
  guestBadgeBorder: 'rgba(59, 130, 246, 0.18)',
  ringPulse: 'rgba(59, 130, 246, 0.25)',
  errorCard: '#111114',
  errorCardBorder: '#1e1e22',
} as const;

// ── Web Keyframes ────────────────────────────────────────────────────────────

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
    .guest-control-btn {
      transition: all 0.15s ease !important;
    }
    .guest-control-btn:hover {
      background-color: rgba(255, 255, 255, 0.08) !important;
      transform: scale(1.06);
    }
    .guest-control-btn:active {
      transform: scale(0.95);
    }
    .guest-leave-btn {
      transition: all 0.15s ease !important;
    }
    .guest-leave-btn:hover {
      background-color: rgba(255, 59, 48, 0.9) !important;
      transform: scale(1.06);
      box-shadow: 0 4px 16px rgba(255, 59, 48, 0.3);
    }
    .guest-leave-btn:active {
      transform: scale(0.95);
    }
  `;
  document.head.appendChild(style);
}

// ── LiveKit Sync (same pattern as conference-live.tsx) ────────────────────────

interface LiveKitSyncData {
  participants: ReturnType<typeof useParticipants>;
  videoTracks: TrackReferenceOrPlaceholder[];
  room: ReturnType<typeof useRoomContext> | null;
}

function LiveKitSync({ onSync }: { onSync: (data: LiveKitSyncData) => void }) {
  const participants = useParticipants();
  const videoTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
  );
  let room: ReturnType<typeof useRoomContext> | null = null;
  try {
    room = useRoomContext();
  } catch {
    // Room context not ready yet
  }

  useEffect(() => {
    onSync({ participants, videoTracks, room });
  }, [participants, videoTracks, room]);

  return null;
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingView() {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing ring animation (native fallback)
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    ).start();

    // Fade in the content
    Animated.timing(fadeIn, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.centerContainer, { opacity: fadeIn }]}>
      {/* Outermost ring — very diffuse, slowest pulse */}
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

      {/* Pulsing outer ring — primary breathing ring */}
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

      {/* Rotating dashed ring — orbital track */}
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

      {/* Counter-rotating inner accent ring */}
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

      {/* Center logo area — Aspire brand mark with glow */}
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

      {/* Status text */}
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
      subtitle: 'This conference link is no longer valid. Join links expire after 10 minutes.',
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
        {/* Top accent gradient stripe — color-coded by error type */}
        <View
          style={[
            styles.errorAccentStripe,
            { background: `linear-gradient(90deg, ${config.iconColor}40, transparent)` } as unknown as ViewStyle,
          ]}
          accessibilityElementsHidden
        />

        {/* Icon ring with glow */}
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

        {/* Aspire branding footer */}
        <View style={styles.errorBranding}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Active Conference (Guest View) ───────────────────────────────────────────

interface GuestConferenceProps {
  guestName: string;
  roomName: string;
  token: string;
  serverUrl: string;
}

function GuestConference({ guestName, roomName, token, serverUrl }: GuestConferenceProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [lkParticipants, setLkParticipants] = useState<ReturnType<typeof useParticipants>>([]);
  const [lkVideoTracks, setLkVideoTracks] = useState<TrackReferenceOrPlaceholder[]>([]);
  const [lkRoom, setLkRoom] = useState<ReturnType<typeof useRoomContext> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const controlsFadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(controlsFadeIn, { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }).start();
  }, []);

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLiveKitSync = useCallback((data: LiveKitSyncData) => {
    setLkParticipants(data.participants);
    setLkVideoTracks(data.videoTracks);
    setLkRoom(data.room);
  }, []);

  // Build track reference map for video tiles
  const trackRefMap = new Map<string, TrackReferenceOrPlaceholder>();
  for (const tr of lkVideoTracks) {
    if (tr.source === Track.Source.Camera && tr.participant) {
      trackRefMap.set(tr.participant.identity, tr);
    }
  }

  // Toggle mute via LiveKit room
  const toggleMute = useCallback(() => {
    if (lkRoom) {
      try {
        const newMuted = !isMuted;
        lkRoom.localParticipant.setMicrophoneEnabled(!newMuted);
        setIsMuted(newMuted);
      } catch (_e) {
        // Silent fail — Law #3 fail closed, no side effects
      }
    }
  }, [lkRoom, isMuted]);

  const toggleVideo = useCallback(() => {
    if (lkRoom) {
      try {
        const newOff = !isVideoOff;
        lkRoom.localParticipant.setCameraEnabled(!newOff);
        setIsVideoOff(newOff);
      } catch (_e) {
        // Silent fail
      }
    }
  }, [lkRoom, isVideoOff]);

  const leaveRoom = useCallback(() => {
    if (lkRoom) {
      try {
        lkRoom.disconnect();
      } catch (_e) {
        // Silent fail
      }
    }
    // Navigate away — close tab for guests
    if (Platform.OS === 'web') {
      window.close();
      // If window.close() doesn't work (not opened by script), show a message
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#6e6e73;font-family:system-ui;font-size:16px;">You have left the conference. You may close this tab.</div>';
    }
  }, [lkRoom]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Compute grid layout based on participant count
  const participantCount = lkParticipants.length || 1;
  const gridCols = participantCount <= 1 ? 1 : participantCount <= 4 ? 2 : participantCount <= 9 ? 3 : 4;

  return (
    <LiveKitConferenceProvider token={token} serverUrl={serverUrl}>
      <LiveKitSync onSync={handleLiveKitSync} />

      <View style={styles.conferenceContainer}>
        {/* Guest badge — floating frosted pill, top-left */}
        <View
          style={[
            styles.guestBadge,
            Platform.OS === 'web' ? {
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              animationName: 'guestFadeInUp',
              animationDuration: '0.4s',
              animationFillMode: 'both',
            } as unknown as ViewStyle : undefined,
          ]}
        >
          <View style={styles.guestBadgeDot} />
          <Text style={styles.guestBadgeText}>Guest</Text>
          <Text style={styles.guestBadgeSep}>|</Text>
          <Text style={styles.guestBadgeName} numberOfLines={1}>{guestName}</Text>
        </View>

        {/* Room info — top-right */}
        <View
          style={[
            styles.roomInfoBadge,
            Platform.OS === 'web' ? {
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              animationName: 'guestFadeInUp',
              animationDuration: '0.4s',
              animationDelay: '0.1s',
              animationFillMode: 'both',
            } as unknown as ViewStyle : undefined,
          ]}
        >
          <View style={styles.liveDot} />
          <Text style={styles.roomInfoTime}>{formatTime(elapsed)}</Text>
          <Text style={styles.roomInfoSep}>|</Text>
          <Ionicons name="people" size={12} color={Colors.text.tertiary} />
          <Text style={styles.roomInfoCount}>{participantCount}</Text>
        </View>

        {/* Video grid — full bleed */}
        <View style={styles.videoGrid}>
          <View style={[styles.videoGridInner, { flexWrap: 'wrap' }]}>
            {lkParticipants.length > 0 ? (
              lkParticipants.map(p => {
                const trackRef = trackRefMap.get(p.identity);
                return (
                  <View
                    key={p.identity}
                    style={[
                      styles.videoTileWrapper,
                      {
                        width: `${100 / gridCols}%` as unknown as number,
                        height: gridCols <= 2 ? '50%' as unknown as number : `${100 / Math.ceil(participantCount / gridCols)}%` as unknown as number,
                      },
                    ]}
                  >
                    <View style={styles.videoTileInner}>
                      <LiveKitVideoTile
                        trackRef={trackRef}
                        name={p.name || p.identity}
                        isLocal={p.isLocal}
                        size="normal"
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              // Waiting for participants — show placeholder
              <View style={styles.waitingContainer}>
                <Ionicons name="hourglass-outline" size={28} color={Colors.text.muted} />
                <Text style={styles.waitingTitle}>Connecting to room</Text>
                <Text style={styles.waitingSubtitle}>Waiting for other participants</Text>
              </View>
            )}
          </View>
        </View>

        {/* Floating control island — bottom center */}
        <Animated.View
          style={[
            styles.controlIsland,
            { opacity: controlsFadeIn },
            Platform.OS === 'web' ? {
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            } as unknown as ViewStyle : undefined,
          ]}
        >
          {/* Mute toggle */}
          <Pressable
            style={({ pressed }) => [
              styles.controlBtn,
              isMuted && styles.controlBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={toggleMute}
            {...(Platform.OS === 'web' ? { className: 'guest-control-btn' } as Record<string, string> : {})}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={20}
              color={isMuted ? Colors.semantic.error : Colors.text.primary}
            />
          </Pressable>

          {/* Video toggle */}
          <Pressable
            style={({ pressed }) => [
              styles.controlBtn,
              isVideoOff && styles.controlBtnActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={toggleVideo}
            {...(Platform.OS === 'web' ? { className: 'guest-control-btn' } as Record<string, string> : {})}
          >
            <Ionicons
              name={isVideoOff ? 'videocam-off' : 'videocam'}
              size={20}
              color={isVideoOff ? Colors.semantic.error : Colors.text.primary}
            />
          </Pressable>

          {/* Divider */}
          <View style={styles.controlDivider} />

          {/* Leave */}
          <Pressable
            style={({ pressed }) => [
              styles.leaveBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={leaveRoom}
            {...(Platform.OS === 'web' ? { className: 'guest-leave-btn' } as Record<string, string> : {})}
          >
            <Ionicons name="call" size={18} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </Pressable>
        </Animated.View>

        {/* Aspire branding — bottom-left subtle */}
        <View style={styles.brandingFooter}>
          <View style={styles.brandingDotSmall} />
          <Text style={styles.brandingFooterText}>Powered by Aspire</Text>
        </View>
      </View>
    </LiveKitConferenceProvider>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function GuestJoinPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Inject web keyframes on mount
  useEffect(() => {
    injectGuestKeyframes();
  }, []);

  // Resolve join code on mount
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
        if (!data.token || !data.serverUrl) {
          setPageState('error');
          setErrorMessage('Invalid response from server');
          return;
        }
        setJoinData(data);
        setPageState('active');
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

  return (
    <View style={styles.page}>
      {pageState === 'loading' && <LoadingView />}

      {(pageState === 'expired' || pageState === 'invalid' || pageState === 'error') && (
        <ErrorView state={pageState} message={errorMessage} />
      )}

      {pageState === 'active' && joinData && (
        <GuestConference
          guestName={joinData.guestName}
          roomName={joinData.roomName}
          token={joinData.token}
          serverUrl={joinData.serverUrl}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: GuestColors.canvas,
    // Subtle radial vignette at edges for depth on web
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
    paddingTop: Spacing.xxxl + 4, // Account for accent stripe
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

  // ── Conference ──
  conferenceContainer: {
    flex: 1,
    backgroundColor: GuestColors.canvas,
  },

  // Guest badge — top-left floating pill
  guestBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GuestColors.guestBadgeBg,
    borderWidth: 1,
    borderColor: GuestColors.guestBadgeBorder,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  guestBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  guestBadgeText: {
    ...Typography.micro,
    color: Colors.accent.cyan,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  guestBadgeSep: {
    ...Typography.micro,
    color: 'rgba(59, 130, 246, 0.25)',
  },
  guestBadgeName: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
    maxWidth: 160,
  },

  // Room info — top-right
  roomInfoBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 20, 22, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  roomInfoTime: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  roomInfoSep: {
    ...Typography.micro,
    color: 'rgba(255, 255, 255, 0.1)',
  },
  roomInfoCount: {
    ...Typography.smallMedium,
    color: Colors.text.tertiary,
  },

  // Video grid
  videoGrid: {
    flex: 1,
    padding: 4,
  },
  videoGridInner: {
    flex: 1,
    flexDirection: 'row',
  },
  videoTileWrapper: {
    padding: 3,
  },
  videoTileInner: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  waitingTitle: {
    ...Typography.bodyMedium,
    color: Colors.text.secondary,
  },
  waitingSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Floating control island — frosted glass pill
  controlIsland: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GuestColors.controlIsland,
    borderWidth: 1,
    borderColor: GuestColors.controlIslandBorder,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 6,
    // Center horizontally
    left: '50%' as unknown as number,
    transform: [{ translateX: -120 }],
    // Premium shadow for floating island
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
    } as unknown as ViewStyle : {}),
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  controlDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: 4,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.semantic.error,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease', cursor: 'pointer' } as unknown as ViewStyle : {}),
  },
  leaveBtnText: {
    ...Typography.smallMedium,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Branding footer
  brandingFooter: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.4,
  },
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
