/**
 * ZoomVideoTile
 *
 * Renders a Zoom Video SDK participant into a DOM video/canvas target.
 * Falls back to AvatarTileSurface when video is off or on non-web platforms.
 *
 * Critical difference from LiveKitVideoTile: Zoom renders video via
 * `stream.renderVideo(canvas, userId, width, height, x, y, rotation)` for
 * remote tiles, but some Chromium self-view paths require a `<video>` target
 * via `attachVideo(...)`.
 *
 * Animation patterns ported from LiveKitVideoTile:
 * - Multi-layer breathing ring (inner border + outer glow with offset timing)
 * - Smooth speaking border opacity transition (fade in/out, not hard cut)
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
  /** MediaStream from ZoomConferenceProvider — exposes renderVideo/stopRenderVideo */
  stream: {
    attachVideo?: (
      userId: number,
      quality: number,
      element: HTMLVideoElement,
    ) => Promise<unknown> | unknown;
    isRenderSelfViewWithVideoElement?: () => boolean;
    detachVideo?: (
      userId: number,
      element?: HTMLVideoElement | HTMLElement,
    ) => Promise<unknown> | unknown;
    renderVideo: (
      target: HTMLCanvasElement | HTMLVideoElement,
      userId: number,
      width: number,
      height: number,
      x: number,
      y: number,
      rotation: number,
    ) => void;
    stopRenderVideo: (target: HTMLCanvasElement | HTMLVideoElement, userId: number) => void;
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

  // Zoom network level is typically 1..5. Cap receive quality under weak links.
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
/*  ZoomCanvasView — web-only canvas rendering                                */
/* -------------------------------------------------------------------------- */

function ZoomCanvasView({
  participant,
  stream,
  size,
  isActiveSpeaker,
  networkQuality,
  maxVideoQuality,
}: {
  participant: ZoomParticipant;
  stream: ZoomVideoTileProps['stream'];
  size: 'normal' | 'small' | 'spotlight';
  isActiveSpeaker: boolean;
  networkQuality?: { uplink: number; downlink: number };
  maxVideoQuality?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!canvasRef.current || !isValidParticipantId(participant.userId) || !participant.isVideoOn || !stream) return;

    const canvas = canvasRef.current;

    const quality = resolveVideoQuality({
      participant,
      size,
      isActiveSpeaker,
      networkQuality,
      maxVideoQuality,
    });

    const dimensions =
      quality >= VIDEO_RECEIVE_QUALITY.spotlight
        ? { width: 1920, height: 1080 }
        : quality >= VIDEO_RECEIVE_QUALITY.galleryLarge
          ? { width: 1280, height: 720 }
          : quality >= VIDEO_RECEIVE_QUALITY.gallerySmall
            ? { width: 640, height: 360 }
            : { width: 320, height: 180 };

    // Fixed render dimensions — canvas CSS handles display scaling
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Zoom renderVideo 7th param is VideoQuality, NOT rotation:
    // 0=90p, 1=180p, 2=360p, 3=720p, 4=1080p
    stream.renderVideo(
      canvas,
      participant.userId,
      dimensions.width,
      dimensions.height,
      0,
      0,
      quality,
    );

    return () => {
      try {
        stream.stopRenderVideo(canvas, participant.userId);
      } catch (_e) {
        // Zoom SDK may throw if canvas already detached
      }
    };
  }, [participant.userId, participant.isVideoOn, participant.isLocal, stream, size, isActiveSpeaker, networkQuality, maxVideoQuality]);

  if (Platform.OS !== 'web') return null;

  // Mirror local camera via CSS transform as fallback (rotation=2 handles SDK-level mirror,
  // but scaleX(-1) ensures consistent mirroring even if SDK rotation is not applied)
  const canvasStyle: Record<string, string> = {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    objectFit: 'cover',
    background: '#0a0a0c',
  };

  if (participant.isLocal) {
    canvasStyle.transform = 'scaleX(-1)';
  }

  return (
    <View style={styles.canvasContainer}>
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        style={canvasStyle as unknown as React.CSSProperties}
      />
    </View>
  );
}

function ZoomSelfVideoView({
  participant,
  stream,
  onAttachFailed,
  size,
  isActiveSpeaker,
  networkQuality,
  maxVideoQuality,
}: {
  participant: ZoomParticipant;
  stream: ZoomVideoTileProps['stream'];
  onAttachFailed: () => void;
  size: 'normal' | 'small' | 'spotlight';
  isActiveSpeaker: boolean;
  networkQuality?: { uplink: number; downlink: number };
  maxVideoQuality?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!stream?.attachVideo || !stream?.detachVideo) {
      onAttachFailed();
      return;
    }
    if (!isValidParticipantId(participant.userId) || !participant.isVideoOn || !participant.isLocal) return;

    const videoEl = videoRef.current;
    const containerEl = containerRef.current;
    let disposed = false;
    let attachedElement: HTMLElement | null = null;
    let usedLegacyAttach = false;
    const quality = resolveVideoQuality({
      participant,
      size,
      isActiveSpeaker,
      networkQuality,
      maxVideoQuality,
    });

    const attach = async () => {
      try {
        // Zoom SDK newer path: attachVideo(userId, quality) returns a player element.
        // Keep legacy path as fallback for environments expecting a target <video>.
        const preferElementAttach = stream.isRenderSelfViewWithVideoElement?.() ?? true;
        if (preferElementAttach) {
          const maybeElement = await (stream.attachVideo as unknown as (userId: number, quality: number) => Promise<unknown> | unknown)(
            participant.userId,
            quality,
          );
          if (maybeElement instanceof HTMLElement && containerEl) {
            containerEl.innerHTML = '';
            maybeElement.style.width = '100%';
            maybeElement.style.height = '100%';
            maybeElement.style.position = 'absolute';
            maybeElement.style.top = '0';
            maybeElement.style.left = '0';
            maybeElement.style.objectFit = 'cover';
            maybeElement.style.background = '#0a0a0c';
            maybeElement.style.transform = 'scaleX(-1)';
            containerEl.appendChild(maybeElement);
            attachedElement = maybeElement;
            return;
          }
        }

        if (!videoEl) throw new Error('Self video element unavailable');
        await stream.attachVideo?.(participant.userId, quality, videoEl);
        usedLegacyAttach = true;
      } catch (_e) {
        if (!disposed) onAttachFailed();
      }
    };

    void attach();

    return () => {
      disposed = true;
      try {
        if (usedLegacyAttach && videoEl) {
          void stream.detachVideo?.(participant.userId, videoEl);
        } else if (attachedElement) {
          void stream.detachVideo?.(participant.userId, attachedElement);
          if (attachedElement.parentElement) {
            attachedElement.parentElement.removeChild(attachedElement);
          }
        } else {
          void stream.detachVideo?.(participant.userId);
        }
      } catch (_e) {
        // Zoom SDK may throw if video is already detached
      }
    };
  }, [participant.userId, participant.isVideoOn, participant.isLocal, stream, onAttachFailed, size, isActiveSpeaker, networkQuality, maxVideoQuality]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.canvasContainer}>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        style={
          {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            background: '#0a0a0c',
          } as React.CSSProperties
        }
      />
      <video
        ref={videoRef}
        style={
          {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            left: '0',
            objectFit: 'cover',
            background: '#0a0a0c',
            transform: 'scaleX(-1)',
          } as React.CSSProperties
        }
        autoPlay
        muted
        playsInline
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  ConnectingFallback                                                        */
/*  Premium avatar tile shown while participant is null (session connecting).  */
/*  Multi-layer breathing ring: inner border pulse + outer glow ring          */
/*  with offset timing for organic depth.                                     */
/* -------------------------------------------------------------------------- */

function ConnectingFallback({
  name,
  size,
}: {
  name: string;
  size: 'normal' | 'small' | 'spotlight';
}) {
  // Inner ring: 0.35 -> 0.7 opacity, 1600ms cycle
  const innerOpacity = useSharedValue(0.35 as number);
  // Outer ring: 0.15 -> 0.45 opacity, 2000ms cycle (offset phase for organic feel)
  const outerOpacity = useSharedValue(0.15 as number);
  // Connecting status dot
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

      {/* Outer breathing ring */}
      <ReAnimated.View
        style={[
          fallbackStyles.outerBreathRing,
          isSmall && { borderRadius: Spacing.sm },
          outerStyle,
        ]}
        accessibilityElementsHidden
      />

      {/* Inner breathing ring */}
      <ReAnimated.View
        style={[
          fallbackStyles.innerBreathRing,
          isSmall && { borderRadius: Spacing.sm },
          innerStyle,
        ]}
        accessibilityElementsHidden
      />

      {/* Bottom gradient with name + connecting status */}
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
/*  Inner component with guaranteed non-null participant.                     */
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
  const [localAttachFailed, setLocalAttachFailed] = useState(false);
  // Treat stream readiness as part of "has video" so we show avatar fallback
  // instead of a blank tile when participant metadata flips before stream exists.
  const hasVideo = participant.isVideoOn && Platform.OS === 'web' && !!stream;
  const shouldUseLocalVideoElement =
    hasVideo
    && participant.isLocal
    && !localAttachFailed
    && typeof stream?.attachVideo === 'function'
    && typeof stream?.detachVideo === 'function';

  useEffect(() => {
    setLocalAttachFailed(false);
  }, [participant.userId, stream]);

  // Smooth speaking border opacity — fades in over 200ms, fades out over 300ms
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
      {/* Video canvas or avatar fallback */}
      {hasVideo ? (
        shouldUseLocalVideoElement ? (
          <ZoomSelfVideoView
            participant={participant}
            stream={stream}
            onAttachFailed={() => setLocalAttachFailed(true)}
            size={size}
            isActiveSpeaker={isActiveSpeaker}
            networkQuality={networkQuality}
            maxVideoQuality={maxVideoQuality}
          />
        ) : (
          <ZoomCanvasView
            participant={participant}
            stream={stream}
            size={size}
            isActiveSpeaker={isActiveSpeaker}
            networkQuality={networkQuality}
            maxVideoQuality={maxVideoQuality}
          />
        )
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

      {/* Speaking glow overlay — animated opacity for smooth transition */}
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
            {/* Muted indicator */}
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
/*  ZoomVideoTile (exported guard)                                            */
/*  Checks participant existence BEFORE rendering content.                    */
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

  // Guard: no participant means session hasn't connected this peer yet
  if (!participant) {
    return (
      <ConnectingFallback
        name={displayName}
        size={size}
      />
    );
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
    // Web-only outer glow for speaking state
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
