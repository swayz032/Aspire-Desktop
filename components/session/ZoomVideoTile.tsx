/**
 * ZoomVideoTile
 *
 * Renders a Zoom Video SDK participant using the modern `attachVideo()` API.
 * Falls back to AvatarTileSurface when video is off or on non-web platforms.
 *
 * The SDK's `attachVideo(userId, quality)` returns a managed `VideoPlayer`
 * custom element that supports standard CSS (object-fit, transform, etc.).
 * This replaces the deprecated `renderVideo()` canvas-based approach.
 *
 * Animation patterns:
 * - Multi-layer breathing ring for connecting state
 * - Smooth speaking border opacity transition
 * - Muted indicator + name label overlay
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Animation } from '@/constants/tokens';
import { AvatarTileSurface } from '@/components/session/AvatarTileSurface';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { VIDEO_RECEIVE_QUALITY } from '@/lib/zoom-config';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface ZoomParticipant {
  userId: number;
  displayName: string;
  isVideoOn: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

interface ZoomVideoTileProps {
  /** Zoom participant data. Null before session connects — shows avatar. */
  participant: ZoomParticipant | null;
  /** MediaStream from ZoomConferenceProvider — exposes attachVideo/detachVideo */
  stream: {
    attachVideo: (
      userId: number,
      videoQuality: number,
      element?: string | HTMLElement,
    ) => Promise<HTMLElement | { type: string; reason: string }>;
    detachVideo: (
      userId: number,
      element?: string | HTMLElement,
    ) => Promise<HTMLElement | HTMLElement[]>;
  } | null;
  /** Whether this participant is the active speaker */
  isActiveSpeaker?: boolean;
  /** Size variant */
  size?: 'normal' | 'small' | 'spotlight';
  /** Current network quality levels from provider (1..5 from Zoom SDK) */
  networkQuality?: { uplink: number; downlink: number };
  /** Optional SDK-reported max receive quality capability */
  maxVideoQuality?: number;
}

function isValidParticipantId(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveVideoQuality({
  participant,
  size,
  isActiveSpeaker,
  networkQuality,
  maxVideoQuality,
}: {
  participant: ZoomParticipant;
  size: 'normal' | 'small' | 'spotlight';
  isActiveSpeaker: boolean;
  networkQuality?: { uplink: number; downlink: number };
  maxVideoQuality?: number;
}) {
  const requested =
    isActiveSpeaker || size === 'spotlight' || participant.isLocal
      ? VIDEO_RECEIVE_QUALITY.spotlight
      : size === 'small'
        ? VIDEO_RECEIVE_QUALITY.filmstrip
        : VIDEO_RECEIVE_QUALITY.galleryLarge;

  const level = networkQuality ? Math.min(networkQuality.uplink, networkQuality.downlink) : 5;
  const networkCap =
    level <= 1
      ? VIDEO_RECEIVE_QUALITY.filmstrip
      : level <= 2
        ? VIDEO_RECEIVE_QUALITY.gallerySmall
        : level <= 3
          ? VIDEO_RECEIVE_QUALITY.galleryLarge
          : VIDEO_RECEIVE_QUALITY.spotlight;

  const streamCap =
    typeof maxVideoQuality === 'number' && maxVideoQuality >= 0
      ? Math.min(maxVideoQuality, VIDEO_RECEIVE_QUALITY.spotlight)
      : VIDEO_RECEIVE_QUALITY.spotlight;

  return Math.min(requested, networkCap, streamCap);
}

/* -------------------------------------------------------------------------- */
/*  ZoomVideoView — unified video rendering via attachVideo()                 */
/*  Works for ALL participants (local + remote). The SDK returns a managed    */
/*  VideoPlayer element that supports object-fit: cover natively.             */
/* -------------------------------------------------------------------------- */

function ZoomVideoView({
  participant,
  stream,
  size,
  isActiveSpeaker,
  networkQuality,
  maxVideoQuality,
}: {
  participant: ZoomParticipant;
  stream: NonNullable<ZoomVideoTileProps['stream']>;
  size: 'normal' | 'small' | 'spotlight';
  isActiveSpeaker: boolean;
  networkQuality?: { uplink: number; downlink: number };
  maxVideoQuality?: number;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<HTMLElement | null>(null);

  // Stabilize networkQuality to avoid re-renders on every object reference change
  const uplinkRef = useRef(networkQuality?.uplink ?? 5);
  const downlinkRef = useRef(networkQuality?.downlink ?? 5);
  uplinkRef.current = networkQuality?.uplink ?? 5;
  downlinkRef.current = networkQuality?.downlink ?? 5;

  // Create <video-player-container> custom element on mount
  // (Expo/RN Web JSX can't render custom HTML tags directly)
  useEffect(() => {
    if (Platform.OS !== 'web' || !wrapperRef.current) return;

    const vpc = document.createElement('video-player-container') as HTMLElement;
    vpc.style.width = '100%';
    vpc.style.height = '100%';
    vpc.style.display = 'block';
    vpc.style.position = 'absolute';
    vpc.style.top = '0';
    vpc.style.left = '0';
    vpc.style.overflow = 'hidden';
    wrapperRef.current.appendChild(vpc);
    containerRef.current = vpc;

    return () => {
      while (vpc.firstChild) vpc.removeChild(vpc.firstChild);
      vpc.remove();
      containerRef.current = null;
    };
  }, []);

  // Attach/detach video when participant state changes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const container = containerRef.current;
    if (!container || !isValidParticipantId(participant.userId) || !participant.isVideoOn) return;

    let disposed = false;

    const quality = resolveVideoQuality({
      participant,
      size,
      isActiveSpeaker,
      networkQuality: { uplink: uplinkRef.current, downlink: downlinkRef.current },
      maxVideoQuality,
    });

    const attach = async () => {
      try {
        const result = await stream.attachVideo(participant.userId, quality);

        if (disposed) {
          // Component unmounted while awaiting — clean up
          if (result instanceof HTMLElement) {
            try { await stream.detachVideo(participant.userId, result); } catch (_e) { /* */ }
            result.remove();
          }
          return;
        }

        if (!(result instanceof HTMLElement)) {
          // ExecutedFailure — avatar fallback will show
          return;
        }

        // Style the SDK's VideoPlayer element for cover-fill
        result.style.width = '100%';
        result.style.height = '100%';
        result.style.objectFit = 'cover';

        // Mirror self-view (like regular Zoom)
        if (participant.isLocal) {
          result.style.transform = 'scaleX(-1)';
        }

        container.appendChild(result);
        videoPlayerRef.current = result;
      } catch (_e) {
        // attachVideo threw — avatar fallback will show
      }
    };

    void attach();

    return () => {
      disposed = true;
      const el = videoPlayerRef.current;
      if (el) {
        videoPlayerRef.current = null;
        (async () => {
          try { await stream.detachVideo(participant.userId, el); } catch (_e) { /* */ }
          el.remove();
        })();
      }
    };
  }, [participant.userId, participant.isVideoOn, participant.isLocal, stream, size, isActiveSpeaker, maxVideoQuality]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.canvasContainer}>
      <div
        ref={wrapperRef as React.RefObject<HTMLDivElement>}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          background: '#0a0a0c',
        } as React.CSSProperties}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ConnectingFallback                                                        */
/*  Premium avatar tile shown while participant is null (session connecting).  */
/* -------------------------------------------------------------------------- */

function ConnectingFallback({
  name,
  size,
}: {
  name: string;
  size: 'normal' | 'small' | 'spotlight';
}) {
  const innerOpacity = useSharedValue(0.35 as number);
  const outerOpacity = useSharedValue(0.15 as number);
  const dotOpacity = useSharedValue(0.3 as number);

  useEffect(() => {
    innerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    outerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const innerStyle = useAnimatedStyle(() => ({ opacity: innerOpacity.value }));
  const outerStyle = useAnimatedStyle(() => ({ opacity: outerOpacity.value }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        isSmall && styles.containerSmall,
        size === 'spotlight' && styles.containerSpotlight,
      ]}
      accessibilityLabel={`${name}, connecting`}
      accessibilityRole="image"
    >
      <AvatarTileSurface
        name={name}
        seed={name}
        accentColor="#374151"
        size={size}
        videoOff={true}
        style={styles.avatarFill}
      />

      <ReAnimated.View
        style={[
          fallbackStyles.outerBreathRing,
          isSmall && { borderRadius: Spacing.sm },
          outerStyle,
        ]}
        accessibilityElementsHidden
      />

      <ReAnimated.View
        style={[
          fallbackStyles.innerBreathRing,
          isSmall && { borderRadius: Spacing.sm },
          innerStyle,
        ]}
        accessibilityElementsHidden
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomOverlay}
      >
        <View style={styles.bottomRow}>
          <View style={styles.nameContainer}>
            <Text
              style={[styles.name, isSmall && styles.nameSmall]}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
          <View style={fallbackStyles.connectingRow}>
            <ReAnimated.View style={[fallbackStyles.connectingDot, dotStyle]} />
            {!isSmall && (
              <Text style={fallbackStyles.connectingText}>Connecting</Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ZoomVideoTileContent                                                      */
/* -------------------------------------------------------------------------- */

function ZoomVideoTileContent({
  participant,
  stream,
  isActiveSpeaker = false,
  size = 'normal',
  networkQuality,
  maxVideoQuality,
}: {
  participant: ZoomParticipant;
  stream: ZoomVideoTileProps['stream'];
  isActiveSpeaker: boolean;
  size: 'normal' | 'small' | 'spotlight';
  networkQuality?: { uplink: number; downlink: number };
  maxVideoQuality?: number;
}) {
  const isSmall = size === 'small';
  const isSpotlight = size === 'spotlight';
  const hasVideo = participant.isVideoOn && Platform.OS === 'web' && !!stream;

  // Smooth speaking border opacity
  const speakingOpacity = useSharedValue(0 as number);
  useEffect(() => {
    speakingOpacity.value = withTiming(
      isActiveSpeaker ? 1 : 0,
      { duration: isActiveSpeaker ? 200 : 300 },
    );
  }, [isActiveSpeaker]);

  const speakingBorderStyle = useAnimatedStyle(() => ({
    opacity: speakingOpacity.value,
  }));

  return (
    <View
      style={[
        styles.container,
        isSmall && styles.containerSmall,
        isSpotlight && styles.containerSpotlight,
      ]}
      accessibilityLabel={`${participant.displayName}${isActiveSpeaker ? ', speaking' : ''}${participant.isMuted ? ', muted' : ''}`}
      accessibilityRole="image"
    >
      {hasVideo ? (
        <ZoomVideoView
          participant={participant}
          stream={stream}
          size={size}
          isActiveSpeaker={isActiveSpeaker}
          networkQuality={networkQuality}
          maxVideoQuality={maxVideoQuality}
        />
      ) : (
        <AvatarTileSurface
          name={participant.displayName}
          seed={participant.isLocal ? 'local-self' : participant.displayName}
          accentColor={participant.isLocal ? '#2D3748' : '#374151'}
          size={isSmall ? 'small' : isSpotlight ? 'spotlight' : 'normal'}
          videoOff={true}
          style={styles.avatarFill}
        />
      )}

      {/* Speaking glow overlay */}
      <ReAnimated.View
        style={[styles.speakingBorder, speakingBorderStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
      />

      {/* Bottom gradient overlay with name + indicators */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomOverlay}
      >
        <View style={styles.bottomRow}>
          <View style={styles.nameContainer}>
            <Text
              style={[styles.name, isSmall && styles.nameSmall]}
              numberOfLines={1}
            >
              {participant.displayName}
            </Text>
            {participant.isLocal && (
              <View style={styles.youBadge}>
                <Ionicons name="star" size={8} color={Colors.semantic.warning} />
              </View>
            )}
          </View>
          <View style={styles.indicators}>
            {participant.isMuted && (
              <View
                style={styles.mutedBadge}
                accessibilityLabel="Microphone muted"
                accessibilityRole="image"
              >
                <Ionicons name="mic-off" size={10} color={Colors.semantic.error} />
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ZoomVideoTile (exported)                                                  */
/* -------------------------------------------------------------------------- */

function ZoomVideoTileInner({
  participant,
  stream,
  isActiveSpeaker = false,
  size = 'normal',
  networkQuality,
  maxVideoQuality,
}: ZoomVideoTileProps) {
  const displayName = participant?.displayName ?? 'Unknown';

  if (!participant) {
    return <ConnectingFallback name={displayName} size={size} />;
  }

  return (
    <ZoomVideoTileContent
      participant={participant}
      stream={stream}
      isActiveSpeaker={isActiveSpeaker}
      size={size}
      networkQuality={networkQuality}
      maxVideoQuality={maxVideoQuality}
    />
  );
}

export function ZoomVideoTile(props: ZoomVideoTileProps) {
  return (
    <PageErrorBoundary pageName="zoom-video-tile">
      <ZoomVideoTileInner {...props} />
    </PageErrorBoundary>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background.elevated,
    position: 'relative',
  },
  containerSmall: {
    borderRadius: Spacing.sm,
  },
  containerSpotlight: {
    borderRadius: 10,
  },
  canvasContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  avatarFill: {
    flex: 1,
  },
  speakingBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.semantic.success,
    boxShadow: 'inset 0 0 8px rgba(52, 199, 89, 0.2), 0 0 12px rgba(52, 199, 89, 0.15)',
  } as ViewStyle,
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  nameSmall: {
    fontSize: 11,
  },
  youBadge: {
    width: Spacing.lg,
    height: Spacing.lg,
    borderRadius: Spacing.sm,
    backgroundColor: Colors.semantic.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm - 2,
  },
  mutedBadge: {
    width: Spacing.xl,
    height: Spacing.xl,
    borderRadius: 10,
    backgroundColor: Colors.semantic.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const fallbackStyles = StyleSheet.create({
  innerBreathRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent.cyanMedium,
  },
  outerBreathRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.accent.cyanLight,
    boxShadow: `0 0 16px ${Colors.accent.cyanLight}, 0 0 32px rgba(59, 130, 246, 0.08)`,
  } as ViewStyle,
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  connectingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  connectingText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
});
