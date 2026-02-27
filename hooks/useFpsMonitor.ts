import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getImmersionState } from '@/lib/immersionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FpsResult {
  fps: number;
  isLow: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW_SIZE = 60; // frames per sample window
const LOW_FPS_THRESHOLD = 24;
const CONSECUTIVE_LOW_WINDOWS = 3;

// ---------------------------------------------------------------------------
// Native fallback — always 60fps, never low
// ---------------------------------------------------------------------------

const NATIVE_FALLBACK: FpsResult = { fps: 60, isLow: false };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFpsMonitor(): FpsResult {
  const [result, setResult] = useState<FpsResult>(NATIVE_FALLBACK);

  // Refs to avoid allocations in the RAF loop
  const frameTimesRef = useRef<number[]>([]);
  const lowCountRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let mounted = true;

    const frameTimes = frameTimesRef.current;
    frameTimes.length = 0;
    lowCountRef.current = 0;
    lastTimeRef.current = 0;

    function tick(now: number): void {
      if (!mounted) return;

      // Skip first frame (no delta)
      if (lastTimeRef.current > 0) {
        const delta = now - lastTimeRef.current;
        frameTimes.push(delta);

        // Once we have a full window, calculate average and shift
        if (frameTimes.length >= WINDOW_SIZE) {
          let sum = 0;
          for (let i = 0; i < WINDOW_SIZE; i++) {
            sum += frameTimes[i];
          }
          const avgDelta = sum / WINDOW_SIZE;
          const avgFps = avgDelta > 0 ? 1000 / avgDelta : 60;
          const rounded = Math.round(avgFps);

          if (rounded < LOW_FPS_THRESHOLD) {
            lowCountRef.current += 1;
          } else {
            lowCountRef.current = 0;
          }

          const isLow = lowCountRef.current >= CONSECUTIVE_LOW_WINDOWS;

          setResult({ fps: rounded, isLow });

          // Shift window — keep last half for overlap smoothing
          frameTimes.splice(0, WINDOW_SIZE);
        }
      }

      lastTimeRef.current = now;

      // Only keep running when canvas mode is active
      const immersion = getImmersionState();
      if (immersion.mode === 'off') {
        // Reset when mode goes off
        frameTimes.length = 0;
        lowCountRef.current = 0;
        lastTimeRef.current = 0;
        setResult(NATIVE_FALLBACK);
        // Still request next frame to detect mode turning back on
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return result;
}
