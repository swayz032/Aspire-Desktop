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
import React, { useEffect, useRef } from 'react';
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
    detachVideo?: (
      userId: number,
      element?: HTMLVideoElement,
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
}

/* -------------------------------------------------------------------------- */
/*  ZoomCanvasView — web-only canvas rendering                                */
/* -------------------------------------------------------------------------- */

function ZoomCanvasView({
  participant,
  stream,
}: {
  participant: ZoomParticipant;
  stream: ZoomVideoTileProps['stream'];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!canvasRef.current || !participant.userId || !participant.isVideoOn || !stream) return;

    const canvas = canvasRef.current;

    // Fixed render dimensions — canvas CSS handles display scaling
    canvas.width = 1280;
    canvas.height = 720;

    // Zoom renderVideo 7th param is VideoQuality, NOT rotation:
    // 0=90p, 1=180p, 2=360p, 3=720p, 4=1080p
    // Use 3 (720p) for all participants
    stream.renderVideo(
      canvas,
      participant.userId,
      1280,
      720,
      0,
      0,
      3, // VideoQuality.Video_720P
    );

    return () => {
      try {
        stream.stopRenderVideo(canvas, participant.userId);
      } catch (_e) {
        // Zoom SDK may throw if canvas already detached
      }
    };
  }, [participant.userId, participant.isVideoOn, stream]);

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
}: {
  participant: ZoomParticipant;
  stream: ZoomVideoTileProps['stream'];
  isActiveSpeaker: boolean;
  size: 'normal' | 'small' | 'spotlight';
}) {
  const isSmall = size === 'small';
  const isSpotlight = size === 'spotlight';
  const hasVideo = participant.isVideoOn && Platform.OS === 'web';

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
        <ZoomCanvasView participant={participant} stream={stream} />
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
