import { Platform } from 'react-native';

const audioCtxRef: { current: AudioContext | null } = { current: null };

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (!audioCtxRef.current) {
    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtxRef.current;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.08, fadeOut = true) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  vol.gain.setValueAtTime(gain, ctx.currentTime);
  if (fadeOut) {
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  }
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChord(notes: { freq: number; delay: number; duration: number; type?: OscillatorType; gain?: number }[]) {
  const ctx = getAudioContext();
  if (!ctx) return;
  notes.forEach(({ freq, delay, duration, type = 'sine', gain = 0.06 }) => {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(gain, ctx.currentTime + delay);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  });
}

export function playNavigateSound() {
  playChord([
    { freq: 880, delay: 0, duration: 0.08, type: 'sine', gain: 0.05 },
    { freq: 1320, delay: 0.04, duration: 0.1, type: 'sine', gain: 0.04 },
  ]);
}

export function playClickSound() {
  playTone(1200, 0.06, 'sine', 0.04);
}

export function playTabSwitchSound() {
  playChord([
    { freq: 660, delay: 0, duration: 0.06, type: 'triangle', gain: 0.04 },
    { freq: 880, delay: 0.03, duration: 0.08, type: 'triangle', gain: 0.03 },
  ]);
}

export function playSuccessSound() {
  playChord([
    { freq: 523, delay: 0, duration: 0.12, type: 'sine', gain: 0.06 },
    { freq: 659, delay: 0.06, duration: 0.12, type: 'sine', gain: 0.05 },
    { freq: 784, delay: 0.12, duration: 0.18, type: 'sine', gain: 0.05 },
  ]);
}

export function playOpenSound() {
  playChord([
    { freq: 440, delay: 0, duration: 0.1, type: 'sine', gain: 0.05 },
    { freq: 554, delay: 0.05, duration: 0.1, type: 'sine', gain: 0.04 },
    { freq: 659, delay: 0.1, duration: 0.15, type: 'sine', gain: 0.04 },
  ]);
}

export function playNotificationSound() {
  playChord([
    { freq: 784, delay: 0, duration: 0.1, type: 'sine', gain: 0.06 },
    { freq: 988, delay: 0.08, duration: 0.15, type: 'sine', gain: 0.05 },
    { freq: 1175, delay: 0.16, duration: 0.2, type: 'sine', gain: 0.04 },
  ]);
}

export function playHoverSound() {
  playTone(1400, 0.03, 'sine', 0.02);
}
