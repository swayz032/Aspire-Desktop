/**
 * Discipline color map for blueprint sheet chips.
 *
 * Sheet disciplines follow AIA convention (A/S/M/E/P/FP/C/L/Specs/Schedules
 * /Addenda). Each gets a distinct hue so the roster + thumbnails
 * (Wave 6.5) are scannable at a glance.
 *
 * The Drew CLASSIFY response (Wave 2A) returns `discipline_counts` as a
 * Record<string, number>. Unknown disciplines fall back to a neutral gray.
 */

export interface DisciplineStyle {
  /** Discipline key the chip displays — single uppercase letter or short code. */
  code: string;
  /** Full label for tooltips / a11y. */
  label: string;
  /** Dim background fill (rgba). */
  bg: string;
  /** Bright accent border/text color. */
  fg: string;
}

const STYLES: Record<string, DisciplineStyle> = {
  architectural: { code: 'A', label: 'Architectural', bg: 'rgba(251,191,36,0.10)', fg: '#fbbf24' },
  structural: { code: 'S', label: 'Structural', bg: 'rgba(239,68,68,0.10)', fg: '#ef4444' },
  mechanical: { code: 'M', label: 'Mechanical', bg: 'rgba(20,184,166,0.10)', fg: '#14b8a6' },
  electrical: { code: 'E', label: 'Electrical', bg: 'rgba(168,85,247,0.10)', fg: '#a855f7' },
  plumbing: { code: 'P', label: 'Plumbing', bg: 'rgba(59,130,246,0.10)', fg: '#3b82f6' },
  fire_protection: { code: 'FP', label: 'Fire Protection', bg: 'rgba(244,114,182,0.10)', fg: '#f472b6' },
  civil: { code: 'C', label: 'Civil', bg: 'rgba(132,204,22,0.10)', fg: '#84cc16' },
  landscape: { code: 'L', label: 'Landscape', bg: 'rgba(34,197,94,0.10)', fg: '#22c55e' },
  specifications: { code: 'SP', label: 'Specifications', bg: 'rgba(148,163,184,0.10)', fg: '#94a3b8' },
  schedules: { code: 'SC', label: 'Schedules', bg: 'rgba(251,146,60,0.10)', fg: '#fb923c' },
  addenda: { code: 'AD', label: 'Addenda', bg: 'rgba(217,70,239,0.10)', fg: '#d946ef' },
};

const FALLBACK: DisciplineStyle = {
  code: '?',
  label: 'Unclassified',
  bg: 'rgba(255,255,255,0.04)',
  fg: 'rgba(255,255,255,0.55)',
};

/** Resolve a discipline label (any case, spaces or underscores) to its style. */
export function getDisciplineStyle(discipline: string | null | undefined): DisciplineStyle {
  if (!discipline) return FALLBACK;
  const key = discipline.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return STYLES[key] ?? {
    ...FALLBACK,
    code: discipline.slice(0, 2).toUpperCase(),
    label: discipline,
  };
}

/** All known disciplines, in display order. */
export const KNOWN_DISCIPLINES: ReadonlyArray<keyof typeof STYLES> = [
  'architectural',
  'structural',
  'mechanical',
  'electrical',
  'plumbing',
  'fire_protection',
  'civil',
  'landscape',
  'specifications',
  'schedules',
  'addenda',
] as const;
