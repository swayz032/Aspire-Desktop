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

export interface CeilingLamp {
  color: string;       // warm-white center color (CSS rgba)
  edgeColor: string;   // outer fade — usually 0 alpha of the same hue
  cx: number;          // center x in % (50 = middle)
  cy: number;          // center y in % (30 = upper third, where the card sits)
  radius: number;      // % of viewport diameter
}

export interface TimeOfDayTint {
  state: TimeOfDayState;
  overlayColor: string;
  overlayOpacity: number;
  vignetteColor: string;
  // Only set at night — simulates a ceiling lamp turning on so the room
  // doesn't feel pitch-black. The card sits inside the warm pool of light.
  ceilingLamp?: CeilingLamp;
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
        // Heavier dark wash so the room feels genuinely dim at night.
        overlayColor: 'rgba(20, 28, 55, 1)',
        overlayOpacity: 0.55,
        vignetteColor: 'rgba(0, 0, 8, 0.75)',
        ceilingLamp: {
          // Warm tungsten lamp pool — bright at center, fades to invisible.
          color: 'rgba(255, 220, 170, 0.42)',
          edgeColor: 'rgba(255, 220, 170, 0)',
          cx: 50,
          cy: 38,
          radius: 65,
        },
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
