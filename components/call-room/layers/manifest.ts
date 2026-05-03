// components/call-room/layers/manifest.ts
//
// Time-of-day backgrounds. Each state has a dedicated photo so the room
// itself communicates the time — no overlay tints, no synthetic lighting.
//
//   day   → modern minimalist office, golden-hour lit (default)
//   dawn  → reuses day for now (no dedicated dawn photo)
//   dusk  → cave / rock / forest scene
//   night → city skyline at twilight

import type { TimeOfDayState } from '../types';

export interface LayerSpec {
  src: number;
  scale: number;
}

const day: LayerSpec = { src: require('./day.webp'), scale: 1.05 };
const dusk: LayerSpec = { src: require('./dusk.webp'), scale: 1.05 };
const night: LayerSpec = { src: require('./night.webp'), scale: 1.05 };

export const layersByState: Record<TimeOfDayState, LayerSpec> = {
  day,
  dawn: day,
  dusk,
  night,
};
