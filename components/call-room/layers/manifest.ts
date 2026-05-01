// components/call-room/layers/manifest.ts
//
// Layer manifest for the Call Room office background.
//
// M1 ships a single full-image layer (no parallax). M2 will replace this
// with 5 sliced layers and per-layer parallax ranges.

export interface LayerSpec {
  src: number; // require() returns a numeric module ID for React Native
  parallaxRange: number; // px max translate when cursor is at viewport edge
  zIndex: number;
  opacity: number;
  scale: number; // slight oversize so parallax never exposes the edge
}

export const layers: LayerSpec[] = [
  {
    src: require('./full-static.webp'),
    parallaxRange: 0, // no parallax in M1
    zIndex: 0,
    opacity: 1,
    scale: 1.05,
  },
];
