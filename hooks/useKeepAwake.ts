/**
 * useKeepAwake — Prevents screen dimming/lock during voice and video sessions.
 *
 * Platform strategy:
 * - Native (iOS/Android): expo-keep-awake activateKeepAwakeAsync / deactivateKeepAwake
 * - Web: Screen Wake Lock API (navigator.wakeLock) — Chrome/Edge/Safari on HTTPS
 * - Fallback: no-op if neither API is available
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'aspire-session';

export function useKeepAwake(): void {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      if (Platform.OS !== 'web') {
        // Native: use expo-keep-awake
        try {
          await activateKeepAwakeAsync(TAG);
          if (!cancelled) {
            console.log('[KeepAwake] acquired (native)');
          }
        } catch (err) {
          console.warn('[KeepAwake] native activate failed:', err);
        }
        return;
      }

      // Web: use Screen Wake Lock API
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          if (cancelled) {
            lock.release();
            return;
          }
          wakeLockRef.current = lock;
          console.log('[KeepAwake] acquired (web Wake Lock API)');

          lock.addEventListener('release', () => {
            console.log('[KeepAwake] released (web — visibility change or manual)');
          });
        } catch (err) {
          // Fails if page is hidden or user denied — non-fatal
          console.warn('[KeepAwake] web Wake Lock request failed:', err);
        }
      }
    }

    acquire();

    // Re-acquire on visibility change (web only — lock is released when tab is hidden)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !cancelled) {
        acquire();
      }
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;

      if (Platform.OS !== 'web') {
        deactivateKeepAwake(TAG);
        console.log('[KeepAwake] deactivated (native)');
      } else {
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
          console.log('[KeepAwake] released (web)');
        }
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      }
    };
  }, []);
}
