import { Platform } from 'react-native';
import {
  getImmersionState,
  setImmersionMode,
  type ImmersionMode,
} from '@/lib/immersionStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEGRADATION_COOLDOWN_MS = 90_000; // 90 seconds between downgrades
const STABLE_FRAME_THRESHOLD = 120; // frames above 30fps before promotion
const STABLE_FPS_MIN = 30;

// Degradation ladder: canvas → depth → off (never skip)
const DEGRADATION_ORDER: readonly ImmersionMode[] = ['canvas', 'depth', 'off'];

// Promotion ladder: off → depth → canvas
const PROMOTION_ORDER: readonly ImmersionMode[] = ['off', 'depth', 'canvas'];

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let lastDegradationTime = 0;
let stableFrameCount = 0;
let prefersReducedMotion = false;

// Detect prefers-reduced-motion (web only, once)
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mql.matches;
    mql.addEventListener('change', (e) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        // Force down to depth or off
        const current = getImmersionState().mode;
        if (current === 'canvas') {
          setImmersionMode('depth');
          emitCanvasEvent('fallback_trigger', {
            from: 'canvas',
            to: 'depth',
            reason: 'prefers_reduced_motion',
          });
        }
      }
    });
  } catch {
    // silent — matchMedia unavailable
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function degradeOneLevel(current: ImmersionMode): ImmersionMode | null {
  const idx = DEGRADATION_ORDER.indexOf(current);
  if (idx < 0 || idx >= DEGRADATION_ORDER.length - 1) return null;
  return DEGRADATION_ORDER[idx + 1];
}

function promoteOneLevel(current: ImmersionMode): ImmersionMode | null {
  // If reduced-motion, cap at depth
  const maxIdx = prefersReducedMotion
    ? PROMOTION_ORDER.indexOf('depth')
    : PROMOTION_ORDER.length - 1;

  const idx = PROMOTION_ORDER.indexOf(current);
  if (idx < 0 || idx >= maxIdx) return null;
  return PROMOTION_ORDER[idx + 1];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call from component lifecycle on every FPS sample.
 * Degrades canvas mode when isLow is true and cooldown has elapsed.
 */
export function checkFallback(fps: number, isLow: boolean): void {
  // Track stable frames for promotion eligibility
  if (fps >= STABLE_FPS_MIN) {
    stableFrameCount += 1;
  } else {
    stableFrameCount = 0;
  }

  if (!isLow) return;

  const now = Date.now();
  if (now - lastDegradationTime < DEGRADATION_COOLDOWN_MS) return;

  const current = getImmersionState().mode;
  const next = degradeOneLevel(current);
  if (!next) return;

  lastDegradationTime = now;
  stableFrameCount = 0;
  setImmersionMode(next);

  emitCanvasEvent('fallback_trigger', {
    from: current,
    to: next,
    reason: 'low_fps',
    fps,
  });
}

/**
 * Returns true when enough stable frames have accumulated
 * and there is a higher mode to promote to.
 */
export function canPromote(): boolean {
  if (stableFrameCount < STABLE_FRAME_THRESHOLD) return false;
  const current = getImmersionState().mode;
  return promoteOneLevel(current) !== null;
}

/**
 * Promote one level up (off → depth → canvas).
 * Resets stable frame counter. Respects reduced-motion cap.
 */
export function promoteFallback(): void {
  const current = getImmersionState().mode;
  const next = promoteOneLevel(current);
  if (!next) return;

  stableFrameCount = 0;
  setImmersionMode(next);

  emitCanvasEvent('fallback_trigger', {
    from: current,
    to: next,
    reason: 'promotion',
  });
}

/**
 * Returns milliseconds remaining in the degradation cooldown.
 * 0 means ready to degrade again (if needed).
 */
export function getFallbackCooldownRemaining(): number {
  const elapsed = Date.now() - lastDegradationTime;
  const remaining = DEGRADATION_COOLDOWN_MS - elapsed;
  return remaining > 0 ? remaining : 0;
}
