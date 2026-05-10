/**
 * useDebouncedValue — generic debouncer hook.
 *
 * Returns a value that only updates after `delay` ms have passed without a
 * new input. Used by `usePropertyData` so rapid address typing doesn't fan
 * out a fetch per keystroke.
 *
 * Tests live at hooks/__tests__/useDebouncedValue.test.ts (Wave 20).
 */
import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

export function useDebouncedValue<T>(value: T, delay: number = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
