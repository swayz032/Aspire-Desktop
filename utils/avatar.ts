/**
 * Shared avatar utilities for consistent initials-based avatars
 * across DesktopHeader (profile button/dropdown) and AvatarTileSurface (conference tiles).
 */

/** Stable numeric hash from a seed string (for deterministic color selection). */
export function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Extract up to 2 initials from a display name. */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Premium avatar palette — curated for dark backgrounds (#131315).
 * Each entry: [solid, fill at ~22% opacity for circle background].
 * Ordered to maximise perceptual distance between adjacent colours
 * so that side-by-side avatars (e.g. conference tiles) look distinct.
 */
const AVATAR_COLORS = [
  '#3B82F6', // blue
  '#F59E0B', // amber  (warm, max distance from blue)
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#6366F1', // indigo
];

/** Pick a deterministic color from a name string. */
export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashSeed(name) % AVATAR_COLORS.length];
}
