/**
 * TiffanySarahOrbVideo — 3D blob loop for the Front Desk Voice mode.
 *
 * Mirrors `components/AvaOrbVideo.tsx` pattern exactly:
 *   - State-driven playback rate (idle / listening / processing / responding)
 *   - Plays a public-asset MP4 with className `aspire-live-video` so the
 *     canonical global CSS injector in `lib/liveVideoCss.ts` (covers 12
 *     WebKit+Mozilla pseudo-elements) hides the UA play button + overlay.
 *     Component-local CSS injection was removed in the Pass 1 critic
 *     sub-pass — single source of truth lives in liveVideoCss.ts.
 *   - Transparent video over a solid `#000` parent (matches "Voice with
 *     Ava" treatment).
 *
 * The video file (`/tiffany-sarah-orb.mp4`) is shared between the Tiffany
 * and Sarah personas — Pass 1 plumbs the `personaName` prop end-to-end so
 * downstream passes can swap visuals per persona without restructuring.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl';
import { ensureLiveVideoCssInstalled } from '@/lib/liveVideoCss';

export type ReceptionistOrbState = 'idle' | 'listening' | 'processing' | 'responding';

interface TiffanySarahOrbVideoProps {
  state?: ReceptionistOrbState;
  size?: number;
  /**
   * Selected receptionist persona display name ("Sarah" | "Tiffany").
   * Plumbed for future per-persona visual variants. Pass 1 uses one
   * shared blob loop file for both personas.
   */
  personaName?: string;
}

const stateConfig: Record<ReceptionistOrbState, { playbackRate: number; pulseScale: number }> = {
  idle: { playbackRate: 0.6, pulseScale: 1.0 },
  listening: { playbackRate: 1.0, pulseScale: 1.02 },
  processing: { playbackRate: 1.5, pulseScale: 1.05 },
  responding: { playbackRate: 1.2, pulseScale: 1.03 },
};

function TiffanySarahOrbVideoInner({ state = 'idle', size = 320, personaName: _personaName }: TiffanySarahOrbVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const config = stateConfig[state];
  const orbSrc = resolvePublicAssetUrl('tiffany-sarah-orb.mp4');

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Use the canonical global injector (covers 12 pseudo-elements across
      // WebKit + Mozilla). Replaces the previous local 5-pseudo block.
      ensureLiveVideoCssInstalled();
      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        try {
          vid.playbackRate = config.playbackRate;
        } catch {}
        vid.play().catch(() => {});
      }
    }
  }, [state, config.playbackRate]);

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
          className="aspire-live-video"
          src={orbSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          style={{
            width: size * 1.5,
            height: size * 1.5,
            objectFit: 'cover',
            transform: `scale(${config.pulseScale})`,
          }}
        />
        {/* Transparent click-blocker so the UA play overlay never wins on Safari */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10,
            background: 'transparent',
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
  fallbackOrb: {
    overflow: 'hidden',
  },
});

export default TiffanySarahOrbVideoInner;

export function TiffanySarahOrbVideo(props: TiffanySarahOrbVideoProps) {
  return (
    <PageErrorBoundary pageName="tiffany-sarah-orb-video">
      <TiffanySarahOrbVideoInner {...props} />
    </PageErrorBoundary>
  );
}
