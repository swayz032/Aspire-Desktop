/**
 * Symbol class styling — Wave 8.
 *
 * Maps a Drew symbol class string (e.g. "electrical.outlet.duplex") to a
 * discipline + color so the overlay + legend can color-code consistently.
 *
 * Color contract per Wave 8 plan:
 *   electrical → blue
 *   plumbing → green
 *   structural → orange
 *   mechanical (HVAC) → cyan
 *   architectural → violet
 *   fire/life-safety → red
 *   civil → brown
 *   other / unknown → gray
 */

export type SymbolDiscipline =
  | 'electrical'
  | 'plumbing'
  | 'structural'
  | 'mechanical'
  | 'architectural'
  | 'fire'
  | 'civil'
  | 'other';

export interface SymbolDisciplineStyle {
  discipline: SymbolDiscipline;
  label: string;
  code: string;
  /** Bbox stroke + chip foreground. */
  fg: string;
  /** Bbox fill (alpha-blended). */
  fill: string;
}

const STYLES: Record<SymbolDiscipline, SymbolDisciplineStyle> = {
  electrical: {
    discipline: 'electrical',
    label: 'Electrical',
    code: 'E',
    fg: '#60a5fa',
    fill: 'rgba(96,165,250,0.18)',
  },
  plumbing: {
    discipline: 'plumbing',
    label: 'Plumbing',
    code: 'P',
    fg: '#34d399',
    fill: 'rgba(52,211,153,0.18)',
  },
  structural: {
    discipline: 'structural',
    label: 'Structural',
    code: 'S',
    fg: '#fb923c',
    fill: 'rgba(251,146,60,0.18)',
  },
  mechanical: {
    discipline: 'mechanical',
    label: 'Mechanical',
    code: 'M',
    fg: '#22d3ee',
    fill: 'rgba(34,211,238,0.18)',
  },
  architectural: {
    discipline: 'architectural',
    label: 'Architectural',
    code: 'A',
    fg: '#c084fc',
    fill: 'rgba(192,132,252,0.18)',
  },
  fire: {
    discipline: 'fire',
    label: 'Fire / Life-Safety',
    code: 'FP',
    fg: '#f87171',
    fill: 'rgba(248,113,113,0.18)',
  },
  civil: {
    discipline: 'civil',
    label: 'Civil',
    code: 'C',
    fg: '#b08968',
    fill: 'rgba(176,137,104,0.18)',
  },
  other: {
    discipline: 'other',
    label: 'Other',
    code: '·',
    fg: 'rgba(255,255,255,0.55)',
    fill: 'rgba(255,255,255,0.10)',
  },
};

/** Resolve a class string ("electrical.outlet.duplex") to its discipline style. */
export function styleForSymbolClass(classStr: string | null | undefined): SymbolDisciplineStyle {
  if (!classStr) return STYLES.other;
  const head = classStr.split('.', 1)[0]?.toLowerCase() ?? '';
  if (head in STYLES) return STYLES[head as SymbolDiscipline];
  // Aliases — Drew sometimes emits "hvac", "lifesafety", etc.
  if (head === 'hvac') return STYLES.mechanical;
  if (head === 'lifesafety' || head === 'fp' || head === 'firepro') return STYLES.fire;
  if (head === 'arch') return STYLES.architectural;
  if (head === 'struct') return STYLES.structural;
  if (head === 'elec') return STYLES.electrical;
  if (head === 'plumb') return STYLES.plumbing;
  return STYLES.other;
}

export const ALL_SYMBOL_DISCIPLINES: SymbolDiscipline[] = [
  'electrical',
  'plumbing',
  'structural',
  'mechanical',
  'architectural',
  'fire',
  'civil',
  'other',
];

export function getDisciplineStyle(d: SymbolDiscipline): SymbolDisciplineStyle {
  return STYLES[d];
}

/** Pretty-print a class string for display ("electrical.outlet.duplex" → "Outlet · Duplex"). */
export function prettyClassName(classStr: string | null | undefined): string {
  if (!classStr) return 'Unknown';
  const parts = classStr.split('.');
  if (parts.length <= 1) return classStr;
  return parts
    .slice(1)
    .map((p) => p.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' · ');
}
