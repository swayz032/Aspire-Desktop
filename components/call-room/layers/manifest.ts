// components/call-room/layers/manifest.ts
//
// Static office background — single sharp image, no parallax movement.
// 3D depth is conveyed through the floating card's shadows, lighting,
// and tilt response, not through background motion (which can cause
// motion-sickness or headaches during long calls).

export interface LayerSpec {
  src: number;
  parallaxRange: number;
  zIndex: number;
  opacity: number;
  scale: number;
}

export const layers: LayerSpec[] = [
  {
    src: require('./full-static.webp'),
    parallaxRange: 0,
    zIndex: 0,
    opacity: 1,
    scale: 1.05,
  },
];
