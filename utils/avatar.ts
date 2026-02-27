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

const AVATAR_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
];

/** Pick a deterministic color from a name string. */
export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashSeed(name) % AVATAR_COLORS.length];
}
