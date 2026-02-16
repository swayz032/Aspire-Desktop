import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { AvaVoiceStrip } from './AvaVoiceStrip';

/**
 * Renders a LiveKit HTMLVideoElement inside a React Native View (web only).
 */
function VideoTrackView({ videoEl }: { videoEl: HTMLVideoElement }) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current || !videoEl) return;
    const container = containerRef.current;
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    container.appendChild(videoEl);
    return () => {
      if (container.contains(videoEl)) {
        container.removeChild(videoEl);
      }
    };
  }, [videoEl]);

  return (
    <View
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' } as any}
    />
  );
}

export interface ConferenceParticipant {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  avatarColor?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  isHost?: boolean;
  avaTaskCount?: number;
  avaActive?: boolean;
}

interface ParticipantTileProps {
  participant: ConferenceParticipant;
  size?: 'small' | 'medium' | 'large';
  isActiveSpeaker?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Optional LiveKit video track element for rendering real video */
  videoTrack?: HTMLVideoElement | null;
}

export function ParticipantTile({
  participant,
  size = 'medium',
  isActiveSpeaker = false,
  onPress,
  onLongPress,
  videoTrack,
}: ParticipantTileProps) {
  const { 
    name, 
    role, 
    avatarUrl, 
    avatarColor = Colors.accent.cyan,
    isMuted = false, 
    isVideoOff = false, 
    isSpeaking = false,
    isHandRaised = false,
    isHost = false,
    avaTaskCount = 0,
    avaActive = true,
  } = participant;

  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isSpeaking]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const tileSize = size === 'small' ? 140 : size === 'large' ? 320 : 200;
  const tileHeight = size === 'small' ? 105 : size === 'large' ? 240 : 150;
  const initialsSize = size === 'small' ? 24 : size === 'large' ? 48 : 36;
  const nameSize = size === 'small' ? 11 : size === 'large' ? 15 : 13;
  const roleSize = size === 'small' ? 9 : size === 'large' ? 12 : 10;

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(79, 172, 254, 0)', 'rgba(79, 172, 254, 0.6)'],
  });

  const speakingBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(52, 199, 89, 0.3)', 'rgba(52, 199, 89, 0.9)'],
  });

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <Pressable 
        style={[
          styles.container, 
          { width: tileSize, height: tileHeight },
          isActiveSpeaker && styles.activeSpeaker,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />

        {isVideoOff ? (
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[avatarColor, `${avatarColor}99`, `${avatarColor}66`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.initials, { fontSize: initialsSize }]}>{initials}</Text>
              )}
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.videoFeed}>
            {videoTrack && Platform.OS === 'web' ? (
              <VideoTrackView videoEl={videoTrack} />
            ) : (
              <LinearGradient
                colors={['#2d3436', '#636e72', '#2d3436']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.videoPlaceholder}
              >
                <View style={[styles.miniAvatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.miniInitials}>{initials}</Text>
                </View>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.7)']}
              style={styles.videoOverlay}
            />
          </View>
        )}

        <View style={styles.glassOverlay}>
          <View style={styles.topRow}>
            {isHost && (
              <View style={styles.hostBadge}>
                <LinearGradient
                  colors={['rgba(212, 160, 23, 0.3)', 'rgba(212, 160, 23, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hostBadgeGradient}
                >
                  <Ionicons name="star" size={10} color={Colors.semantic.warning} />
                  <Text style={styles.hostText}>Host</Text>
                </LinearGradient>
              </View>
            )}
            
            <View style={styles.topRightBadges}>
              {isHandRaised && (
                <View style={styles.handBadge}>
                  <Text style={styles.handEmoji}>✋</Text>
                </View>
              )}
              {isMuted && (
                <View style={styles.mutedBadge}>
                  <Ionicons name="mic-off" size={10} color={Colors.semantic.error} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.infoBar}>
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.infoBarGradient}
              >
                <View style={styles.nameSection}>
                  <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>{name}</Text>
                  {role && <Text style={[styles.role, { fontSize: roleSize }]} numberOfLines={1}>{role}</Text>}
                </View>
                
                {isSpeaking && (
                  <View style={styles.speakingIndicator}>
                    <View style={styles.waveContainer}>
                      {[0, 1, 2, 3].map((i) => (
                        <Animated.View 
                          key={i}
                          style={[
                            styles.waveBar,
                            { 
                              height: 8 + (Math.sin(Date.now() / 200 + i) + 1) * 4,
                              opacity: glowAnim,
                            }
                          ]} 
                        />
                      ))}
                    </View>
                  </View>
                )}
              </LinearGradient>
            </View>

            <View style={styles.avaContainer}>
              <AvaVoiceStrip 
                participantName={name}
                isActive={avaActive}
                isSpeaking={isSpeaking}
                taskCount={avaTaskCount}
              />
            </View>
          </View>
        </View>

        {isSpeaking && (
          <Animated.View 
            style={[
              styles.speakingGlow,
              { 
                borderColor: speakingBorderColor,
                shadowColor: Colors.semantic.success,
                shadowOpacity: glowAnim,
              }
            ]} 
          />
        )}

        {isActiveSpeaker && !isSpeaking && (
          <View style={styles.activeSpeakerBorder} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  activeSpeaker: {
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  videoFeed: {
    flex: 1,
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  miniAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hostBadge: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  hostBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  hostText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 0.5,
  },
  topRightBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  handBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212, 160, 23, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handEmoji: {
    fontSize: 11,
  },
  mutedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    gap: 4,
  },
  infoBar: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  infoBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  role: {
    color: Colors.text.tertiary,
    fontWeight: '500',
    marginTop: 1,
  },
  speakingIndicator: {
    marginLeft: Spacing.xs,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  waveBar: {
    width: 2,
    backgroundColor: Colors.semantic.success,
    borderRadius: 1,
  },
  avaContainer: {
    alignSelf: 'flex-start',
  },
  speakingGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: BorderRadius.lg + 1,
    borderWidth: 2,
    shadowRadius: 12,
  },
  activeSpeakerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
});
