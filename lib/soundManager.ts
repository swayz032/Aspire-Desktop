import { Platform } from 'react-native';
import { getImmersionState } from '@/lib/immersionStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SoundId =
  | 'stage_open'
  | 'stage_close'
  | 'runway_advance'
  | 'runway_complete'
  | 'runway_error'
  | 'authority_approved'
  | 'authority_denied'
  | 'lens_open'
  | 'palette_open';

type SoundPriority = 0 | 1 | 2; // 0 = navigation, 1 = authority, 2 = error

interface SoundDef {
  priority: SoundPriority;
  essential: boolean; // plays in 'essential' mode
  play: (ctx: AudioContext) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 50;

// Note frequencies (Hz)
const C3 = 130.81;
const E3 = 164.81;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let lastPlayTime = 0;
let lastPlayPriority: SoundPriority = 0;

// ---------------------------------------------------------------------------
// Tone generators (pure Web Audio — no external files)
// ---------------------------------------------------------------------------

function playTone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startOffset: number,
  duration: number,
  volume: number = 0.15,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime + startOffset;
  // ADSR: quick attack, sustain, decay
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.005);
  gain.gain.setValueAtTime(volume, now + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playNoiseBurst(
  ctx: AudioContext,
  startOffset: number,
  duration: number,
  volume: number = 0.05,
): void {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  source.start(now);
  source.stop(now + duration + 0.01);
}

// ---------------------------------------------------------------------------
// Sound definitions
// ---------------------------------------------------------------------------

const SOUNDS: Record<SoundId, SoundDef> = {
  stage_open: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Ascending two-note chime: C5 -> E5
      playTone(ctx, C5, 'sine', 0, 0.08);
      playTone(ctx, E5, 'sine', 0.08, 0.08);
    },
  },
  stage_close: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Descending: E5 -> C5
      playTone(ctx, E5, 'sine', 0, 0.08);
      playTone(ctx, C5, 'sine', 0.08, 0.08);
    },
  },
  runway_advance: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Quick rising blip: 200Hz -> 400Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    },
  },
  runway_complete: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Success chord: C5 + E5 + G5
      playTone(ctx, C5, 'sine', 0, 0.15, 0.1);
      playTone(ctx, E5, 'sine', 0, 0.15, 0.1);
      playTone(ctx, G5, 'sine', 0, 0.15, 0.1);
    },
  },
  runway_error: {
    priority: 2,
    essential: true,
    play: (ctx) => {
      // Low buzz: 100Hz square wave
      playTone(ctx, 100, 'square', 0, 0.2, 0.08);
    },
  },
  authority_approved: {
    priority: 1,
    essential: true,
    play: (ctx) => {
      // Bright ding: A5
      playTone(ctx, A5, 'sine', 0, 0.12);
    },
  },
  authority_denied: {
    priority: 1,
    essential: true,
    play: (ctx) => {
      // Two low tones: E3 -> C3
      playTone(ctx, E3, 'sine', 0, 0.1, 0.12);
      playTone(ctx, C3, 'sine', 0.1, 0.1, 0.12);
    },
  },
  lens_open: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Soft click: short noise burst
      playNoiseBurst(ctx, 0, 0.02);
    },
  },
  palette_open: {
    priority: 0,
    essential: false,
    play: (ctx) => {
      // Whoosh: filtered noise
      playNoiseBurst(ctx, 0, 0.1, 0.08);
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create AudioContext. Must be called after a user gesture (browser policy).
 */
export function initSoundManager(): void {
  if (Platform.OS !== 'web') return;
  if (audioCtx) return;

  try {
    audioCtx = new AudioContext();
  } catch {
    // AudioContext unavailable — sounds will be silent
  }
}

/**
 * Dispose AudioContext and clean up.
 */
export function disposeSoundManager(): void {
  if (!audioCtx) return;

  try {
    audioCtx.close().catch(() => {
      // silent
    });
  } catch {
    // silent
  }
  audioCtx = null;
}

/**
 * Play a sound. Respects sound mode from immersionStore and cooldown.
 * Never blocks UI thread.
 */
export function playSound(id: SoundId): void {
  if (Platform.OS !== 'web') return;
  if (!audioCtx) return;

  const soundMode = getImmersionState().soundMode;
  if (soundMode === 'off') return;

  const def = SOUNDS[id];
  if (!def) return;

  // In 'essential' mode, only play essential sounds
  if (soundMode === 'essential' && !def.essential) return;

  // Cooldown check — higher priority can interrupt
  const now = Date.now();
  if (now - lastPlayTime < COOLDOWN_MS && def.priority <= lastPlayPriority) {
    return;
  }

  lastPlayTime = now;
  lastPlayPriority = def.priority;

  // Resume suspended AudioContext if needed
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // silent
    });
  }

  try {
    def.play(audioCtx);
  } catch {
    // silent — never break the app for audio
  }

  emitCanvasEvent('sound_play', { sound: id, mode: soundMode });
}
