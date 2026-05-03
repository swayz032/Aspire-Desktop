// components/call-room/hooks/useTimeOfDay.ts
//
// Time-of-day classifier + tint config for the Call Room.
// Pure functions are exported for unit testing; the React hook is a thin
// wrapper that re-classifies every 5 minutes (or returns a forced value for
// dev panels). We intentionally do NOT use geolocation/suncalc here — that's
// a follow-up. Local-hour classification is good enough for v1.
import { useEffect, useState } from 'react';
import type { TimeOfDayState } from '../types';

export type { TimeOfDayState };

export interface TimeOfDayTint {
  state: TimeOfDayState;
  overlayColor: string;
  overlayOpacity: number;
  vignetteColor: string;
}

export function classifyHour(hour: number): TimeOfDayState {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export function getTint(state: TimeOfDayState): TimeOfDayTint {
  switch (state) {
    case 'dawn':
      return {
        state,
        overlayColor: 'rgba(255, 180, 140, 1)',
        overlayOpacity: 0.10,
        vignetteColor: 'rgba(40, 30, 50, 0.4)',
      };
    case 'day':
      return {
        state,
        overlayColor: 'rgba(220, 230, 240, 1)',
        overlayOpacity: 0.04,
        vignetteColor: 'rgba(20, 25, 35, 0.25)',
      };
    case 'dusk':
      return {
        state,
        overlayColor: 'rgba(255, 160, 90, 1)',
        overlayOpacity: 0.14,
        vignetteColor: 'rgba(50, 25, 40, 0.45)',
      };
    case 'night':
      return {
        state,
        overlayColor: 'rgba(40, 50, 90, 1)',
        overlayOpacity: 0.30,
        vignetteColor: 'rgba(0, 0, 10, 0.6)',
      };
  }
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function currentTint(): TimeOfDayTint {
  if (typeof Date === 'undefined') return getTint('day');
  return getTint(classifyHour(new Date().getHours()));
}

export function useTimeOfDay(forced?: TimeOfDayState): TimeOfDayTint {
  const [tint, setTint] = useState<TimeOfDayTint>(() =>
    forced ? getTint(forced) : currentTint(),
  );

  useEffect(() => {
    if (forced) {
      setTint(getTint(forced));
      return;
    }
    setTint(currentTint());
    const id = setInterval(() => setTint(currentTint()), FIVE_MINUTES_MS);
    return () => clearInterval(id);
  }, [forced]);

  return tint;
}
