/**
 * LiveKitVideoTile
 *
 * Renders a real LiveKit video track for a participant.
 * Falls back to AvatarTileSurface when video is off.
 *
 * Split into guard (LiveKitVideoTile) + connected component
 * (LiveKitVideoTileConnected) to prevent crash when participant
 * is undefined — LiveKit hooks require a non-null participant or
 * a wrapping ParticipantContext.
 *
 * Uses:
 * - useIsSpeaking() for speaking indicator
 * - useConnectionQualityIndicator() for quality dot
 * - TrackReferenceOrPlaceholder for video attachment
 *
 * Wave 4 Polish:
 * - Multi-layer breathing ring (inner border + outer glow with offset timing)
 * - Smooth speaking border opacity transition (fade in/out, not hard cut)
 * - Connection quality bar micro-animation (spring height changes)
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useIsSpeaking,
  useConnectionQualityIndicator,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import type { Participant } from 'livekit-client';
import { Track, ConnectionQuality } from 'livekit-client';
import { Colors, Spacing, Animation } from '@/constants/tokens';
import { AvatarTileSurface } from '@/components/session/AvatarTileSurface';

interface LiveKitVideoTileProps {
  /** LiveKit track reference. Null before room connects — shows avatar. */
  trackRef?: TrackReferenceOrPlaceholder | null;
  /** Display name (required when trackRef is absent) */
  name?: string;
  /** Whether this participant is the active speaker */
  isActiveSpeaker?: boolean;
  /** Whether this is the local participant */
  isLocal?: boolean;
  /** Size variant matching existing VideoTile interface */
  size?: 'normal' | 'small' | 'spotlight';
  /** Local webcam stream (for 'you' participant) */
  webcamStream?: MediaStream | null;
}

/**
 * Renders a LiveKit video track into a DOM video element.
 */
function LiveKitVideoView({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const containerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;
    const container = containerRef.current;
    const publication = trackRef.publication;
    const track = publication?.track;

    if (!track) {
      // No track — clean up any existing video
      if (videoRef.current && container.contains(videoRef.current)) {
        container.removeChild(videoRef.current);
        videoRef.current = null;
      }
      return;
    }

    // Attach track to video element
    const mediaStreamTrack = track.mediaStreamTrack;
    if (!mediaStreamTrack) return;

    if (!videoRef.current) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true; // Always mute video elements (audio handled by RoomAudioRenderer)
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.borderRadius = 'inherit';
      container.appendChild(video);
      videoRef.current = video;
    }

    const stream = new MediaStream([mediaStreamTrack]);
    videoRef.current.srcObject = stream;

    // Mirror local camera
    const isLocal = trackRef.participant?.isLocal ?? false;
    videoRef.current.style.transform = isLocal ? 'scaleX(-1)' : 'none';

    return () => {
      if (videoRef.current && container.contains(videoRef.current)) {
        videoRef.current.srcObject = null;
        container.removeChild(videoRef.current);
        videoRef.current = null;
      }
    };
  }, [trackRef, trackRef.publication?.track?.mediaStreamTrack]);

  return (
    <View
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      } as any}
    />
  );
}

function getQualityColor(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return Colors.semantic.success;
    case ConnectionQuality.Good:
      return Colors.semantic.success;
    case ConnectionQuality.Poor:
      return Colors.semantic.warning;
    case ConnectionQuality.Lost:
      return Colors.semantic.error;
    default:
      return Colors.text.muted;
  }
}

function getQualityBars(quality: ConnectionQuality): number {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 4;
    case ConnectionQuality.Good:
      return 3;
    case ConnectionQuality.Poor:
      return 2;
    case ConnectionQuality.Lost:
      return 0;
    default:
      return 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  AnimatedQualityBar                                                        */
/*  Single quality bar that springs to target height on quality change.        */
/* -------------------------------------------------------------------------- */

function AnimatedQualityBar({
  index,
  active,
  color,
}: {
  index: number;
  active: boolean;
  color: string;
}) {
  const targetHeight = 4 + index * 2;
  const heightAnim = useSharedValue(active ? targetHeight : 2);

  useEffect(() => {
    heightAnim.value = withSpring(active ? targetHeight : 2, {
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
    });
  }, [active, targetHeight]);

  // Color transition: 0 = inactive (border.strong), 1 = active (qualityColor)
  const colorProgress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    colorProgress.value = withTiming(active ? 1 : 0, { duration: Animation.normal });
  }, [active]);

  const barStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [Colors.border.strong, color],
    ),
  }));

  return (
    <ReAnimated.View
      style={[tileStyles.qualityBar, barStyle]}
      accessibilityElementsHidden
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  ConnectingTileFallback                                                    */
/*  Premium avatar tile shown while participant is null (room connecting).     */
/*  Multi-layer breathing ring: inner border pulse + outer glow ring          */
/*  with offset timing for organic depth.                                     */
/* -------------------------------------------------------------------------- */

function ConnectingTileFallback({
  name,
  isLocal,
  size,
}: {
  name: string;
  isLocal: boolean;
  size: 'normal' | 'small' | 'spotlight';
}) {
  // Inner ring: 0.35 -> 0.7 opacity, 1600ms cycle
  const innerOpacity = useSharedValue(0.35);
  // Outer ring: 0.15 -> 0.45 opacity, 2000ms cycle (offset phase for organic feel)
  const outerOpacity = useSharedValue(0.15);
  // Connecting status dot
  const dotOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Inner ring — slightly faster pulse
    innerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Outer ring — slower, offset phase creates depth illusion
    outerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Status dot
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
        tileStyles.container,
        isSmall && tileStyles.containerSmall,
        size === 'spotlight' && tileStyles.containerSpotlight,
      ]}
      accessibilityLabel={`${name}, connecting`}
      accessibilityRole="image"
    >
      {/* Avatar surface */}
      <AvatarTileSurface
        name={name}
        seed={isLocal ? 'local-self' : name}
        accentColor={isLocal ? '#2D3748' : '#374151'}
        size={size}
        videoOff={true}
        style={tileStyles.avatarFill}
      />

      {/* Outer breathing ring — wider, softer glow (box-shadow on web) */}
      <ReAnimated.View
        style={[
          fallbackStyles.outerBreathRing,
          isSmall && { borderRadius: Spacing.sm },
          outerStyle,
        ]}
        accessibilityElementsHidden
      />

      {/* Inner breathing ring — tight border glow */}
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
        style={tileStyles.bottomOverlay}
      >
        <View style={tileStyles.bottomRow}>
          <View style={tileStyles.nameContainer}>
            <Text
              style={[tileStyles.name, isSmall && tileStyles.nameSmall]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {isLocal && (
              <View style={tileStyles.youBadge}>
                <Ionicons name="star" size={8} color={Colors.semantic.warning} />
              </View>
            )}
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
/*  LiveKitVideoTileConnected                                                 */
/*  Inner component that receives guaranteed non-null participant.            */
/*  All LiveKit hooks live here — safe from the undefined crash.              */
/*                                                                            */
/*  Wave 4: Animated speaking border (smooth opacity fade), animated          */
/*  quality bars (spring height + color interpolation).                       */
/* -------------------------------------------------------------------------- */

function LiveKitVideoTileConnected({
  trackRef,
  participant,
  name: nameProp,
  isActiveSpeaker = false,
  isLocal = false,
  size = 'normal',
}: {
  trackRef: TrackReferenceOrPlaceholder;
  participant: Participant;
  name: string;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  size: 'normal' | 'small' | 'spotlight';
}) {
  const isSpeaking = useIsSpeaking(participant);
  const { quality } = useConnectionQualityIndicator({ participant });

  // Check if video track is available and enabled
  const publication = trackRef.publication;
  const hasVideo = publication?.track != null && !publication.isMuted;

  const isSmall = size === 'small';
  const isSpotlight = size === 'spotlight';

  // Check if audio is muted
  const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
  const isMuted = audioPublication ? audioPublication.isMuted : true;

  const qualityColor = getQualityColor(quality);
  const qualityBars = getQualityBars(quality);

  // Smooth speaking border opacity — fades in over 200ms, fades out over 300ms
  const speakingOpacity = useSharedValue(0);
  useEffect(() => {
    speakingOpacity.value = withTiming(
      (isSpeaking || isActiveSpeaker) ? 1 : 0,
      { duration: (isSpeaking || isActiveSpeaker) ? 200 : 300 },
    );
  }, [isSpeaking, isActiveSpeaker]);

  const speakingBorderStyle = useAnimatedStyle(() => ({
    opacity: speakingOpacity.value,
    borderColor: isSpeaking ? Colors.semantic.success : Colors.accent.cyan,
  }));

  return (
    <View
      style={[
        tileStyles.container,
        isSmall && tileStyles.containerSmall,
        isSpotlight && tileStyles.containerSpotlight,
      ]}
      accessibilityLabel={`${nameProp}${isSpeaking ? ', speaking' : ''}${isMuted ? ', muted' : ''}`}
      accessibilityRole="image"
    >
      {/* Video track or avatar when video is off */}
      {hasVideo ? (
        <LiveKitVideoView trackRef={trackRef} />
      ) : (
        <AvatarTileSurface
          name={nameProp}
          seed={participant.identity || 'unknown'}
          accentColor={isLocal ? '#2D3748' : '#374151'}
          size={isSmall ? 'small' : isSpotlight ? 'spotlight' : 'normal'}
          videoOff={true}
          style={tileStyles.avatarFill}
        />
      )}

      {/* Speaking glow overlay — animated opacity for smooth transition */}
      <ReAnimated.View
        style={[tileStyles.speakingBorder, speakingBorderStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
      />

      {/* Bottom gradient overlay with name + indicators */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={tileStyles.bottomOverlay}
      >
        <View style={tileStyles.bottomRow}>
          <View style={tileStyles.nameContainer}>
            <Text style={[tileStyles.name, isSmall && tileStyles.nameSmall]} numberOfLines={1}>
              {nameProp}
            </Text>
            {isLocal && (
              <View style={tileStyles.youBadge}>
                <Ionicons name="star" size={8} color={Colors.semantic.warning} />
              </View>
            )}
          </View>
          <View style={tileStyles.indicators}>
            {/* Connection quality bars — animated height per bar */}
            <View
              style={tileStyles.qualityContainer}
              accessibilityLabel={`Connection quality: ${quality === ConnectionQuality.Excellent ? 'excellent' : quality === ConnectionQuality.Good ? 'good' : quality === ConnectionQuality.Poor ? 'poor' : quality === ConnectionQuality.Lost ? 'lost' : 'unknown'}`}
              accessibilityRole="image"
            >
              {[0, 1, 2, 3].map((i) => (
                <AnimatedQualityBar
                  key={i}
                  index={i}
                  active={i < qualityBars}
                  color={qualityColor}
                />
              ))}
            </View>
            {/* Muted indicator */}
            {isMuted && (
              <View
                style={tileStyles.mutedBadge}
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
/*  LiveKitVideoTile (exported guard)                                         */
/*  Checks participant existence BEFORE rendering connected component.        */
/*  No LiveKit hooks are called at this level.                                */
/* -------------------------------------------------------------------------- */

export function LiveKitVideoTile({
  trackRef,
  name: nameProp,
  isActiveSpeaker = false,
  isLocal = false,
  size = 'normal',
  webcamStream: _webcamStream,
}: LiveKitVideoTileProps) {
  const participant = trackRef?.participant;
  const displayName = nameProp || participant?.name || participant?.identity || 'Unknown';

  // Guard: no participant means room hasn't connected this peer yet.
  // Render premium fallback — no LiveKit hooks called.
  if (!participant) {
    return (
      <ConnectingTileFallback
        name={displayName}
        isLocal={isLocal}
        size={size}
      />
    );
  }

  // Connected path — participant is guaranteed non-null
  return (
    <LiveKitVideoTileConnected
      trackRef={trackRef!}
      participant={participant}
      name={displayName}
      isActiveSpeaker={isActiveSpeaker}
      isLocal={isLocal}
      size={size}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const tileStyles = StyleSheet.create({
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
    boxShadow: `inset 0 0 8px rgba(52, 199, 89, 0.2), 0 0 12px rgba(52, 199, 89, 0.15)`,
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
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 12,
  },
  qualityBar: {
    width: 3,
    borderRadius: 1,
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
  // Inner breathing ring — tight border, brighter glow
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
  // Outer breathing ring — wider glow via box-shadow (web), slightly inset on native
  outerBreathRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.accent.cyanLight,
    // Web-only: diffuse outer glow
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
