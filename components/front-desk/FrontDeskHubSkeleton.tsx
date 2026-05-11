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
    v.loop = true;
    v.playsInline = true;
    v.play().catch(() => {});
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  // Hardcoded absolute path — resolvePublicAssetUrl() joins against document.baseURI
  // which on /session/front-desk produces /session/tiffany-sarah-orb.mp4 (404).
  const src = '/tiffany-sarah-orb.mp4';

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
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
