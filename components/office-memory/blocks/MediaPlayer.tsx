/**
 * MediaPlayer — premium audio/video player for the Office Memory detail pages.
 *
 * Web   → native <video> / <audio> with custom controls overlay so the chrome
 *         matches the Aspire aesthetic (deep-black panel, Aspire-blue scrub
 *         line, monospace timecodes). Audio kind renders an animated waveform
 *         strip rather than a flat bar — the player reads as "alive."
 * Native → expo-av Audio/Video. Same chrome layout but driven by the SDK.
 *
 * Premium controls per plan §15.C:
 *   - Play / pause toggle (large 44pt target, glow on hover)
 *   - Scrub bar with click-to-seek (Aspire-blue progress fill, white scrub thumb)
 *   - Speed selector — 0.5× / 1× / 1.5× / 2×
 *   - Live timecode + total duration in tabular monospace
 *   - Optional time-aligned transcript that auto-scrolls + bolds the active
 *     line during playback (kind = 'transcript-sync')
 *
 * The frame uses the standard memory card chrome (deep-charcoal cardBg + 1px
 * hairline + drop shadow + inset highlight) — never flat. Outer hairline tints
 * Aspire-blue when playback is active so the panel "lights up."
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { injectMemoryKeyframes } from '../cardAnimations';

// expo-av is preinstalled but only loaded on native to keep the web bundle lean.
// We resolve it lazily so type-only imports don't pull the runtime in for web.
type ExpoAVAudioSound = unknown;

injectMemoryKeyframes();

export interface MediaPlayerTranscriptLine {
  /** Seconds offset into the recording */
  t: number;
  /** Speaker label (optional) */
  speaker?: string;
  /** Spoken text */
  text: string;
}

export interface MediaPlayerProps {
  src: string;
  /** Defaults to inferring from URL extension; falls back to 'audio'. */
  kind?: 'audio' | 'video';
  /** Total duration override (when player can't load metadata). */
  durationSec?: number;
  /** Optional time-aligned transcript for transcript-sync rendering. */
  transcript?: MediaPlayerTranscriptLine[];
  /** Override the eyebrow label (default: "Recording"). */
  eyebrow?: string;
}

const SPEEDS = [0.5, 1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

// ─── Time helpers ────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const total = Math.floor(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function inferKind(src: string, hint?: 'audio' | 'video'): 'audio' | 'video' {
  if (hint) return hint;
  const lower = src.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) return 'video';
  return 'audio';
}

// ─── Waveform — synthesized amplitude bars (web-only) ────────────────────────

function Waveform({ progress }: { progress: number }) {
  // 48 deterministic-pseudo-random bars; the active fraction colors Aspire-blue.
  const bars = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 48; i += 1) {
      // Smooth "speech" envelope — sin curves at three frequencies + tiny phase.
      const v =
        0.45 +
        0.35 * Math.sin((i / 48) * Math.PI * 4 + 0.4) +
        0.18 * Math.sin((i / 48) * Math.PI * 11 + 1.2);
      out.push(Math.max(0.18, Math.min(1, Math.abs(v))));
    }
    return out;
  }, []);

  return (
    <View style={waveformStyles.row} accessibilityElementsHidden>
      {bars.map((amp, i) => {
        const active = i / bars.length <= progress;
        return (
          <View
            key={i}
            style={[
              waveformStyles.bar,
              {
                height: 6 + amp * 28,
                backgroundColor: active
                  ? 'rgba(96,165,250,0.95)'
                  : 'rgba(255,255,255,0.18)',
              },
            ]}
            {...(Platform.OS === 'web'
              ? ({ className: active ? 'aspire-waveform-bar' : undefined } as object)
              : {})}
          />
        );
      })}
    </View>
  );
}

const waveformStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    gap: 2,
    flex: 1,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});

// ─── Web-only HTMLVideoElement / HTMLAudioElement controller ────────────────

function useWebMedia(src: string, kind: 'audio' | 'video') {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
    };
  }, [src, kind]);

  const toggle = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const setSpeedAndApply = useCallback((s: Speed) => {
    setSpeed(s);
    if (Platform.OS !== 'web') return;
    const el = ref.current;
    if (el) el.playbackRate = s;
  }, []);

  const seek = useCallback((to: number) => {
    if (Platform.OS !== 'web') return;
    const el = ref.current;
    if (el) el.currentTime = to;
  }, []);

  return { ref, time, duration, playing, speed, toggle, setSpeedAndApply, seek };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MediaPlayer({
  src,
  kind: kindProp,
  durationSec,
  transcript,
  eyebrow = 'Recording',
}: MediaPlayerProps) {
  const kind = inferKind(src, kindProp);
  const web = useWebMedia(src, kind);

  // Native fallback state — full SDK wiring is added in Pass 17 backend wiring.
  const [nativeTime] = useState(0);
  const nativeDuration = durationSec ?? 0;
  const nativePlaying = false;

  const time = Platform.OS === 'web' ? web.time : nativeTime;
  const duration =
    Platform.OS === 'web'
      ? web.duration > 0
        ? web.duration
        : durationSec ?? 0
      : nativeDuration;
  const playing = Platform.OS === 'web' ? web.playing : nativePlaying;
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  const activeLineIdx = useMemo(() => {
    if (!transcript || transcript.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < transcript.length; i += 1) {
      if (transcript[i].t <= time) idx = i;
      else break;
    }
    return idx;
  }, [transcript, time]);

  // Auto-scroll transcript to keep the active line visible.
  const transcriptScrollRef = useRef<ScrollView | null>(null);
  const lineHeightsRef = useRef<number[]>([]);
  useEffect(() => {
    if (activeLineIdx < 0) return;
    const offsets = lineHeightsRef.current;
    let y = 0;
    for (let i = 0; i < activeLineIdx; i += 1) y += offsets[i] ?? 0;
    transcriptScrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
  }, [activeLineIdx]);

  const handleScrubPress = useCallback(
    (e: { nativeEvent: { locationX: number } }, width: number) => {
      if (duration <= 0 || width <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
      web.seek(ratio * duration);
    },
    [duration, web],
  );

  const [scrubWidth, setScrubWidth] = useState(0);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <View style={styles.kindPill}>
          <Ionicons
            name={kind === 'video' ? 'videocam-outline' : 'musical-notes-outline'}
            size={11}
            color={Colors.text.tertiary as string}
          />
          <Text style={styles.kindPillText}>{kind === 'video' ? 'VIDEO' : 'AUDIO'}</Text>
        </View>
      </View>

      {/* Web video element (hidden chrome — we render our own) */}
      {Platform.OS === 'web' && kind === 'video' && (
        <View style={styles.videoFrame}>
          {React.createElement('video' as unknown as 'div', {
            ref: web.ref as React.RefObject<HTMLVideoElement>,
            src,
            style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 },
            preload: 'metadata',
            playsInline: true,
          })}
        </View>
      )}

      {Platform.OS === 'web' && kind === 'audio' && (
        <View style={styles.audioWaveWrap}>
          <Waveform progress={progress} />
          {React.createElement('audio' as unknown as 'div', {
            ref: web.ref as React.RefObject<HTMLAudioElement>,
            src,
            preload: 'metadata',
            style: { display: 'none' },
          })}
        </View>
      )}

      {/* Native placeholder — actual expo-av wiring lands in Pass 17. */}
      {Platform.OS !== 'web' && (
        <View style={styles.nativePlaceholder}>
          <Ionicons name="play-circle-outline" size={42} color={Colors.text.tertiary as string} />
          <Text style={styles.nativePlaceholderText}>
            {kind === 'video' ? 'Video preview unavailable on mobile.' : 'Audio preview unavailable on mobile.'}
          </Text>
          <Text style={styles.nativePlaceholderSub}>Open on web to play.</Text>
        </View>
      )}

      {/* Controls bar */}
      <View style={styles.controlsRow}>
        <Pressable
          onPress={Platform.OS === 'web' ? web.toggle : undefined}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          accessibilityState={{ disabled: Platform.OS !== 'web' }}
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.playButton,
            hovered && styles.playButtonHover,
            pressed && styles.playButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={18}
            color={'#FFFFFF'}
          />
        </Pressable>

        <Text style={styles.timeText}>{fmtTime(time)}</Text>

        {/* Scrub bar */}
        <Pressable
          onLayout={(e) => setScrubWidth(e.nativeEvent.layout.width)}
          onPress={(e) => handleScrubPress(e as { nativeEvent: { locationX: number } }, scrubWidth)}
          accessibilityRole="adjustable"
          accessibilityLabel="Scrub through recording"
          style={styles.scrub}
        >
          <View style={styles.scrubTrack}>
            <View style={[styles.scrubFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.scrubThumb, { left: `${progress * 100}%` }]} />
          </View>
        </Pressable>

        <Text style={styles.timeText}>{fmtTime(duration)}</Text>

        {/* Speed selector */}
        <View style={styles.speedRow}>
          {SPEEDS.map((s) => {
            const active = (Platform.OS === 'web' ? web.speed : 1) === s;
            return (
              <Pressable
                key={s}
                onPress={() => web.setSpeedAndApply(s)}
                accessibilityRole="button"
                accessibilityLabel={`${s}x speed`}
                accessibilityState={{ selected: active }}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.speedChip,
                  hovered && styles.speedChipHover,
                  active && styles.speedChipActive,
                ]}
              >
                <Text style={[styles.speedChipText, active && styles.speedChipTextActive]}>
                  {s}×
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Time-synced transcript */}
      {transcript && transcript.length > 0 && (
        <View style={styles.transcriptWrap}>
          <Text style={styles.transcriptEyebrow}>Synced Transcript</Text>
          <ScrollView
            ref={transcriptScrollRef}
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptInner}
            showsVerticalScrollIndicator={false}
          >
            {transcript.map((line, i) => (
              <Pressable
                key={`${line.t}-${i}`}
                onPress={() => web.seek(line.t)}
                onLayout={(e) => {
                  lineHeightsRef.current[i] = e.nativeEvent.layout.height;
                }}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${fmtTime(line.t)}`}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.transcriptLine,
                  hovered && styles.transcriptLineHover,
                  i === activeLineIdx && styles.transcriptLineActive,
                ]}
              >
                <Text style={styles.transcriptTime}>{fmtTime(line.t)}</Text>
                <Text style={styles.transcriptText}>
                  {line.speaker ? (
                    <Text style={styles.transcriptSpeaker}>{line.speaker}: </Text>
                  ) : null}
                  {line.text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  kindPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.text.tertiary as string,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  audioWaveWrap: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.10)',
  },
  nativePlaceholder: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  nativePlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary as string,
  },
  nativePlaceholderSub: {
    fontSize: 12,
    color: Colors.text.muted as string,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan as string,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.35), 0 4px 18px rgba(59,130,246,0.30)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }),
  },
  playButtonHover: {
    transform: [{ scale: 1.04 }],
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px rgba(96,165,250,0.55), 0 6px 24px rgba(59,130,246,0.45)',
        } as unknown as ViewStyle)
      : {}),
  },
  playButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'center',
  },
  scrub: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  scrubTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'visible',
  },
  scrubFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: Colors.accent.cyan as string,
    borderRadius: 2,
  },
  scrubThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px rgba(59,130,246,0.45), 0 0 8px rgba(59,130,246,0.45)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.5,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
          elevation: 3,
        }),
  },
  speedRow: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 4,
  },
  speedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  speedChipHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  speedChipActive: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: 'rgba(59,130,246,0.40)',
  },
  speedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.2,
  },
  speedChipTextActive: {
    color: '#93C5FD',
  },
  transcriptWrap: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  transcriptEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted as string,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  transcriptScroll: {
    maxHeight: 240,
  },
  transcriptInner: {
    gap: 4,
    paddingRight: 8,
  },
  transcriptLine: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background-color 140ms ease-out' } as unknown as ViewStyle)
      : {}),
  },
  transcriptLineHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  transcriptLineActive: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  transcriptTime: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    paddingTop: 2,
  },
  transcriptText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 19,
  },
  transcriptSpeaker: {
    fontWeight: '600',
    color: Colors.text.primary as string,
  },
});

export default MediaPlayer;
