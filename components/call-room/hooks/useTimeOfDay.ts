// components/call-room/hooks/useTimeOfDay.ts
//
// Time-of-day classifier for the Call Room. The hook returns the current
// classified state — the background component swaps images directly based
// on it. No overlay tints, no synthetic lighting; the photo IS the time.
//
// ─── Production hour split (browser-local time) ─────────────────────────
//   05:00–06:59  dawn   (early morning)
//   07:00–16:59  day    (business hours)
//   17:00–19:59  dusk   (golden hour, end of business)
//   20:00–04:59  night  (after hours)
//
// Re-classifies every 5 minutes via setInterval. Uses Date.getHours() so
// it follows the user's local timezone automatically (DST included).
//
// Why simple-hour classification (vs sunrise/sunset API):
//   • Deterministic — same hour returns same state, no flakiness
//   • Zero external deps — no network call to a sunrise API
//   • Works offline — hour is always available
//   • SMB use case — the cue is "is it after-hours for the agent",
//     not surgical golden-hour photography. Latitude/season variance
//     doesn't matter at this resolution.
//
// If we ever need true sunrise/sunset (e.g., for hospitality SaaS where
// dawn precision matters), swap classifyHour for an async sunrise-API
// call cached per-tenant per-day. The hook signature stays the same.
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
