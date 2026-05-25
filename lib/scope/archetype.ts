/**
 * Sheet archetype inference from sheet code + title.
 *
 * Until Drew Wave 20.16 (Sheet Semantic Typing) ships per-sheet archetype
 * data, we infer the archetype from the sheet code suffix and the sheet
 * title text. Used by the chapter strip + sheet tabs to render a tiny
 * orientation chip ("Plan" / "Schedule" / "Detail" / "RCP" / "Notes" /
 * "Cover" / "Legend" / "Demo" / "Life Safety" / "Riser").
 *
 * Pure function — no React, no DOM, no I/O.
 */

export type SheetArchetype =
  | 'cover'
  | 'index'
  | 'notes'
  | 'schedule'
  | 'plan'
  | 'rcp'
  | 'detail'
  | 'section'
  | 'elevation'
  | 'demo'
  | 'lifesafety'
  | 'riser'
  | 'legend'
  | 'sheet';

export interface ArchetypeMeta {
  archetype: SheetArchetype;
  label: string;
}

/** Title-substring rules — checked first. Order matters: more-specific
 *  rules go before more-general. */
const TITLE_RULES: ReadonlyArray<{ patterns: RegExp[]; archetype: SheetArchetype; label: string }> = [
  { patterns: [/cover\s*sheet/i, /title\s*sheet/i], archetype: 'cover', label: 'Cover' },
  { patterns: [/sheet\s*index/i], archetype: 'index', label: 'Index' },
  { patterns: [/life\s*safety/i, /\begress\b/i], archetype: 'lifesafety', label: 'Life Safety' },
  { patterns: [/demolition/i, /existing\s*conditions/i], archetype: 'demo', label: 'Demo' },
  { patterns: [/reflected\s*ceiling/i, /\brcp\b/i], archetype: 'rcp', label: 'RCP' },
  { patterns: [/riser/i], archetype: 'riser', label: 'Riser' },
  { patterns: [/\bschedule[s]?\b/i], archetype: 'schedule', label: 'Schedule' },
  { patterns: [/\bnotes?\b/i, /abbreviations/i], archetype: 'notes', label: 'Notes' },
  { patterns: [/\bplan\b/i], archetype: 'plan', label: 'Plan' },
  { patterns: [/\bdetail[s]?\b/i], archetype: 'detail', label: 'Detail' },
  { patterns: [/\bsection[s]?\b/i], archetype: 'section', label: 'Section' },
  { patterns: [/\belevation[s]?\b/i], archetype: 'elevation', label: 'Elevation' },
  { patterns: [/legend/i, /\bsymbols?\b/i], archetype: 'legend', label: 'Legend' },
];

/** Code-suffix rules — used when the title is empty or ambiguous.
 *  Maps the numeric segment of a sheet code to a probable archetype
 *  using AIA conventions (e.g. -001 → notes, -101 → plan, -201 → riser,
 *  -301 → section, -401 → enlarged plan, -601 → schedule, -701 → finish). */
function codeNumberToArchetype(numLike: string): ArchetypeMeta | null {
  const n = parseInt(numLike, 10);
  if (Number.isNaN(n)) return null;
  if (n <= 9) return { archetype: 'notes', label: 'Notes' };          // 0-9 → notes/symbols
  if (n >= 100 && n < 200) return { archetype: 'plan', label: 'Plan' };
  if (n >= 200 && n < 300) return { archetype: 'riser', label: 'Riser' };
  if (n >= 300 && n < 400) return { archetype: 'section', label: 'Section' };
  if (n >= 400 && n < 500) return { archetype: 'plan', label: 'Enlarged Plan' };
  if (n >= 500 && n < 600) return { archetype: 'elevation', label: 'Elevation' };
  if (n >= 600 && n < 700) return { archetype: 'schedule', label: 'Schedule' };
  if (n >= 700 && n < 800) return { archetype: 'detail', label: 'Finish' };
  return null;
}

/**
 * Resolve a sheet's archetype from its code + title.
 *
 *   - "G-001"  / "Plumbing Notes"           → notes
 *   - "P-101"  / "Waste/Vent Plan"          → plan
 *   - "P-201"  / "Riser Diagram"            → riser
 *   - "A-301"  / "Building Section"         → section
 *   - "A-600"  / "Door Schedule & Details"  → schedule
 *   - "AD-101" / "Demolition Plan"          → demo
 *   - "G-101"  / "Life Safety Plan"         → lifesafety
 *   - "FP-101" / "Sprinkler Plan"           → plan
 */
export function archetypeFor(code: string | null | undefined, title: string | null | undefined): ArchetypeMeta {
  const t = (title ?? '').trim();
  if (t.length > 0) {
    for (const rule of TITLE_RULES) {
      if (rule.patterns.some((re) => re.test(t))) {
        return { archetype: rule.archetype, label: rule.label };
      }
    }
  }
  // Fall back to code-number heuristic.
  if (code) {
    const m = /^[A-Z]{1,3}[-]?(\d{1,4}(?:\.\d+)?)$/i.exec(code.trim());
    if (m) {
      const fromCode = codeNumberToArchetype(m[1]);
      if (fromCode) return fromCode;
    }
  }
  return { archetype: 'sheet', label: 'Sheet' };
}
