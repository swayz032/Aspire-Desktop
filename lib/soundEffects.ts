/**
 * Chat Sound Effects
 *
 * Extracted from duplicated implementations in:
 *   - AvaDeskPanel.playConnectionSound / playSuccessSound (~lines 441-475)
 *   - FinnDeskPanel.playConnectionSound / playSuccessSound (~lines 510-544)
 *
 * Uses the Web Audio API (AudioContext oscillator) — web-only, no-ops on native.
 * Complements the existing lib/sounds.ts which provides UI interaction sounds.
 * These are specific to agent chat session lifecycle events.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Shared AudioContext (reuses across calls to avoid creating many contexts)
// ---------------------------------------------------------------------------

const audioCtxRef: { current: AudioContext | null } = { current: null };

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (!audioCtxRef.current) {
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    } catch {
      return null;
    }
  }
  // Resume if suspended (e.g. after user interaction requirement)
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume().catch(() => {});
  }
  return audioCtxRef.current;
}

// ---------------------------------------------------------------------------
// Sound Effects
// ---------------------------------------------------------------------------

/**
 * Play a rising-then-settling tone indicating a voice session is connecting.
 * Pattern: 440Hz -> 880Hz -> 660Hz sweep over 300ms.
 * Used when agent voice session begins or Anam avatar connects.
 */
export function playConnectionSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Silent fail — audio context may be in a bad state
  }
}

/**
 * Play a rising triad (C-E-G) indicating a successful completion.
 * Pattern: 523Hz -> 659Hz -> 784Hz ascending over 400ms.
 * Used when Anam avatar connection succeeds or orchestrator returns.
 */
export function playSuccessSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(523, ctx.currentTime);
    oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Silent fail
  }
}

/**
 * Play a descending tone indicating an error or disconnection.
 * Pattern: 660Hz -> 330Hz descend over 400ms.
 * Used when voice session fails or avatar disconnects unexpectedly.
 */
export function playErrorSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Silent fail
  }
}
