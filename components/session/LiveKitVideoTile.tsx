/**
 * LiveKitVideoTile
 *
 * Renders a real LiveKit video track for a participant.
 * Falls back to AvatarTileSurface when video is off.
 *
 * Uses:
 * - useIsSpeaking() for speaking indicator
 * - useConnectionQualityIndicator() for quality dot
 * - TrackReferenceOrPlaceholder for video attachment
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useIsSpeaking,
  useConnectionQualityIndicator,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { Track, ConnectionQuality } from 'livekit-client';
import { Colors } from '@/constants/tokens';
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
      return '#A1A1AA';
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

export function LiveKitVideoTile({
  trackRef,
  name: nameProp,
  isActiveSpeaker = false,
  isLocal = false,
  size = 'normal',
  webcamStream,
}: LiveKitVideoTileProps) {
  const participant = trackRef?.participant ?? undefined;
  const displayName = nameProp || participant?.name || participant?.identity || 'Unknown';

  // LiveKit hooks — safe to call with null participant (return defaults)
  const isSpeaking = useIsSpeaking(participant);
  const { quality } = useConnectionQualityIndicator({ participant });

  // Check if video track is available and enabled
  const publication = trackRef?.publication;
  const hasVideo = publication?.track != null && !publication.isMuted;

  const isSmall = size === 'small';
  const isSpotlight = size === 'spotlight';

  // Check if audio is muted
  const audioPublication = participant?.getTrackPublication(Track.Source.Microphone);
  const isMuted = audioPublication ? audioPublication.isMuted : true;

  const qualityColor = getQualityColor(quality);
  const qualityBars = getQualityBars(quality);

  return (
    <View style={[
      tileStyles.container,
      isSmall && tileStyles.containerSmall,
      isSpotlight && tileStyles.containerSpotlight,
      (isSpeaking || isActiveSpeaker) && { borderColor: isSpeaking ? Colors.semantic.success : Colors.accent.cyan, borderWidth: 2 },
    ]}>
      {/* Video track or avatar when video is off / not yet connected */}
      {hasVideo && trackRef ? (
        <LiveKitVideoView trackRef={trackRef} />
      ) : (
        <AvatarTileSurface
          name={displayName}
          seed={participant?.identity || 'unknown'}
          accentColor={isLocal ? '#2D3748' : '#374151'}
          size={isSmall ? 'small' : isSpotlight ? 'spotlight' : 'normal'}
          videoOff={true}
          style={tileStyles.avatarFill}
        />
      )}

      {/* Speaking glow overlay */}
      {isSpeaking && (
        <View style={tileStyles.speakingBorder} />
      )}

      {/* Bottom gradient overlay with name + indicators */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={tileStyles.bottomOverlay}
      >
        <View style={tileStyles.bottomRow}>
          <View style={tileStyles.nameContainer}>
            <Text style={[tileStyles.name, isSmall && tileStyles.nameSmall]} numberOfLines={1}>
              {displayName}
            </Text>
            {isLocal && (
              <View style={tileStyles.youBadge}>
                <Ionicons name="star" size={8} color={Colors.semantic.warning} />
              </View>
            )}
          </View>
          <View style={tileStyles.indicators}>
            {/* Connection quality bars */}
            <View style={tileStyles.qualityContainer}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    tileStyles.qualityBar,
                    { height: 4 + i * 2 },
                    i < qualityBars
                      ? { backgroundColor: qualityColor }
                      : { backgroundColor: '#3C3C3E' },
                  ]}
                />
              ))}
            </View>
            {/* Muted indicator */}
            {isMuted && (
              <View style={tileStyles.mutedBadge}>
                <Ionicons name="mic-off" size={10} color={Colors.semantic.error} />
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#141414',
    position: 'relative',
  },
  containerSmall: {
    borderRadius: 8,
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
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingTop: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D4D4D8',
  },
  nameSmall: {
    fontSize: 11,
  },
  youBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 160, 23, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
