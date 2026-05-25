/**
 * Construction-glossary dictionary for Story Mode SmartText.
 *
 * Maps common AIA-style abbreviations to plain-English expansions. When a
 * Story Mode zone body contains a known abbreviation, SmartText renders it
 * with a dotted-underline + tooltip so a rookie GC can decode the jargon
 * without leaving the canvas.
 *
 * Conservative scope: only abbreviations that (a) appear regularly across
 * disciplines and (b) are unambiguous (no single-letter codes like 'A' or
 * 'P' that would match too aggressively).
 */

export const GLOSSARY: Record<string, string> = {
  // ─── Architectural ────────────────────────────────────────────────
  RCP: 'Reflected Ceiling Plan',
  'A.F.F.': 'Above Finish Floor',
  AFF: 'Above Finish Floor',
  'O.C.': 'On Center',
  TYP: 'Typical',
  EQ: 'Equal',
  'C.L.': 'Centerline',
  FFE: 'Finish Floor Elevation',
  HM: 'Hollow Metal',
  GWB: 'Gypsum Wall Board (drywall)',
  GYP: 'Gypsum',
  CMU: 'Concrete Masonry Unit',
  // ─── Plumbing ─────────────────────────────────────────────────────
  'V.T.R.': 'Vent Through Roof',
  VTR: 'Vent Through Roof',
  'W.C.': 'Water Closet (toilet)',
  EWC: 'Electric Water Cooler',
  WH: 'Water Heater',
  'C.O.': 'Cleanout',
  'F.D.': 'Floor Drain',
  'F.C.O.': 'Floor Cleanout',
  LAV: 'Lavatory (sink)',
  // ─── Mechanical ───────────────────────────────────────────────────
  AHU: 'Air Handling Unit',
  ERV: 'Energy Recovery Ventilator',
  HP: 'Heat Pump',
  EF: 'Exhaust Fan',
  GUH: 'Gas Unit Heater',
  CFM: 'Cubic Feet per Minute (airflow)',
  VAV: 'Variable Air Volume',
  RTU: 'Roof Top Unit',
  'BTU/H': 'British Thermal Units per Hour (heat output)',
  // ─── Electrical ───────────────────────────────────────────────────
  LV: 'Low Voltage',
  GFCI: 'Ground Fault Circuit Interrupter',
  GFI: 'Ground Fault Interrupter',
  AFCI: 'Arc Fault Circuit Interrupter',
  XFMR: 'Transformer',
  PNL: 'Panel',
  MCB: 'Main Circuit Breaker',
  MLO: 'Main Lugs Only',
  // ─── Fire Protection ──────────────────────────────────────────────
  FP: 'Fire Protection',
  FA: 'Fire Alarm',
  ESFR: 'Early Suppression Fast Response (sprinkler)',
  NFPA: 'National Fire Protection Association',
  // ─── General / contractual ────────────────────────────────────────
  DWG: 'Drawing',
  'N.T.S.': 'Not To Scale',
  'N.I.C.': 'Not In Contract',
  'O.F.C.I.': 'Owner Furnished, Contractor Installed',
  'C.F.C.I.': 'Contractor Furnished, Contractor Installed',
  'O.F.O.I.': 'Owner Furnished, Owner Installed',
  VIF: 'Verify In Field (confirm before ordering)',
  DEMO: 'Demolition',
  SF: 'Square Feet',
  LF: 'Linear Feet',
  GFCI_OUTLET: 'GFCI outlet — Ground Fault interrupting receptacle',
};

/** Sorted-by-length keys so the parser tries longer phrases first
 *  (matches `V.T.R.` before `V` if both were in the dict). */
const GLOSSARY_KEYS_BY_LENGTH = Object.keys(GLOSSARY).sort(
  (a, b) => b.length - a.length,
);

export interface ParsedSegment {
  kind: 'plain' | 'glossary' | 'sheet';
  /** Text shown to the user. */
  text: string;
  /** For glossary: the full expansion. For sheet: the sheet code (same as text). */
  meta?: string;
}

const SHEET_CODE_RE = /\b([A-Z]{1,3})-?(\d{1,4}(?:\.\d+)?)\b/g;

/**
 * Scan a string and split it into segments. Glossary matches and sheet-code
 * matches become interactive segments; everything else is plain text. Used
 * by `<SmartText>` to render Text + Pressables interleaved.
 *
 * Order: glossary first (longest-first within each pass), then sheet codes
 * over the resulting plain segments — so a sheet code embedded in glossary
 * text like "see EWC" doesn't double-match.
 *
 * Pure function — no React, no DOM. Easy to test in isolation.
 */
export function parseTextWithMatches(input: string): ParsedSegment[] {
  if (!input) return [];

  // Pass 1 — sheet codes FIRST. Otherwise glossary terms like 'FP' would
  // greedily consume the prefix of 'FP-101' and the sheet-code pass would
  // miss the full code.
  let segments: ParsedSegment[] = _splitBySheetCodes(input);

  // Pass 2 — glossary tokens over remaining plain segments only. Walk
  // longest-first within the glossary so dotted phrases (V.T.R.) match
  // before any single-token prefix collision.
  for (const term of GLOSSARY_KEYS_BY_LENGTH) {
    const next: ParsedSegment[] = [];
    for (const seg of segments) {
      if (seg.kind !== 'plain') {
        next.push(seg);
        continue;
      }
      next.push(..._splitByTerm(seg.text, term, GLOSSARY[term]));
    }
    segments = next;
  }
  const final = segments;

  // Collapse adjacent plain segments + drop empties.
  return final.reduce<ParsedSegment[]>((acc, s) => {
    if (s.text.length === 0) return acc;
    const last = acc[acc.length - 1];
    if (last && last.kind === 'plain' && s.kind === 'plain') {
      last.text += s.text;
      return acc;
    }
    acc.push(s);
    return acc;
  }, []);
}

function _splitByTerm(text: string, term: string, meta: string): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  // Escape regex metacharacters in the term, then require word boundaries.
  // For terms ending in '.', the trailing dot is part of the term — use a
  // non-word negative lookbehind/ahead to avoid mid-word matches.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'g');
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push({ kind: 'plain', text: text.slice(lastIdx, m.index) });
    }
    out.push({ kind: 'glossary', text: m[0], meta });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    out.push({ kind: 'plain', text: text.slice(lastIdx) });
  }
  return out;
}

function _splitBySheetCodes(text: string): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  SHEET_CODE_RE.lastIndex = 0;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = SHEET_CODE_RE.exec(text)) !== null) {
    const fullMatch = m[0];
    const prefix = m[1].toUpperCase();
    // Skip non-discipline-prefix matches that are clearly noise (e.g. "10-99"
    // could match as "X-Y"). Accept only the known AIA-style prefixes.
    const KNOWN_PREFIXES = new Set([
      'A', 'AD', 'AI', 'AS', 'S', 'P', 'PL', 'M', 'H', 'E', 'ED', 'EL',
      'T', 'LV', 'FP', 'F', 'FA', 'C', 'L', 'SU', 'G', 'EX',
    ]);
    if (!KNOWN_PREFIXES.has(prefix)) continue;
    if (m.index > lastIdx) {
      out.push({ kind: 'plain', text: text.slice(lastIdx, m.index) });
    }
    out.push({ kind: 'sheet', text: fullMatch, meta: fullMatch });
    lastIdx = m.index + fullMatch.length;
  }
  if (lastIdx < text.length) {
    out.push({ kind: 'plain', text: text.slice(lastIdx) });
  }
  return out;
}
