import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSupabase } from '@/providers';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'] as const;
const WARNING_BEFORE_MS = 60_000; // Show warning 60s before timeout

/**
 * Enterprise idle timeout hook.
 * Tracks user activity and auto-signs out after inactivity period.
 * Only active on web platform when user has a session.
 */
export function useIdleTimeout(timeoutMs = 15 * 60_000) {
  const { session, signOut } = useSupabase();
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(Math.floor(WARNING_BEFORE_MS / 1000));
  const showWarningRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
    countdownRef.current = null;
  }, []);

  const handleTimeout = useCallback(async () => {
    clearAllTimers();
    showWarningRef.current = false;
    setShowWarning(false);
    try {
      await signOut();
    } catch (_e) {
      // signOut already handles errors internally
    }
    router.replace('/(auth)/login' as any);
  }, [signOut, router, clearAllTimers]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    showWarningRef.current = false;
    setShowWarning(false);
    secondsRef.current = Math.floor(WARNING_BEFORE_MS / 1000);
    setSecondsLeft(secondsRef.current);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);
      // Start countdown
      countdownRef.current = setInterval(() => {
        secondsRef.current -= 1;
        setSecondsLeft(secondsRef.current);
        if (secondsRef.current <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Set auto-logout timer
    timeoutRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [timeoutMs, handleTimeout, clearAllTimers]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !session) {
      clearAllTimers();
      return;
    }

    resetTimer();

    const onActivity = () => {
      // Only reset if warning is NOT showing — user must click "Continue" during warning
      if (!showWarningRef.current) {
        resetTimer();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, onActivity);
      }
    };
  }, [session, resetTimer, clearAllTimers]);

  return { showWarning, secondsLeft, extendSession: resetTimer };
}
