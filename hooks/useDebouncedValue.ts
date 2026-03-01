/**
 * useDebouncedValue -- Debounce a value with configurable delay.
 *
 * Returns the latest value only after the specified delay has elapsed
 * since the last change. Useful for preventing excessive re-renders
 * and data fetches during continuous user interactions (drag, resize, type).
 *
 * Wave 20 -- Canvas Mode performance optimization.
 *
 * @example
 * ```tsx
 * const [size, setSize] = useState({ width: 400, height: 500 });
 * const debouncedSize = useDebouncedValue(size, 100);
 *
 * // Only re-fetch when debounced size changes
 * useEffect(() => {
 *   fetchData(debouncedSize);
 * }, [debouncedSize]);
 * ```
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Debounce a value by the specified delay.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default 300ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // Set new timer
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timerRef.current = null;
    }, delay);

    // Cleanup on unmount or value change
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delay]);

  return debouncedValue;
}
