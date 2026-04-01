/**
 * useZoomNoiseSuppression — Toggle Zoom Video SDK built-in noise suppression.
 *
 * Replaces the LiveKit Krisp noise filter hook with Zoom's native
 * noise suppression API. Interface matches the old useKrisp() pattern
 * for drop-in compatibility.
 *
 * Zoom SDK: stream.enableBackgroundNoiseSuppression(true/false)
 */

import { useState, useCallback } from 'react';

interface UseZoomNoiseSuppressionResult {
  isEnabled: boolean;
  isPending: boolean;
  isSupported: boolean;
  toggle: () => Promise<void>;
}

/**
 * Hook wrapping Zoom's built-in noise suppression.
 *
 * @param stream - MediaStream from ZoomConferenceProvider context
 * @returns Control interface matching the old Krisp hook shape
 */
export function useZoomNoiseSuppression(
  stream: any | null,
): UseZoomNoiseSuppressionResult {
  const [isEnabled, setIsEnabled] = useState(true); // On by default
  const [isPending, setIsPending] = useState(false);

  const toggle = useCallback(async () => {
    if (!stream || isPending) return;

    setIsPending(true);
    try {
      const newState = !isEnabled;
      // Zoom SDK built-in noise suppression toggle
      if (typeof stream.enableBackgroundNoiseSuppression === 'function') {
        await stream.enableBackgroundNoiseSuppression(newState);
      }
      setIsEnabled(newState);
    } catch {
      // Silently fail — noise suppression is a nice-to-have
    } finally {
      setIsPending(false);
    }
  }, [stream, isEnabled, isPending]);

  return {
    isEnabled,
    isPending,
    isSupported: !!stream && typeof stream?.enableBackgroundNoiseSuppression === 'function',
    toggle,
  };
}
