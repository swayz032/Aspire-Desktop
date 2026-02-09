import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type OrbState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaOrbVideoProps {
  state: OrbState;
  size?: number;
}

const stateConfig = {
  idle: { playbackRate: 0.6, glowOpacity: 0.4, pulseScale: 1.0 },
  listening: { playbackRate: 1.0, glowOpacity: 0.6, pulseScale: 1.02 },
  processing: { playbackRate: 1.5, glowOpacity: 0.8, pulseScale: 1.05 },
  responding: { playbackRate: 1.2, glowOpacity: 0.7, pulseScale: 1.03 },
};

export function AvaOrbVideo({ state, size = 300 }: AvaOrbVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const config = stateConfig[state];

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      try {
        videoRef.current.playbackRate = config.playbackRate;
        videoRef.current.play().catch(() => {});
      } catch (e) {}
    }
  }, [state, config.playbackRate]);

  const glowSize = size * 1.5;

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={[styles.fallbackOrb, { width: size, height: size, borderRadius: size / 2 }]}>
          <LinearGradient
            colors={['#0088ff', '#3B82F6', '#0066cc']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.videoContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        <video
          ref={videoRef}
          src="/ava-orb.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            width: size * 1.5,
            height: size * 1.5,
            objectFit: 'cover',
            transform: `scale(${config.pulseScale})`,
          }}
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingFallback: {
    position: 'absolute',
    overflow: 'hidden',
  },
  fallbackOrb: {
    overflow: 'hidden',
  },
});

export default AvaOrbVideo;
