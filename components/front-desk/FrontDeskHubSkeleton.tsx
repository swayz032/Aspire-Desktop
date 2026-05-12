import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrontDeskHeaderStrip } from '@/components/front-desk/FrontDeskHeaderStrip';
import { DialPadArtwork } from '@/components/front-desk/DialPadArtwork';
import { InboxRail } from '@/components/front-desk/InboxRail';
import { TodayFeed } from '@/components/front-desk/TodayFeed';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { ActionToastBar } from '@/components/front-desk/ActionToastBar';
import { fetchFrontDeskConfig } from '@/lib/api/frontDesk';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { FrontDeskProvider } from '@/lib/context/FrontDeskContext';
import {
  useTiffanyVoiceSession,
  type VoiceSessionState,
} from '@/hooks/useTiffanyVoiceSession';

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

function StageVideo({ personaName }: { personaName: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <div style={videoModeWrap}>
      <img
        src="/tiffany-reception.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // Subtle Ken-Burns at idle (matches Ava Desk feel)
          transform: 'scale(1.04)',
          filter: 'saturate(1.05)',
        }}
      />
      {/* Dim overlay so the foreground UI stays readable */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(70% 50% at 50% 50%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Centered foreground */}
      <div style={videoModeCenter}>
        <div style={videoIconRing}>
          <div style={videoIconCore}>
            <Ionicons name="videocam" size={28} color="#ffffff" />
          </div>
        </div>
        <div style={videoTitle}>{`Video with ${personaName}`}</div>
        <div style={videoSubtitle}>Start a face-to-face session</div>
        <button
          style={connectBtn}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLElement).style.boxShadow =
              '0 14px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.30)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow =
              '0 10px 22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)';
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.98)';
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          }}
        >
          <Ionicons name="videocam" size={18} color="#ffffff" />
          <span style={connectBtnLabel}>{`Connect to ${personaName}`}</span>
        </button>
      </div>
    </div>
  );
}

function playbackRateForState(state: VoiceSessionState): number {
  switch (state) {
    case 'listening':
      return 1.0;
    case 'processing':
      return 1.5;
    case 'responding':
      return 1.2;
    case 'connecting':
    case 'error':
    case 'idle':
    default:
      return 0.85;
  }
}

function StageBlob({ state = 'idle' as VoiceSessionState }: { state?: VoiceSessionState } = {}) {
  const ref = useRef<HTMLVideoElement>(null);

  // React to state changes by adjusting playbackRate on the existing video.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const v = ref.current;
    if (!v) return;
    try { v.playbackRate = playbackRateForState(state); } catch {}
  }, [state]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = false;
    v.playsInline = true;
    try { v.playbackRate = playbackRateForState(state); } catch {}
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

function VoiceTapButton({
  state,
  onClick,
}: {
  state: VoiceSessionState;
  onClick: () => void;
}) {
  if (Platform.OS !== 'web') {
    return (
      <Pressable
        accessibilityLabel="Voice tap — start or end session"
        accessibilityRole="button"
        onPress={onClick}
        style={voiceBtnStyles.nativeFallback}
      >
        <Ionicons name={state === 'idle' || state === 'error' ? 'mic' : 'stop'} size={24} color="#fff" />
      </Pressable>
    );
  }

  const isActive =
    state === 'connecting' ||
    state === 'listening' ||
    state === 'processing' ||
    state === 'responding';

  const activeBg =
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
  const idleBg =
    'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)';
  const errorBg =
    'linear-gradient(135deg, #EF4444 0%, #B91C1C 70%, #7C3AED 100%)';

  const bg = isActive ? activeBg : state === 'error' ? errorBg : idleBg;
  const iconName: keyof typeof Ionicons.glyphMap = isActive ? 'stop' : 'mic';
  const ariaLabel = isActive
    ? 'End voice session with Tiffany'
    : state === 'error'
      ? 'Retry voice session with Tiffany'
      : 'Start voice session with Tiffany';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        backgroundImage: bg,
        // Neutral depth shadow only — no colored glow / light bleed.
        boxShadow: [
          '0 10px 22px rgba(0,0,0,0.55)',
          '0 3px 6px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.25)',
          'inset 0 -2px 6px rgba(0,0,0,0.30)',
        ].join(', '),
        transition: 'transform 0.15s ease, box-shadow 0.2s ease, background-image 0.2s ease',
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
      <Ionicons name={iconName} size={28} color="#ffffff" />
    </button>
  );
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function LiveTimerChip({ personaName, elapsedSec }: { personaName: string; elapsedSec: number }) {
  if (Platform.OS !== 'web') {
    return (
      <View style={timerChipStyles.native}>
        <View style={timerChipStyles.dot} />
        <Text style={timerChipStyles.text}>{`Live with ${personaName} · ${formatTimer(elapsedSec)}`}</Text>
      </View>
    );
  }
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 12,
        paddingRight: 14,
        borderRadius: 999,
        background: 'rgba(10,10,12,0.65)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: '#22c55e',
          boxShadow: '0 0 0 3px rgba(34,197,94,0.18)',
          animation: 'tiffanyPulse 1.4s ease-in-out infinite',
          display: 'inline-block',
        }}
      />
      <span
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: 0.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {`Live with ${personaName} · ${formatTimer(elapsedSec)}`}
      </span>
      <style>{`@keyframes tiffanyPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.85); } }`}</style>
    </div>
  );
}

function VerifiedToast({ receiptId, onDismiss }: { receiptId: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const shortId = receiptId.length > 12 ? `${receiptId.slice(0, 6)}…${receiptId.slice(-4)}` : receiptId;

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={onDismiss} style={toastStyles.native}>
        <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
        <Text style={toastStyles.text}>{`Verified ✓ ${shortId}`}</Text>
      </Pressable>
    );
  }
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss receipt confirmation"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 14,
        paddingRight: 16,
        borderRadius: 999,
        background: 'rgba(10,10,12,0.75)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        animation: 'tiffanyToastIn 0.18s ease-out',
      }}
    >
      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
      <span
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: 0.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {`Verified ✓ ${shortId}`}
      </span>
      <style>{`@keyframes tiffanyToastIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
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
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const [mode, setMode] = useState<StageMode>('voice');
  // Default persona = Tiffany (founder lock 2026-05-12). FrontDeskConfig
  // override still wins if the user picks a different persona in Setup.
  const [persona, setPersona] = useState<Persona>('tiffany');

  const voice = useTiffanyVoiceSession();
  const [toastReceiptId, setToastReceiptId] = useState<string | null>(null);

  // Surface a "Verified ✓ {receipt}" toast whenever a session ends.
  useEffect(() => {
    if (voice.lastReceiptId) {
      setToastReceiptId(voice.lastReceiptId);
    }
  }, [voice.lastReceiptId]);

  const sessionActive =
    voice.state === 'connecting' ||
    voice.state === 'listening' ||
    voice.state === 'processing' ||
    voice.state === 'responding';

  const handleModeChange = useCallback(
    (next: StageMode) => {
      if (sessionActive && next === 'video') {
        // End the live Tiffany voice session before switching to Video.
        void voice.end();
      }
      setMode(next);
    },
    [sessionActive, voice],
  );

  const handleMicTap = useCallback(() => {
    if (voice.state === 'idle') {
      void voice.start();
      return;
    }
    if (voice.state === 'error') {
      void voice.start();
      return;
    }
    // Any active state → end.
    void voice.end();
  }, [voice]);

  // Pass I P0 fix: thread the required {authenticatedFetch, officeId} into
  // fetchFrontDeskConfig (was previously called with zero args — runtime crash
  // and tenant-isolation gap per Law #6). Guard the effect so it only fires
  // once tenant resolution lands.
  useEffect(() => {
    const officeId = tenant?.officeId;
    if (!officeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchFrontDeskConfig({ authenticatedFetch, officeId });
        const slug = (res?.config as any)?.receptionist_persona;
        if (!cancelled && (slug === 'sarah' || slug === 'tiffany')) {
          setPersona(slug);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [authenticatedFetch, tenant?.officeId]);

  const personaName = PERSONA_DISPLAY[persona];

  return (
    <FrontDeskProvider personaName={personaName}>
    <View style={styles.outer}>
      <FrontDeskHeaderStrip />
      <View style={[styles.root, twoCol ? styles.rootRow : styles.rootStack]}>
        <View style={styles.mainCol}>
          <View style={[styles.card, styles.stageCard, { flex: 7 }]}>
            <View style={styles.toggleSlot}>
              <StageToggle mode={mode} personaName={personaName} onChange={handleModeChange} />
            </View>
            {/* Live session timer — centered at the top of the stage. */}
            {mode === 'voice' && sessionActive ? (
              <View style={[styles.timerSlot, { pointerEvents: 'none' }]}>
                <LiveTimerChip personaName={personaName} elapsedSec={voice.elapsedSec} />
              </View>
            ) : null}
            <View style={styles.stageCenter}>
              {mode === 'voice' ? <StageBlob state={voice.state} /> : <StageVideo personaName={personaName} />}
            </View>
            {/* Error overlay — only in Voice mode when the session failed. */}
            {mode === 'voice' && voice.state === 'error' && voice.errorMessage ? (
              <View style={styles.errorOverlay}>
                <ErrorState message={voice.errorMessage} onRetry={() => void voice.start()} />
              </View>
            ) : null}
            {/* Voice tap mic only shows in Voice mode — Video has its own
                Connect-to-{persona} CTA centered in the stage. */}
            {mode === 'voice' ? (
              <View style={styles.voiceBtnSlot}>
                <VoiceTapButton state={voice.state} onClick={handleMicTap} />
              </View>
            ) : null}
            {/* Verified ✓ toast — bottom-center, auto-dismiss after 3s. */}
            {toastReceiptId ? (
              <View style={[styles.toastSlot, { pointerEvents: 'box-none' }]}>
                <VerifiedToast receiptId={toastReceiptId} onDismiss={() => setToastReceiptId(null)} />
              </View>
            ) : null}
          </View>
          <View style={[styles.glassCard, { flex: 3 }]}>
            <TodayFeed />
          </View>
        </View>
        <View style={twoCol ? styles.railCol : styles.railColStacked}>
          <InboxRail />
          <DialPadArtwork />
        </View>
      </View>
      {/* Pass F: action receipt toasts — bottom-center above all cards */}
      <ActionToastBar />
    </View>
    </FrontDeskProvider>
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
  glassCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #050507 0%, #000000 100%)',
        } as any)
      : null),
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
  timerSlot: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9,
  },
  errorOverlay: {
    position: 'absolute',
    inset: 0 as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 12,
  },
  toastSlot: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 13,
  },
});

const timerChipStyles = StyleSheet.create({
  native: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,12,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
});

const toastStyles = StyleSheet.create({
  native: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,12,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
});

const videoModeWrap: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const videoModeCenter: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  paddingLeft: 24,
  paddingRight: 24,
  textAlign: 'center',
};

const videoIconRing: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 48,
  background:
    'radial-gradient(60% 60% at 50% 50%, rgba(239,68,68,0.40) 0%, rgba(124,58,237,0.32) 50%, rgba(59,130,246,0.40) 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow:
    '0 0 0 1px rgba(255,255,255,0.10) inset, 0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.25)',
  marginBottom: 4,
};

const videoIconCore: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundImage:
    'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.30), 0 6px 14px rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const videoTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 22,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: -0.3,
  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
};

const videoSubtitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 400,
  color: 'rgba(255,255,255,0.75)',
  marginBottom: 6,
  textShadow: '0 2px 8px rgba(0,0,0,0.6)',
};

const connectBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 44,
  paddingLeft: 18,
  paddingRight: 20,
  borderRadius: 22,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  backgroundImage:
    'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)',
  boxShadow:
    '0 10px 22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
  transition: 'transform 0.12s ease, box-shadow 0.15s ease',
};

const connectBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: 0.2,
};

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
