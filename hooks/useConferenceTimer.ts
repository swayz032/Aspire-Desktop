/**
 * useConferenceTimer — tracks session duration with Date.now delta.
 * Immune to tab-switch/background throttling (not based on interval counting).
 */
import { useState, useEffect, useRef } from 'react';

export function useConferenceTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return { elapsed, formatted: `${mm}:${ss}` };
}
