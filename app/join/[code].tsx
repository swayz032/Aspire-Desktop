/**
 * Guest Join Page — Public, NO auth required.
 *
 * External guests receive a link like /join/{code} and land on this page.
 * Join code resolved via GET /api/conference/join/:code (PUBLIC endpoint).
 *
 * Uses the SAME custom Aspire conference components as the internal host view:
 * ZoomConferenceProvider, ZoomVideoTile, NoraTile, ConferenceHeader,
 * ConferenceControlBar, ConferenceCaptions.
 *
 * Nora is a full video grid tile — NOT a sidebar.
 * Recording is hidden (guests can't record).
 * Auto-joins when token is ready (no pre-join step).
 *
 * Flow: loading → conference (auto-join) → disconnected
 * Error states: expired (410) | invalid (404) | error
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { reportProviderError } from '@/lib/providerErrorReporter';
import { injectZoomStyles } from '@/lib/zoom-styles';
import { injectGuestTheme } from '@/lib/zoom-guest-theme';
import { useGuestNoraState } from '@/hooks/useGuestNoraState';

// Zoom SDK components — same as host internal conference
import {
  ZoomConferenceProvider,
  useZoomContext,
  useZoomParticipants,
  useZoomActiveSpeaker,
} from '@/components/session/ZoomConferenceProvider';
import type { ZoomParticipant } from '@/components/session/ZoomConferenceProvider';
import { ZoomVideoTile } from '@/components/session/ZoomVideoTile';
import { ConferenceHeader } from '@/components/session/ConferenceHeader';
import { ConferenceControlBar } from '@/components/session/ConferenceControlBar';
import { NoraTile } from '@/components/session/NoraTile';
import { ConferenceCaptions } from '@/components/session/ConferenceCaptions';
import { ConferenceSettingsPanel } from '@/components/session/ConferenceSettingsPanel';

// Hooks
import { useConferenceTimer } from '@/hooks/useConferenceTimer';
import { useConferenceControls } from '@/hooks/useConferenceControls';

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinResponse {
  token: string;
  topic?: string;
  roomName: string;
  guestName: string;
}

type PageState = 'loading' | 'ready' | 'joining' | 'joined' | 'disconnected' | 'expired' | 'invalid' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

// ── Web Setup ────────────────────────────────────────────────────────────────

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
  if (document.getElementById('aspire-guest-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'aspire-guest-keyframes';
  style.textContent = `
    @keyframes guestRingPulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.18); opacity: 0.15; }
    }
    @keyframes guestBreatheDot {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.3); }
    }
    @keyframes guestCardEntrance {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes guestGlowPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.08); }
      50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.15), 0 0 80px rgba(59, 130, 246, 0.05); }
    }
    html, body { overscroll-behavior: none; }
  `;
  document.head.appendChild(style);
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <View style={styles.centerContainer} accessibilityRole="progressbar" accessibilityLabel="Joining conference">
      <View style={styles.ringContainer}>
        <View style={styles.ringOuter} />
        <View style={styles.ringDashed} />
        <View style={styles.logoContainer}>
          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
        </View>
      </View>
      <Text style={styles.loadingTitle}>Joining Conference</Text>
      <Text style={styles.loadingSubtitle}>Preparing your secure connection</Text>
      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[styles.breatheDot,
              Platform.OS === 'web' ? {
                animationName: 'guestBreatheDot',
                animationDuration: '1.2s',
                animationIterationCount: 'infinite',
                animationDelay: `${i * 0.2}s`,
              } as unknown as ViewStyle : {},
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Error / Expired / Invalid States ─────────────────────────────────────────

function ErrorView({
  state,
  message,
  onRetry,
}: {
  state: 'expired' | 'invalid' | 'error';
  message: string;
  onRetry: () => void;
}) {
  const config = {
    expired: {
      icon: 'time-outline' as const,
      title: 'Link Expired',
      desc: 'This conference link has expired. Links are valid for 60 minutes.',
      color: Colors.semantic.warning,
    },
    invalid: {
      icon: 'close-circle-outline' as const,
      title: 'Link Not Found',
      desc: 'This conference link is invalid or has already been used.',
      color: Colors.semantic.error,
    },
    error: {
      icon: 'cloud-offline-outline' as const,
      title: 'Connection Error',
      desc: message || 'Unable to connect. Please check your network.',
      color: Colors.semantic.error,
    },
  }[state];

  return (
    <View style={styles.centerContainer} accessibilityRole="alert">
      <View style={styles.errorCard}>
        <View style={[styles.errorIconCircle, { backgroundColor: config.color + '14' }]}>
          <Ionicons name={config.icon} size={32} color={config.color} />
        </View>
        <Text style={styles.errorTitle}>{config.title}</Text>
        <Text style={styles.errorDesc}>{config.desc}</Text>
        {state === 'error' && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry connection"
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        )}
        <View style={styles.brandingRow}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </View>
  );
}

// ── Disconnected State ───────────────────────────────────────────────────────

function DisconnectedView({ onRejoin }: { onRejoin: (() => void) | null }) {
  return (
    <View style={styles.centerContainer} accessibilityLabel="Conference ended">
      <View style={[styles.errorCard, { borderColor: 'rgba(52, 199, 89, 0.20)' }]}>
        <View style={[styles.errorIconCircle, { backgroundColor: 'rgba(52, 199, 89, 0.10)' }]}>
          <Ionicons name="checkmark-circle-outline" size={32} color={Colors.semantic.success} />
        </View>
        <Text style={styles.errorTitle}>Session Ended</Text>
        <Text style={styles.errorDesc}>You have left the conference. Thank you for joining.</Text>
        {onRejoin && (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            onPress={onRejoin}
            accessibilityRole="button"
            accessibilityLabel="Rejoin conference"
          >
            <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" />
            <Text style={styles.retryText}>Rejoin</Text>
          </Pressable>
        )}
        <View style={styles.brandingRow}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </View>
  );
}

// ── Name Entry (Pre-Join) ────────────────────────────────────────────────────

function NameEntryView({
  defaultName,
  roomName,
  onJoin,
}: {
  defaultName: string;
  roomName: string;
  onJoin: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const isValid = name.trim().length >= 1;

  const handleSubmit = () => {
    if (isValid) onJoin(name.trim());
  };

  return (
    <View style={styles.centerContainer}>
      <View style={styles.nameEntryCard}>
        {/* Header */}
        <View style={styles.nameEntryHeader}>
          <View style={styles.nameEntryIcon}>
            <Ionicons name="videocam" size={24} color={Colors.accent.cyan} />
          </View>
          <Text style={styles.nameEntryTitle}>Join Conference</Text>
          <Text style={styles.nameEntrySubtitle}>{roomName}</Text>
        </View>

        {/* Name input */}
        <View style={styles.nameInputSection}>
          <Text style={styles.nameInputLabel}>Your Name</Text>
          {Platform.OS === 'web' ? (
            <input
              type="text"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              onKeyDown={(e: any) => { if (e.key === 'Enter' && isValid) handleSubmit(); }}
              placeholder="Enter your name"
              maxLength={50}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                backgroundColor: '#1C1C1E',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '500',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box' as const,
              }}
              onFocus={(e: any) => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
              onBlur={(e: any) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
          ) : (
            <View style={styles.nameInputFallback}>
              <Text style={styles.nameInputFallbackText}>{name}</Text>
            </View>
          )}
        </View>

        {/* Join button */}
        <Pressable
          style={({ pressed }) => [
            styles.joinButton,
            !isValid && styles.joinButtonDisabled,
            pressed && isValid && styles.joinButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!isValid}
          accessibilityRole="button"
          accessibilityLabel="Join conference"
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
          <Text style={styles.joinButtonText}>Join Conference</Text>
        </Pressable>

        {/* Branding */}
        <View style={styles.brandingRow}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </View>
  );
}

// ── Guest Conference Content (inside ZoomConferenceProvider) ─────────────────
// Mirrors the host's ConferenceContent but without auth-dependent features.

function GuestConferenceContent({
  roomName,
  noraState,
  isNoraSpeaking,
  onLeave,
}: {
  roomName: string;
  noraState: 'idle' | 'listening' | 'thinking' | 'speaking';
  isNoraSpeaking: boolean;
  onLeave: () => void;
}) {
  const participants = useZoomParticipants();
  const {
    stream, client, isRecording, networkQuality,
    transcriptEntries, isTranscribing, toggleTranscription,
  } = useZoomContext();
  const activeSpeaker = useZoomActiveSpeaker();
  const { formatted: duration } = useConferenceTimer();
  const maxVideoQuality = useMemo(() => {
    try {
      const value = stream?.getVideoMaxQuality?.();
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    } catch (_e) { return undefined; }
  }, [stream]);

  // Derive camera/mic state from SDK participant data
  const localParticipant = participants.find((p) => p.isLocal);
  const derivedCameraOff = localParticipant ? !localParticipant.isVideoOn : true;
  const derivedMuted = localParticipant ? !!localParticipant.isMuted : false;

  const controls = useConferenceControls({
    stream, client,
    isMuted: derivedMuted,
    isCameraOff: derivedCameraOff,
  });

  useEffect(() => { controls.setIsRecording(isRecording); }, [isRecording]);

  const [viewMode, setViewMode] = useState<'gallery' | 'speaker'>('gallery');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleNoraTap = useCallback(() => {
    // Guest can't control Nora voice — view only
  }, []);

  // ── Video grid — same as host ──────────────────────────────────────────────
  const renderGrid = () => {
    const allTiles = participants.length + 1; // +1 for Nora
    const isGallery = viewMode === 'gallery';

    if (!isGallery) {
      const spotlightUserId = activeSpeaker ?? participants.find(p => p.isLocal)?.userId ?? null;
      const spotlight = spotlightUserId !== null ? participants.find(p => p.userId === spotlightUserId) : null;
      const filmstrip = participants.filter(p => p.userId !== spotlightUserId);

      return (
        <View style={gridStyles.speakerLayout}>
          <View style={gridStyles.spotlightArea}>
            {spotlight ? (
              <ZoomVideoTile
                participant={spotlight}
                stream={stream as any}
                isActiveSpeaker={spotlight.userId === activeSpeaker}
                size="spotlight"
                networkQuality={networkQuality}
                maxVideoQuality={maxVideoQuality}
              />
            ) : (
              <NoraTile avaState={noraState} isNoraSpeaking={isNoraSpeaking} onPress={handleNoraTap} />
            )}
          </View>
          <View style={gridStyles.filmstrip}>
            {spotlight && (
              <View style={gridStyles.filmstripTile}>
                <NoraTile avaState={noraState} isNoraSpeaking={isNoraSpeaking} onPress={handleNoraTap} />
              </View>
            )}
            {filmstrip.map(p => (
              <View key={p.userId} style={gridStyles.filmstripTile}>
                <ZoomVideoTile
                  participant={p}
                  stream={stream as any}
                  isActiveSpeaker={false}
                  size="small"
                  networkQuality={networkQuality}
                  maxVideoQuality={maxVideoQuality}
                />
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Gallery view — adaptive grid
    const cols = allTiles <= 1 ? 1 : allTiles <= 2 ? 2 : allTiles <= 4 ? 2 : allTiles <= 6 ? 3 : allTiles <= 9 ? 3 : 4;
    const rows = Math.ceil(allTiles / cols);
    const gap = 4;
    const tileWidth = `calc(${100 / cols}% - ${gap}px)` as any;
    const tileHeight = `calc(${100 / rows}% - ${gap}px)` as any;

    const gridStyle = allTiles <= 1 ? gridStyles.grid1
      : allTiles <= 2 ? gridStyles.grid2
      : allTiles <= 4 ? gridStyles.grid4
      : allTiles <= 6 ? gridStyles.grid6
      : allTiles <= 9 ? gridStyles.grid9
      : gridStyles.grid12;

    const tileStyle = { width: tileWidth, height: tileHeight };

    return (
      <View style={[gridStyles.videoGrid, gridStyle]}>
        {/* Nora tile — always first in grid */}
        <View style={[gridStyles.videoTileWrapper, tileStyle]}>
          <NoraTile avaState={noraState} isNoraSpeaking={isNoraSpeaking} onPress={handleNoraTap} />
        </View>
        {/* Zoom participant tiles */}
        {participants.map((p: ZoomParticipant) => (
          <View key={p.userId} style={[gridStyles.videoTileWrapper, tileStyle]}>
            <ZoomVideoTile
              participant={p}
              stream={stream as any}
              isActiveSpeaker={p.userId === activeSpeaker}
              networkQuality={networkQuality}
              maxVideoQuality={maxVideoQuality}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <>
      <ConferenceHeader
        roomName={roomName}
        participantCount={participants.length + 1}
        duration={duration}
        isRecording={isRecording}
        networkQuality={networkQuality}
      />

      <View style={gridStyles.gridContainer}>
        {renderGrid()}
        <ConferenceCaptions entries={transcriptEntries} visible={isTranscribing} />
      </View>

      <ConferenceControlBar
        isMuted={derivedMuted}
        isCameraOff={derivedCameraOff}
        isScreenSharing={controls.isScreenSharing}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        isChatOpen={false}
        isParticipantsOpen={false}
        viewMode={viewMode}
        unreadCount={0}
        onToggleMic={controls.toggleMic}
        onToggleCamera={controls.toggleCamera}
        onToggleScreenShare={controls.toggleScreenShare}
        onToggleRecording={() => { /* Guests can't record */ }}
        onToggleTranscription={toggleTranscription}
        onToggleChat={() => { /* Future: guest chat */ }}
        onToggleParticipants={() => { /* Future: guest participant list */ }}
        onToggleView={() => setViewMode(v => v === 'gallery' ? 'speaker' : 'gallery')}
        onLeave={onLeave}
        hideRecording
        isSettingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(v => !v)}
      />

      <ConferenceSettingsPanel
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function GuestJoinContent() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Live Nora state from SSE
  const { noraState, isNoraSpeaking } = useGuestNoraState(joinData?.roomName);

  // Inject styles on mount
  useEffect(() => {
    ensureMobileViewport();
    injectGuestKeyframes();
    injectZoomStyles();
    injectGuestTheme();
  }, []);

  // Fetch join token from public endpoint
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
        if (res.status === 404) { setPageState('invalid'); return null; }
        if (res.status === 410) { setPageState('expired'); return null; }
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
        setJoinData(data);
        setGuestName(data.guestName || '');
        setPageState('ready');
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setErrorMessage('Connection timed out. Please check your network and try again.');
        } else {
          setErrorMessage(err.message || 'Failed to join conference');
        }
        setPageState('error');
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [code]);

  // Guest enters name and clicks Join — re-fetch token with chosen name
  const handleJoinWithName = useCallback(async (chosenName: string) => {
    if (!code) return;
    setGuestName(chosenName);
    setPageState('joining');

    try {
      const res = await fetch(
        `${API_BASE}/api/conference/join/${encodeURIComponent(code)}?name=${encodeURIComponent(chosenName)}`,
      );
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: JoinResponse = await res.json();
      if (!data.token) throw new Error('Invalid response');
      setJoinData(data);
      setGuestName(data.guestName || chosenName);
      setPageState('joined');
    } catch (_e) {
      // Fallback: use original token with the new name (server may not support ?name=)
      if (joinData) {
        setPageState('joined');
      } else {
        setPageState('error');
        setErrorMessage('Failed to join conference');
      }
    }
  }, [code, joinData]);

  const handleLeave = useCallback(() => {
    setPageState('disconnected');
  }, []);

  const handleRejoin = useCallback(() => {
    if (joinData) setPageState('joined');
  }, [joinData]);

  const handleRetry = useCallback(() => {
    if (Platform.OS === 'web') window.location.reload();
  }, []);

  return (
    <View style={styles.page}>
      {(pageState === 'loading' || pageState === 'joining') && <LoadingView />}

      {pageState === 'ready' && joinData && (
        <NameEntryView
          defaultName={guestName}
          roomName={joinData.roomName}
          onJoin={handleJoinWithName}
        />
      )}

      {pageState === 'joined' && joinData && (
        <ZoomConferenceProvider
          token={joinData.token}
          topic={joinData.topic || joinData.roomName}
          userName={guestName || joinData.guestName}
          startVideo
          autoRecord={false}
        >
          <GuestConferenceContent
            roomName={joinData.roomName}
            noraState={noraState}
            isNoraSpeaking={isNoraSpeaking}
            onLeave={handleLeave}
          />
        </ZoomConferenceProvider>
      )}

      {pageState === 'disconnected' && (
        <DisconnectedView onRejoin={joinData ? handleRejoin : null} />
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

// ── Grid styles (same as host conference-live.tsx) ───────────────────────────

const gridStyles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  videoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
  },
  videoTileWrapper: {},
  grid1: { padding: 8 },
  grid2: { padding: 4 },
  grid4: { padding: 4 },
  grid6: { padding: 3 },
  grid9: { padding: 2 },
  grid12: { padding: 2 },
  speakerLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  spotlightArea: {
    flex: 1,
    padding: 4,
  },
  filmstrip: {
    height: 120,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  filmstripTile: {
    width: 180,
    height: '100%' as any,
  },
});

// ── Page styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%)',
    } as unknown as ViewStyle : {}),
  },

  // Loading
  ringContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  ringOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    ...(Platform.OS === 'web' ? {
      animationName: 'guestRingPulse',
      animationDuration: '2.4s',
      animationIterationCount: 'infinite',
    } as unknown as ViewStyle : {}),
  },
  ringDashed: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.06)',
    borderStyle: 'dashed',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 30px rgba(59, 130, 246, 0.12)',
      animationName: 'guestGlowPulse',
      animationDuration: '3s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
    } as unknown as ViewStyle : {}),
  },
  loadingTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  loadingSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  breatheDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },

  // Error / Disconnected
  errorCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
    maxWidth: 400,
    width: '100%',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      animationName: 'guestCardEntrance',
      animationDuration: '0.5s',
      animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      animationFillMode: 'backwards',
    } as unknown as ViewStyle : {}),
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  errorTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  errorDesc: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    minHeight: 44,
    minWidth: 120,
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      boxShadow: '0 2px 12px rgba(59, 130, 246, 0.35)',
      transition: 'all 0.2s ease',
    } as unknown as ViewStyle : {}),
  },
  retryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  retryText: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  brandingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    opacity: 0.5,
  },
  brandingText: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // ── Name Entry (Pre-Join) ───────────────────────────────────────
  nameEntryCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.lg,
    maxWidth: 420,
    width: '100%',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      animationName: 'guestCardEntrance',
      animationDuration: '0.5s',
      animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      animationFillMode: 'backwards',
    } as unknown as ViewStyle : {}),
  },
  nameEntryHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameEntryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    marginBottom: Spacing.xs,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 24px rgba(59, 130, 246, 0.12)',
    } as unknown as ViewStyle : {}),
  },
  nameEntryTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  nameEntrySubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    maxWidth: 280,
    textAlign: 'center',
  },
  nameInputSection: {
    width: '100%',
    gap: Spacing.sm,
  },
  nameInputLabel: {
    ...Typography.small,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.3,
  },
  nameInputFallback: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#1C1C1E',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nameInputFallbackText: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  joinButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    ...(Platform.OS === 'web' ? {
      background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35), 0 0 0 1px rgba(59, 130, 246, 0.1)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    } as unknown as ViewStyle : {
      backgroundColor: Colors.accent.cyan,
    }),
  },
  joinButtonDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? { cursor: 'not-allowed' } as unknown as ViewStyle : {}),
  },
  joinButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  joinButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#ffffff',
  },
});
