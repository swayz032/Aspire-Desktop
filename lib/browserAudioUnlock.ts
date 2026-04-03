/**
 * Browser audio unlock helper for voice features.
 *
 * Modern browsers can block audio output until a user gesture occurs.
 * This helper is intended to be called directly inside a click/tap handler
 * before starting a voice session.
 */

let unlocked = false;
let sharedAudioContext: AudioContext | null = null;

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=';

export async function unlockBrowserAudioPlayback(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (unlocked) return true;

  let htmlUnlocked = false;
  let contextUnlocked = false;

  try {
    const probe = new Audio(SILENT_WAV_DATA_URL);
    probe.muted = false;
    probe.volume = 0.00001;
    probe.setAttribute('playsinline', '');
    await probe.play();
    probe.pause();
    probe.currentTime = 0;
    htmlUnlocked = true;
  } catch {
    // Keep going: some browsers unlock via AudioContext only.
  }

  try {
    const AudioContextClass =
      window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
        sharedAudioContext = new AudioContextClass();
      }

      if (sharedAudioContext.state === 'suspended') {
        await sharedAudioContext.resume();
      }

      if (sharedAudioContext.state === 'running') {
        const oscillator = sharedAudioContext.createOscillator();
        const gainNode = sharedAudioContext.createGain();
        gainNode.gain.value = 0.00001;
        oscillator.connect(gainNode);
        gainNode.connect(sharedAudioContext.destination);
        oscillator.start();
        oscillator.stop(sharedAudioContext.currentTime + 0.02);
        contextUnlocked = true;
      }
    }
  } catch {
    // Some environments do not expose AudioContext.
  }

  unlocked = htmlUnlocked || contextUnlocked;
  return unlocked;
}
