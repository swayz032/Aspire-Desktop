/**
 * Browser audio unlock helper for voice features.
 *
 * Modern browsers block audio output until a user gesture occurs.
 * This helper plays a silent audio clip inside a click/tap handler
 * to satisfy the autoplay policy before starting a voice session.
 *
 * IMPORTANT: We intentionally do NOT create an AudioContext here.
 * The ElevenLabs SDK creates its own AudioContext — having a second
 * one open causes hardware audio contention and crackling artifacts.
 * The HTML5 Audio probe alone is sufficient to unlock autoplay.
 */

let unlocked = false;

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=';

export async function unlockBrowserAudioPlayback(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (unlocked) return true;

  try {
    const probe = new Audio(SILENT_WAV_DATA_URL);
    probe.muted = false;
    probe.volume = 0.00001;
    probe.setAttribute('playsinline', '');
    await probe.play();
    probe.pause();
    probe.currentTime = 0;
    unlocked = true;
  } catch {
    // Browser blocked autoplay — user may need to interact first.
    // The ElevenLabs SDK will handle its own unlock attempt.
    unlocked = false;
  }

  return unlocked;
}
