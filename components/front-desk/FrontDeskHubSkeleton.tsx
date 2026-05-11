import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

const CARD_BG = '#1C1C1E';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const CARD_RADIUS = 14;
const STAGE_BG = '#000000';

const BREAKPOINT_TWO_COL = 1100;

function StageBlob() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    // IMPORTANT: native `loop` attribute is intentionally OFF. Chromium pauses
    // for ~50ms each loop iteration which the founder sees as a "tiny skip".
    // We drive the loop manually below — seek back to 0 a fraction of a second
    // BEFORE the natural end, so playback never reaches the discontinuity.
    v.loop = false;
    v.playsInline = true;
    try { v.playbackRate = 0.85; } catch {}
    v.play().catch(() => {});

    const SEEK_LEAD = 0.08; // 80ms before end — well outside any decoder latency
    const onTimeUpdate = () => {
      if (!v.duration || !Number.isFinite(v.duration)) return;
      if (v.currentTime >= v.duration - SEEK_LEAD) {
        // Use fastSeek when available — non-blocking, avoids the I-frame stall
        // that currentTime= triggers on some encoders.
        try {
          if (typeof (v as any).fastSeek === 'function') {
            (v as any).fastSeek(0);
          } else {
            v.currentTime = 0;
          }
        } catch {}
      }
    };
    // requestVideoFrameCallback fires per-frame; timeupdate fires every ~250ms
    // which is too coarse for an 80ms lead. Prefer rvfc when available.
    let rvfcId: number | null = null;
    const useRvfc = typeof (v as any).requestVideoFrameCallback === 'function';
    const rvfcLoop = () => {
      onTimeUpdate();
      rvfcId = (v as any).requestVideoFrameCallback(rvfcLoop);
    };
    if (useRvfc) {
      rvfcId = (v as any).requestVideoFrameCallback(rvfcLoop);
    } else {
      v.addEventListener('timeupdate', onTimeUpdate);
    }

    return () => {
      if (useRvfc && rvfcId !== null && typeof (v as any).cancelVideoFrameCallback === 'function') {
        (v as any).cancelVideoFrameCallback(rvfcId);
      }
      v.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  // Seamless palindrome (forward+reverse concat via ffmpeg) — eliminates the
  // visible loop seam. 1080p / 282KB / 5.84s (was 4K / 5.3MB / 2.93s).
  // Hardcoded absolute path — resolvePublicAssetUrl() joins against
  // document.baseURI which on /session/front-desk produced /session/...mp4 (404).
  const src = '/tiffany-sarah-orb-loop.mp4';

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      disableRemotePlayback
      style={{
        width: 'min(60%, 520px)',
        height: 'auto',
        maxHeight: '85%',
        objectFit: 'contain',
        pointerEvents: 'none',
        background: 'transparent',
        // GPU-accelerated compositing — fixes the stutter/lag the founder
        // saw at 5.3MB MP4 size. translateZ(0) promotes the video into its
        // own compositing layer so the GPU decodes + paints without the
        // CPU-fallback path that React Native Web's parent View triggers.
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    />
  );
}

export function FrontDeskHubSkeleton() {
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT_TWO_COL;

  return (
    <View style={[styles.root, twoCol ? styles.rootRow : styles.rootStack]}>
      <View style={styles.mainCol}>
        <View style={[styles.card, styles.stageCard, { flex: 7 }]}>
          <View style={styles.stageCenter}>
            <StageBlob />
          </View>
        </View>
        <View style={[styles.card, { flex: 3 }]} />
      </View>
      <View style={twoCol ? styles.railCol : styles.railColStacked}>
        <View style={[styles.card, { flex: 6 }]} />
        <View style={[styles.card, { flex: 4 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 16,
    padding: 16,
    minHeight: 0,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  },
  rootRow: { flexDirection: 'row' },
  rootStack: { flexDirection: 'column' },
  mainCol: { flex: 1, gap: 16, minWidth: 0, minHeight: 0 },
  railCol: { width: 380, gap: 16, minHeight: 0 },
  railColStacked: { width: '100%', gap: 16, minHeight: 0, flex: 1 },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: CARD_RADIUS,
  },
  stageCard: {
    backgroundColor: STAGE_BG,
    overflow: 'hidden',
  },
  stageCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
