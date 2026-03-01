/**
 * AvaOrb — Shared Ava video orb component.
 *
 * Plays the ava-orb.mp4 looping video as a floating circular orb.
 * Used in both AvaDeskPanel (home) and CanvasWorkspace (canvas chat mode).
 * No controls overlay — just the pure animated orb.
 */

import React, { useEffect, useRef } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface AvaOrbProps {
  size?: number;
}

export function AvaOrb({ size = 320 }: AvaOrbProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        video.ava-orb-shared::-webkit-media-controls,
        video.ava-orb-shared::-webkit-media-controls-enclosure,
        video.ava-orb-shared::-webkit-media-controls-panel,
        video.ava-orb-shared::-webkit-media-controls-start-playback-button,
        video.ava-orb-shared::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        video.ava-orb-shared::-moz-media-controls { display: none !important; }
        video.ava-orb-shared { object-fit: contain; }
      `;
      document.head.appendChild(style);

      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.play().catch(() => {});
      }

      return () => { document.head.removeChild(style); };
    }
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.nativeFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="sparkles" size={size * 0.3} color={Colors.accent.cyan} />
      </View>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <video
        ref={videoRef as any}
        className="ava-orb-shared"
        src="/ava-orb.mp4"
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          background: 'transparent',
        }}
      />
      {/* Transparent overlay to prevent video controls on hover */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, background: 'transparent' }} />
    </div>
  );
}

const styles = StyleSheet.create({
  nativeFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
});
