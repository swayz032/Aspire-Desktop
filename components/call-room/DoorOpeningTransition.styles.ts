/**
 * DoorOpeningTransition.styles -- Static styles + visual constants.
 *
 * Split from the main component once the polished surface treatment pushed
 * the file past ~450 lines. Animated styles still live alongside the
 * worklets in the parent file; only static structural styles + visual
 * tokens (colors, gradient stops) live here.
 */

import { StyleSheet } from 'react-native';

// ─── Palette (local — not in tokens.ts because the warm seam light is
//     unique to this transition and not reused elsewhere) ──────────────────
//
// The doors are darker than `Colors.background.primary` (#0a0a0a) at their
// edges and lift slightly toward their center to imply ambient room light
// catching the door face from above.
export const DoorPalette = {
  // Body — top→bottom ambient (light from above, deeper at the bottom).
  bodyTop: '#141416', // catches a touch more light at the top
  bodyMid: '#0d0d0e', // mid-body, the deepest mass
  bodyBottom: '#080809', // bottom edge, sinks into the floor
  // Bevel — the inner seam-side edge picks up the warm seam light.
  bevelEdge: 'rgba(255, 200, 130, 0.12)', // warm bevel at the seam edge
  bevelInner: 'rgba(255, 200, 130, 0.0)', // fades inward
  // Grain — hairline horizontal strokes implying material without drawing wood.
  grain: 'rgba(255, 255, 255, 0.018)',
  grainStrong: 'rgba(255, 255, 255, 0.028)',
  // Face shadow — overlays the door as it rotates (darker = more tilted).
  faceShadow: 'rgba(0, 0, 0, 0.55)',
  // Seam — warm, slightly amber. Same temperature as a dimmed incandescent
  // bulb; not yellow, not orange, but the gold-warm glow of a lit room.
  seamWarm: 'rgba(255, 180, 80, 1)',
  seamWarmHigh: 'rgba(255, 200, 120, 1)', // hotter core during peak bloom
  // Halo — soft radial bloom behind the seam, suggesting volumetric light.
  haloMid: 'rgba(255, 180, 80, 0.18)',
  haloEdge: 'rgba(255, 180, 80, 0)',
  // Floor vignette — implies room depth where the door bottom meets the floor.
  floorShadow: 'rgba(0, 0, 0, 0.6)',
  floorEdge: 'rgba(0, 0, 0, 0)',
} as const;

// ─── Gradient color tuples (typed for expo-linear-gradient `colors` prop) ──
export const DoorBodyColors = [
  DoorPalette.bodyTop,
  DoorPalette.bodyMid,
  DoorPalette.bodyBottom,
] as const;

export const LeftDoorBevelColors = [
  DoorPalette.bevelInner, // far edge (left side of left door)
  DoorPalette.bevelInner,
  DoorPalette.bevelEdge, // seam-side edge (right side of left door)
] as const;

export const RightDoorBevelColors = [
  DoorPalette.bevelEdge, // seam-side edge (left side of right door)
  DoorPalette.bevelInner,
  DoorPalette.bevelInner,
] as const;

export const FloorVignetteColors = [
  DoorPalette.floorEdge,
  DoorPalette.floorShadow,
] as const;

export const SeamCoreColors = [
  'rgba(255, 180, 80, 0)',
  DoorPalette.seamWarm,
  'rgba(255, 180, 80, 0)',
] as const;

export const SeamBloomColors = [
  'rgba(255, 180, 80, 0)',
  DoorPalette.seamWarmHigh,
  'rgba(255, 180, 80, 0)',
] as const;

export const HaloColors = [
  DoorPalette.haloEdge,
  DoorPalette.haloMid,
  DoorPalette.haloEdge,
] as const;

// ─── Static StyleSheet ─────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  childrenLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    // Ensure the overlay clips its 3D children sanely on web.
    overflow: 'hidden',
  },
  doorBase: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: DoorPalette.bodyMid,
    // Backface culling matters: when the door rotates past 90deg the back
    // face would otherwise show a flat-shaded mirror — we don't want that.
    backfaceVisibility: 'hidden',
    // Doors clip their internal grain/bevel layers cleanly.
    overflow: 'hidden',
  },
  leftDoor: {
    left: 0,
  },
  rightDoor: {
    right: 0,
  },

  // ─── Surface layers (stacked inside each door) ────────────────────────
  // Each layer is absolute-fill and composes onto the door body.

  bevel: {
    ...StyleSheet.absoluteFillObject,
  },

  // Hairline horizontal grain. Five evenly-spaced strokes, 1px tall, very
  // low opacity, just enough to imply a material has texture. Positioned
  // by percentage so it scales across viewports.
  grainLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: DoorPalette.grain,
  },
  grainLineStrong: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: DoorPalette.grainStrong,
  },

  // Face shadow overlay — opacity is animated based on rotation.
  faceShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DoorPalette.faceShadow,
  },

  // Seam-side warm hairline (1px, on the inner edge of each door).
  leftDoorSeamShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 1,
    backgroundColor: 'rgba(255, 200, 130, 0.22)',
  },
  rightDoorSeamShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 1,
    backgroundColor: 'rgba(255, 200, 130, 0.22)',
  },

  // Floor vignette — implies room depth at the bottom edge of each door.
  floorVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '14%',
  },

  // ─── Seam light (separate sibling overlay, sits on top of doors) ──────
  // Width is animated; horizontal centering is done with negative margin
  // equal to half the animated width.
  seamWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    // Width is set dynamically by the animated style (2→12→0).
    // zIndex ensures the seam sits on top of doors.
    zIndex: 11,
  },
  // The visible band — stretches a bit beyond the seamWrap so the warm
  // bleed extends into both doors' inner edges as light leak.
  seamBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -10,
    right: -10,
  },
  // Radial halo — large soft glow behind the seam center, suggesting
  // volumetric light spilling out through the parting doors.
  seamHalo: {
    position: 'absolute',
    // Centered on the seam vertically and horizontally. We approximate a
    // radial via two stacked horizontal+vertical gradients with the same
    // 3-stop transparent→warm→transparent profile.
    width: 480,
    height: 360,
    top: '50%',
    left: '50%',
    marginLeft: -240,
    marginTop: -180,
    zIndex: 11,
  },
  haloLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  // ─── Children fade-in mask ─────────────────────────────────────────────
  // A black overlay above the children that fades from opaque→transparent
  // during the second half of the door swing, so the room "appears"
  // through the parting doors instead of being there on frame zero.
  childrenMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    // Below the door overlay (zIndex 10) but above children (zIndex 0).
    zIndex: 5,
  },
});
