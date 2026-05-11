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
          'linear-gradient(135deg, #EF4444 0%, #3B82F6 50%, #8B5CF6 100%)',
        // 3D floating: deep ambient drop, subtle colored glow, inset top highlight + bottom shadow
        boxShadow: [
          '0 18px 36px -10px rgba(139,92,246,0.55)',
          '0 8px 18px -4px rgba(59,130,246,0.45)',
          '0 2px 4px rgba(0,0,0,0.6)',
          'inset 0 1px 0 rgba(255,255,255,0.35)',
          'inset 0 -2px 6px rgba(0,0,0,0.35)',
        ].join(', '),
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.04)';
        (e.currentTarget as HTMLElement).style.boxShadow = [
          '0 24px 44px -10px rgba(139,92,246,0.7)',
          '0 12px 22px -4px rgba(59,130,246,0.6)',
          '0 2px 4px rgba(0,0,0,0.6)',
          'inset 0 1px 0 rgba(255,255,255,0.4)',
          'inset 0 -2px 6px rgba(0,0,0,0.35)',
        ].join(', ');
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = [
          '0 18px 36px -10px rgba(139,92,246,0.55)',
          '0 8px 18px -4px rgba(59,130,246,0.45)',
          '0 2px 4px rgba(0,0,0,0.6)',
          'inset 0 1px 0 rgba(255,255,255,0.35)',
          'inset 0 -2px 6px rgba(0,0,0,0.35)',
        ].join(', ');
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.98)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.04)';
      }}
    >
      {/* glossy top highlight overlay */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 4,
          left: 8,
          right: 8,
          height: 22,
          borderRadius: 22,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
        }}
      />
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
