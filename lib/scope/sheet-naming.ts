/**
 * Sheet display naming — purpose-specific labels for any blueprint sheet.
 *
 * The contractor never sees "Notes" / "Plan" / "Schedule" as a card label.
 * Every card gets a name that answers "what would a contractor call this
 * sheet on the jobsite" (e.g. "Plumbing Notes" instead of "Notes",
 * "Door Schedule" instead of "Schedule", "Ceiling Plan" instead of "RCP").
 *
 * Resolution order:
 *   1. Real `sheet_title` if it's longer than the discipline letter and
 *      isn't a junk single token.
 *   2. Inferred name from (sheet_code prefix → discipline) × archetype.
 *   3. Chapter-discipline fallback.
 *
 * Pure function — no React, no DOM, no I/O.
 */
import { archetypeFor, type SheetArchetype } from './archetype';

export interface SheetDisplayName {
  /** Primary display string for the card top line, usually the sheet code
   *  (e.g. "A-301") but promoted to "Sheet N" when the code is a bare
   *  number, or to a friendly form like "Addendum 1" for plain "1". */
  primary: string;
  /** Secondary purpose-specific label (e.g. "Wall Section", "Door Schedule",
   *  "Plumbing Notes"). Never the bare archetype noun. */
  secondary: string;
}

// ---------------------------------------------------------------------------
// Discipline inference from sheet code prefix (AIA convention)
// ---------------------------------------------------------------------------

export type SheetDiscipline =
  | 'general'
  | 'architectural'
  | 'structural'
  | 'civil'
  | 'demolition'
  | 'plumbing'
  | 'mechanical'
  | 'electrical'
  | 'fire'
  | 'telecom'
  | 'addendum'
  | 'partition'
  | 'finish'
  | 'unknown';

const DISCIPLINE_LABEL: Record<SheetDiscipline, string> = {
  general: 'General',
  architectural: 'Architectural',
  structural: 'Structural',
  civil: 'Civil',
  demolition: 'Demolition',
  plumbing: 'Plumbing',
  mechanical: 'HVAC',
  electrical: 'Electrical',
  fire: 'Fire Safety',
  telecom: 'Telecom',
  addendum: 'Addendum',
  partition: 'Partition',
  finish: 'Finish',
  unknown: '',
};

/** Map sheet code prefix → discipline. AIA + common variants. */
export function disciplineFromCode(code: string | null | undefined): SheetDiscipline {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return 'unknown';
  // Match leading alpha prefix (1-3 chars) before optional dash + digits.
  const m = /^([A-Z]{1,3})[-]?(\d|$)/.exec(c);
  const prefix = m ? m[1] : '';
  switch (prefix) {
    case 'G': return 'general';
    case 'GN': return 'general';
    case 'CS': return 'general'; // code summary
    case 'A': return 'architectural';
    case 'AD': return 'demolition';
    case 'AI': return 'architectural'; // interiors
    case 'S': return 'structural';
    case 'SD': return 'structural';
    case 'C': return 'civil';
    case 'CV': return 'civil';
    case 'L': return 'civil'; // landscape
    case 'P': return 'plumbing';
    case 'PL': return 'plumbing';
    case 'M': return 'mechanical';
    case 'MP': return 'mechanical';
    case 'H': return 'mechanical'; // hvac
    case 'E': return 'electrical';
    case 'EL': return 'electrical';
    case 'EP': return 'electrical';
    case 'FP': return 'fire';
    case 'FA': return 'fire';
    case 'FS': return 'fire';
    case 'F': return 'fire';
    case 'T': return 'telecom';
    case 'TC': return 'telecom';
    case 'PT': return 'partition';
    case 'SC': return 'finish'; // schedule prefix often = finish/door
    case 'AS': return 'architectural';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Purpose-specific label resolution per archetype × discipline
// ---------------------------------------------------------------------------

/**
 * Map archetype + discipline → "what a contractor calls it." Never returns
 * a bare archetype noun — every output is purpose-specific. Plumbing notes
 * → "Plumbing Notes" (not "Notes"). Electrical plan → "Electrical Plan"
 * (not "Plan"). RCP → "Ceiling Plan" (not "RCP"). Section → "Wall Section"
 * or "Building Section" (not "Section").
 */
function labelFor(arch: SheetArchetype, disc: SheetDiscipline, code: string, title: string): string {
  const t = title.trim();
  const tlow = t.toLowerCase();
  const discLabel = DISCIPLINE_LABEL[disc];

  // Quick wins from the title even if the archetype landed somewhere generic.
  if (/door\s*schedule/i.test(t)) return 'Door Schedule';
  if (/window\s*schedule/i.test(t)) return 'Window Schedule';
  if (/finish\s*schedule/i.test(t)) return 'Finish Schedule';
  if (/fixture\s*schedule/i.test(t)) return 'Fixture Schedule';
  if (/partition\s*schedule/i.test(t)) return 'Partition Schedule';
  if (/equipment\s*schedule/i.test(t)) return 'Equipment Schedule';
  if (/panel\s*schedule/i.test(t)) return 'Panel Schedule';
  if (/light(ing)?\s*schedule/i.test(t)) return 'Light Fixture Schedule';
  if (/lighting\s*plan/i.test(t)) return 'Lighting Plan';
  if (/power\s*plan/i.test(t)) return 'Power Plan';
  if (/site\s*plan/i.test(t)) return 'Site Plan';
  if (/roof\s*plan/i.test(t)) return 'Roof Plan';
  if (/floor\s*plan/i.test(t)) return 'Floor Plan';
  if (/restroom\s*plan/i.test(t)) return 'Restroom Plan';
  if (/symbols?\s*(and|&)\s*legend/i.test(t)) return 'Symbols & Legend';
  if (/abbreviations/i.test(t)) return 'Abbreviations';
  if (/code\s*summary/i.test(t)) return 'Code Summary';
  if (/sheet\s*index/i.test(t)) return 'Sheet Index';
  if (/cover\s*sheet/i.test(t)) return 'Cover Sheet';
  if (/title\s*sheet/i.test(t)) return 'Title Sheet';
  if (/waste(\s*and|\s*&|\s*\/)?\s*vent/i.test(t)) return 'Waste & Vent Plan';
  if (/wall\s*section/i.test(t)) return 'Wall Section';
  if (/building\s*section/i.test(t)) return 'Building Section';
  if (/exterior\s*elevation/i.test(t)) return 'Exterior Elevation';
  if (/interior\s*elevation/i.test(t)) return 'Interior Elevation';

  // Otherwise compose discipline + archetype.
  switch (arch) {
    case 'cover':
      return 'Cover Sheet';
    case 'index':
      return 'Sheet Index';
    case 'notes':
      if (disc === 'partition') return 'Partition Schedule';
      if (disc === 'addendum') return 'Addendum Notes';
      if (disc === 'unknown') return tlow.includes('addenda') ? 'Addendum Notes' : 'General Notes';
      return `${discLabel} Notes`;
    case 'schedule':
      if (disc === 'partition') return 'Partition Schedule';
      if (disc === 'unknown') return 'Schedule';
      return `${discLabel} Schedule`;
    case 'plan':
      if (disc === 'demolition') return 'Demo Plan';
      if (disc === 'unknown') return 'Floor Plan';
      return `${discLabel} Plan`;
    case 'rcp':
      // RCP is universally "Ceiling Plan" to a rookie.
      return 'Ceiling Plan';
    case 'detail':
      if (disc === 'unknown') return 'Details';
      return `${discLabel} Details`;
    case 'section':
      // Default "wall section" for architectural; building section otherwise.
      if (disc === 'architectural') return 'Wall Section';
      return 'Building Section';
    case 'elevation':
      return disc === 'architectural' ? 'Exterior Elevation' : 'Elevation';
    case 'demo':
      return 'Demo Plan';
    case 'lifesafety':
      return 'Life Safety Plan';
    case 'riser':
      if (disc === 'unknown') return 'Riser Diagram';
      return `${discLabel} Riser`;
    case 'legend':
      return 'Symbols & Legend';
    case 'sheet':
    default:
      // Last resort — fall back to discipline alone, then to "Sheet".
      if (disc !== 'unknown') return `${discLabel} Sheet`;
      return 'Sheet';
  }
}

// ---------------------------------------------------------------------------
// Primary code label
// ---------------------------------------------------------------------------

/** Normalize the primary line label. Bare numbers get "Sheet N" or
 *  "Addendum N" when the title hints at addenda. */
function primaryLabel(code: string, title: string): string {
  const c = code.trim();
  // Pure-digit codes: promote to "Sheet 27" — easier for a rookie to grep.
  if (/^\d{1,4}$/.test(c)) {
    const n = parseInt(c, 10);
    if (/addenda/i.test(title)) return `Addendum ${n}`;
    return `Sheet ${n}`;
  }
  return c;
}

/** Is the title actually useful (more than 2 chars and not just a single
 *  discipline letter like "A" or a generic archetype word)? */
function titleIsUseful(title: string): boolean {
  const t = title.trim();
  if (t.length < 3) return false;
  // Single discipline letter or punctuation noise.
  if (/^[A-Z]$/i.test(t)) return false;
  // Plain archetype noun by itself ("Notes", "Plan", "Schedule", "RCP",
  // "Schedules") is NOT useful — we want to replace with a purpose-specific
  // label so rookies see a contractor-readable name instead of a file-format
  // word.
  if (/^(notes?|plans?|schedules?|details?|sections?|elevations?|risers?|sheets?|rcp|addenda|addendum)$/i.test(t)) {
    return false;
  }
  return true;
}

/**
 * Resolve a sheet's display name. Always returns a `primary` (code-like
 * top line) and a `secondary` (purpose-specific contractor label).
 *
 *   sheetDisplayName('A-301', 'A')          → { primary: 'A-301',     secondary: 'Wall Section' }
 *   sheetDisplayName('1',     'Addenda')    → { primary: 'Addendum 1', secondary: 'Project Updates' }
 *   sheetDisplayName('PT-1',  'Addenda')    → { primary: 'PT-1',      secondary: 'Partition Schedule' }
 *   sheetDisplayName('SC-1',  'Schedules')  → { primary: 'SC-1',      secondary: 'Finish Schedule' }
 *   sheetDisplayName('27',    '')           → { primary: 'Sheet 27',  secondary: 'General Notes' }
 *   sheetDisplayName('P-101', 'Waste/Vent') → { primary: 'P-101',     secondary: 'Waste & Vent Plan' }
 */
export function sheetDisplayName(code: string | null | undefined, title: string | null | undefined): SheetDisplayName {
  const c = (code ?? '').trim();
  const t = (title ?? '').trim();

  // If the title is genuinely useful, use it verbatim for the secondary
  // line (e.g. real "Door Schedule", "Restroom Plan") — BUT keep one rookie
  // remap: any title containing "RCP" becomes "Ceiling Plan" because no
  // contractor rookie knows what RCP means.
  if (titleIsUseful(t)) {
    if (/\brcp\b/i.test(t)) {
      return { primary: primaryLabel(c, t), secondary: 'Ceiling Plan' };
    }
    return { primary: primaryLabel(c, t), secondary: t };
  }

  // Otherwise infer secondary from archetype × discipline.
  const arch = archetypeFor(c, t).archetype;
  const disc = disciplineFromCode(c);
  // PT-N prefix without a real title → "Partition Schedule" regardless of
  // what archetype the title-less inference picked.
  if (disc === 'partition' && !titleIsUseful(t)) {
    return { primary: primaryLabel(c, t), secondary: 'Partition Schedule' };
  }
  // Plain digit codes with "Addenda" title → addendum.
  const isPlainDigit = /^\d{1,4}$/.test(c);
  if (isPlainDigit && /addenda/i.test(t)) {
    return { primary: primaryLabel(c, t), secondary: 'Project Updates' };
  }
  // SC-N (schedule prefix) without useful title → Finish Schedule (most
  // common usage of SC-N in commercial blueprints).
  if (/^SC[-]?\d/i.test(c) && !titleIsUseful(t)) {
    return { primary: primaryLabel(c, t), secondary: 'Finish Schedule' };
  }
  // Bare-digit code with no useful title — no discipline can be inferred
  // from the code, so default to "General Notes" since stray sheets
  // numbered as raw integers in real blueprints are almost always project-
  // wide notes/addenda pages.
  if (isPlainDigit && !titleIsUseful(t)) {
    return { primary: primaryLabel(c, t), secondary: 'General Notes' };
  }
  return { primary: primaryLabel(c, t), secondary: labelFor(arch, disc, c, t) };
}
