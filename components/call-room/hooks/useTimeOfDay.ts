// components/call-room/hooks/useTimeOfDay.ts
//
// Time-of-day classifier for the Call Room. The hook returns the current
// classified state — the background component swaps images directly based
// on it. No overlay tints, no synthetic lighting; the photo IS the time.
import { useEffect, useState } from 'react';
import type { TimeOfDayState } from '../types';

export type { TimeOfDayState };

export interface TimeOfDayInfo {
  state: TimeOfDayState;
}

export function classifyHour(hour: number): TimeOfDayState {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function currentInfo(): TimeOfDayInfo {
  if (typeof Date === 'undefined') return { state: 'day' };
  return { state: classifyHour(new Date().getHours()) };
}

export function useTimeOfDay(forced?: TimeOfDayState): TimeOfDayInfo {
  const [info, setInfo] = useState<TimeOfDayInfo>(() =>
    forced ? { state: forced } : currentInfo(),
  );

  useEffect(() => {
    if (forced) {
      setInfo({ state: forced });
      return;
    }
    setInfo(currentInfo());
    const id = setInterval(() => setInfo(currentInfo()), FIVE_MINUTES_MS);
    return () => clearInterval(id);
  }, [forced]);

  return info;
}
