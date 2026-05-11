import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrontDeskHeaderStrip } from '@/components/front-desk/FrontDeskHeaderStrip';
import { fetchFrontDeskConfig } from '@/lib/api/frontDesk';

const CARD_BG = '#1C1C1E';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const CARD_RADIUS = 14;
const STAGE_BG = '#000000';

const BREAKPOINT_TWO_COL = 1100;

type StageMode = 'voice' | 'video';
type Persona = 'sarah' | 'tiffany';

const PERSONA_DISPLAY: Record<Persona, string> = {
  sarah: 'Sarah',
  tiffany: 'Tiffany',
};

function StageBlob() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = false;
    v.playsInline = true;
    try { v.playbackRate = 0.85; } catch {}
    v.play().catch(() => {});

    const SEEK_LEAD = 0.08;
    const onTimeUpdate = () => {
      if (!v.duration || !Number.isFinite(v.duration)) return;
      if (v.currentTime >= v.duration - SEEK_LEAD) {
        try {
          if (typeof (v as any).fastSeek === 'function') {
            (v as any).fastSeek(0);
          } else {
            v.currentTime = 0;
          }
        } catch {}
      }
    };
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

  if (Platform.OS !== 'web') return null;

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
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    />
  );
}

function VoiceTapButton() {
  if (Platform.OS !== 'web') {
    return (
      <View style={voiceBtnStyles.nativeFallback}>
        <Ionicons name="call" size={24} color="#fff" />
      </View>
    );
  }
  return (
    <button
      type="button"
      aria-label="Voice tap — start or end session"
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        // Tri-stop conic-ish via linear-gradient at 135deg — red -> Aspire blue -> violet
        backgroundImage:
          // Heavy red on top-left, heavy Aspire blue on bottom-right,
          // violet only as a thin transition smudge at the midpoint.
          'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)',
        // Neutral depth shadow only — no colored glow / light bleed.
        boxShadow: [
          '0 10px 22px rgba(0,0,0,0.55)',
          '0 3px 6px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.25)',
          'inset 0 -2px 6px rgba(0,0,0,0.30)',
        ].join(', '),
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.04)';
        (e.currentTarget as HTMLElement).style.boxShadow = [
          '0 14px 28px rgba(0,0,0,0.65)',
          '0 4px 8px rgba(0,0,0,0.5)',
          'inset 0 1px 0 rgba(255,255,255,0.30)',
          'inset 0 -2px 6px rgba(0,0,0,0.30)',
        ].join(', ');
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = [
          '0 10px 22px rgba(0,0,0,0.55)',
          '0 3px 6px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.25)',
          'inset 0 -2px 6px rgba(0,0,0,0.30)',
        ].join(', ');
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.98)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.04)';
      }}
    >
      <Ionicons name="call" size={28} color="#ffffff" />
    </button>
  );
}

function StageToggle({
  mode,
  personaName,
  onChange,
}: {
  mode: StageMode;
  personaName: string;
  onChange: (m: StageMode) => void;
}) {
  return (
    <View style={toggleStyles.tabs}>
      <ToggleBtn
        label={`Voice with ${personaName}`}
        icon="mic"
        active={mode === 'voice'}
        onPress={() => onChange('voice')}
      />
      <ToggleBtn
        label={`Video with ${personaName}`}
        icon="videocam"
        active={mode === 'video'}
        onPress={() => onChange('video')}
      />
    </View>
  );
}

function ToggleBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[toggleStyles.btn, active && toggleStyles.btnActive]}
    >
      <Ionicons name={icon} size={14} color={active ? '#ffffff' : 'rgba(255,255,255,0.55)'} />
      <Text style={[toggleStyles.text, active && toggleStyles.textActive]}>{label}</Text>
    </Pressable>
  );
}

export function FrontDeskHubSkeleton() {
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT_TWO_COL;
  const [mode, setMode] = useState<StageMode>('voice');
  const [persona, setPersona] = useState<Persona>('sarah');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchFrontDeskConfig();
        const slug = (res?.config as any)?.receptionist_persona;
        if (!cancelled && (slug === 'sarah' || slug === 'tiffany')) {
          setPersona(slug);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const personaName = PERSONA_DISPLAY[persona];

  return (
    <View style={styles.outer}>
      <FrontDeskHeaderStrip />
      <View style={[styles.root, twoCol ? styles.rootRow : styles.rootStack]}>
        <View style={styles.mainCol}>
          <View style={[styles.card, styles.stageCard, { flex: 7 }]}>
            <View style={styles.toggleSlot}>
              <StageToggle mode={mode} personaName={personaName} onChange={setMode} />
            </View>
            <View style={styles.stageCenter}>
              {mode === 'voice' ? <StageBlob /> : null}
            </View>
            <View style={styles.voiceBtnSlot}>
              <VoiceTapButton />
            </View>
          </View>
          <View style={[styles.card, { flex: 3 }]} />
        </View>
        <View style={twoCol ? styles.railCol : styles.railColStacked}>
          <View style={[styles.card, { flex: 6 }]} />
          <View style={[styles.card, { flex: 4 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    minHeight: 0,
  },
  root: {
    flex: 1,
    gap: 16,
    paddingTop: 12,
    minHeight: 0,
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
    position: 'relative',
  },
  toggleSlot: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  voiceBtnSlot: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 11,
  },
  stageCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const voiceBtnStyles = StyleSheet.create({
  nativeFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const toggleStyles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(20,20,22,0.85)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any) : null),
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : null),
  },
  btnActive: {
    backgroundColor: '#242426',
  },
  text: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  textActive: {
    color: '#ffffff',
  },
});
