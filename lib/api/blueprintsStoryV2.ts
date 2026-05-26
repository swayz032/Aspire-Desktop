/**
 * BlueprintStoryV2 — chapter-based shape that replaces phases[] over time.
 *
 * Coexists with legacy BlueprintStory.phases[] for one wave. The
 * `adaptLegacyStoryToV2` adapter has TWO render paths:
 *
 *   1. **Phase narrative path** — When Drew's REASON stage has populated
 *      legacy phases with real title + body_md, we lift each phase into a
 *      chapter and distribute uploaded sheets across them.
 *   2. **Sheet-grouping fallback** — When phases are empty shells (REASON
 *      not done yet or unavailable for this project), we generate chapters
 *      by grouping the uploaded sheets by discipline. Each generated chapter
 *      has a rookie-friendly title ("Water & Drains" for plumbing sheets,
 *      "Power, Lights & Cameras" for electrical, etc.), an auto-composed
 *      "WHAT THIS IS" zone describing the discipline + listing the sheets,
 *      and an "IN SCOPE" list of every sheet's title — all derived from
 *      CLASSIFY-stage data that exists immediately after upload.
 *
 * This way the contractor always sees content as soon as a blueprint is
 * uploaded, even while Drew is still composing the narrative.
 *
 * Law #7: pure types + pure adapter. No fetching, no state.
 */
import type { BlueprintStory, BlueprintSheetRead } from './blueprintsApi';
import { contentForChapter } from '@/lib/scope/discipline-content';

export interface BlueprintStoryV2 {
  project_id: string;
  mean_confidence: number;
  truth_distribution: BlueprintStory['truth_distribution'];
  chapters: BlueprintChapter[];
  coverage: ChapterCoverage;
  /** ISO 8601 server timestamp, or null when the backend has never updated
   *  the story (do not fabricate "now" — UI renders an explicit "—"). */
  updated_at: string | null;
  // TODO(story-v2 follow-up): carry `status` from legacy BlueprintStory once
  // a v2 consumer needs to branch on the pipeline progress (currently the UI
  // reads progress from useBlueprintStory().isPolling and stage_progress).
}

export interface ChapterCoverage {
  sheets_total: number;
  sheets_read: number;
  pages_total: number;
  pages_read: number;
}

export interface BlueprintChapter {
  key: string;
  ordinal: number;
  title: string;
  confidence: number;
  source_pages: number[];
  source_sheets: ChapterSource[];
  thumbnail_url: string | null;
  zones: ChapterZones;
  // 2026-05-25 — DV wave: confidence tier classification + routing summary.
  // Both optional; when absent the render layer renders no badge.
  confidence_tier?: ConfidenceTier;
  routing_summary?: { auto: number; review: number; open: number };
}

export interface ChapterSource {
  sheet_code: string;
  sheet_title: string;
  page_number: number;
  render_url: string | null;
  // 2026-05-25 — DV wave: per-source tier + routing decision metadata.
  // All optional; pass-through only — adapter never fabricates these.
  tier?: ConfidenceTier;
  routing_action?: RoutingAction;
  receipt_id?: string;
  disqualifier_codes?: string[];
}

// 2026-05-25 — DV wave: locked confidence-tier + routing-action type aliases.
export type ConfidenceTier = 'GREEN' | 'YELLOW' | 'RED';
export type RoutingAction = 'AUTO_POPULATE' | 'REVIEW_PENDING' | 'OPEN_QUESTION';

/**
 * 2026-05-25 — DV wave: full ExtractionReceipt shape returned by the backend
 * ledger endpoint `/v1/blueprints/projects/{projectId}/receipts/{receiptId}`.
 *
 * Receipts are IMMUTABLE (Law #2). Once minted by the backend they never
 * change — clients can cache them forever within a session.
 *
 * Lazy-loaded by the SheetReceiptDrawer via `useExtractionReceipt(...)`.
 */
export interface ExtractionReceipt {
  receipt_id: string;
  sheet_id: string;
  doc_hash: string;
  pipeline_version: string;
  tier: ConfidenceTier;
  routing_action: RoutingAction;
  disqualifier_codes: string[];

  // Evidence
  evidence_ocr_tokens: Array<{
    text: string;
    confidence: number;
    bbox: [number, number, number, number]; // x, y, w, h
  }>;
  cluster_bbox?: [number, number, number, number];
  iou?: number;
  primitive_recall?: number;
  primitive_precision?: number;

  // Pipeline metadata
  ocr_engine: string;
  runtime_ms: number;
  cost_usd: number;
  trajectory_class?: 'FOLLOW' | 'STAY' | 'DRIFT_NEAR' | 'SPLIT_CLUSTER' | 'THIRD_REGION' | 'NULL_COLLAPSE';

  // Audit
  audit_trail: string; // path/URL to JSONL
  created_at: string; // ISO 8601
}

/** True iff tier is GREEN. Narrows undefined → false. */
export function isGreen(tier: ConfidenceTier | undefined): boolean {
  return tier === 'GREEN';
}
/** True iff tier is YELLOW. Narrows undefined → false. */
export function isYellow(tier: ConfidenceTier | undefined): boolean {
  return tier === 'YELLOW';
}
/** True iff tier is RED. Narrows undefined → false. */
export function isRed(tier: ConfidenceTier | undefined): boolean {
  return tier === 'RED';
}

export interface ChapterZones {
  what_this_is: string;
  in_scope: ScopeItem[];
  not_in_scope: ScopeItem[];
  tasks: ChapterTask[];
  buy_list: ChapterMaterial[];
  open_questions: OpenQuestion[];
  /** Rookie-trap warnings rendered in the WATCH OUT FOR zone. Plain strings;
   *  paragraph-style. Optional — adapter may omit when content is unknown. */
  common_mistakes?: string[];
  /** Numbered field-work sequence rendered in the ORDER OF OPERATIONS zone.
   *  Plain strings; rendered as a numbered list. Optional. */
  order_of_ops?: string[];
  /** 3-bullet skim shown pinned at the top of the left pane. Optional.
   *  When empty/missing, the TL;DR header is hidden. */
  tldr?: string[];
}

export interface ScopeItem {
  text_md: string;
  evidence_sheet?: string;
}

export type ChapterDiscipline =
  | 'demo' | 'frame' | 'plumb' | 'mech' | 'elec' | 'finish' | 'fp' | 'other';

export interface ChapterTask {
  text_md: string;
  discipline: ChapterDiscipline;
  evidence_sheets: string[];
}

export interface ChapterMaterial {
  quantity_display: string;
  name: string;
  material_id?: string;
}

export interface OpenQuestion {
  question_id: string;
  title: string;
  body_md: string;
  blueprint_region?: BlueprintRegion;
}

export interface BlueprintRegion {
  sheet_code: string;
  x: number; y: number; w: number; h: number;
  label: string;
  kind: 'primary' | 'secondary';
}

export function _assertBlueprintStoryV2(value: unknown): asserts value is BlueprintStoryV2 {
  if (value == null || typeof value !== 'object') {
    throw new Error('BlueprintStoryV2: expected object');
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.chapters)) {
    throw new Error('BlueprintStoryV2: chapters must be an array');
  }
}

// ---------------------------------------------------------------------------
// Discipline grouping — rookie-friendly chapter titles + descriptions
// derived from the uploaded sheets when REASON hasn't filled in narratives.
// ---------------------------------------------------------------------------

interface DisciplineMeta {
  /** Stable chapter key for the discipline grouping path. */
  key: string;
  /** Rookie-friendly title shown on the chapter card + headline. */
  title: string;
  /** One-sentence "WHAT THIS IS" blurb that frames what this discipline covers. */
  blurb: string;
  /** Display order on the chapter strip. Lower comes first. */
  order: number;
  /** Discipline tag used for task rendering. */
  discipline: ChapterDiscipline;
  /** Generic per-discipline task templates. `{sheets}` interpolates the
   *  comma-joined sheet code list. Renders into the WHAT YOU HAVE TO DO zone. */
  taskTemplates: string[];
}

// Discipline metadata — universal taxonomy that works for any AIA-style
// drawing set. Order is the same order the chapters render in the strip.
const META_GENERAL: DisciplineMeta = { key: 'general', title: "What's Getting Built", blurb: 'Cover sheet, sheet index, codes, and the project-wide rules everyone on site has to follow.', order: 1, discipline: 'other', taskTemplates: ['Review project codes and amendments before any field work', 'Walk the site with the cover sheet to confirm scope boundaries'] };
const META_DEMOLITION: DisciplineMeta = { key: 'demolition', title: "What We're Tearing Out", blurb: 'Existing conditions surveys and demolition scope — what comes down before any new work goes up.', order: 2, discipline: 'demo', taskTemplates: ['Protect adjacent construction before any demo cuts', 'Patch + repair surfaces the demo plan calls out', 'Stage debris removal so site access stays open', 'Confirm utility cutoffs with the existing conditions surveys'] };
const META_ARCHITECTURAL: DisciplineMeta = { key: 'architectural', title: 'Floor Plans & Architecture', blurb: 'Where every room lives, how the partitions divide the space, and what finishes the architect specified.', order: 3, discipline: 'frame', taskTemplates: ['Frame partitions per the floor plan layout', 'Coordinate ceiling heights with the reflected ceiling plan', 'Install doors and frames per the door schedule', 'Apply wall + floor finishes per the finish schedule'] };
const META_STRUCTURAL: DisciplineMeta = { key: 'structural', title: 'How It Stands Up', blurb: 'Beams, columns, slabs, and load paths — the frame that holds the whole building together.', order: 4, discipline: 'frame', taskTemplates: ['Confirm slab + footing dimensions before pour', 'Coordinate steel/beam erection with the structural plans', 'Verify load paths with the engineer of record'] };
const META_PLUMBING: DisciplineMeta = { key: 'plumbing', title: 'Water & Drains', blurb: 'Where the water comes in, where the waste goes out, and every fixture in between.', order: 5, discipline: 'plumb', taskTemplates: ['Rough-in supply lines per the domestic supply plan', 'Run waste + vent per the waste/vent plan', 'Set fixtures per the plumbing fixture schedule', 'Install isolation valves where code requires'] };
const META_MECHANICAL: DisciplineMeta = { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 6, discipline: 'mech', taskTemplates: ['Set equipment per the mechanical plan (AHU, HP, ERV)', 'Run ductwork and supports per the mechanical layout', 'Cut and frame the louvers + exhaust penetrations', 'Coordinate refrigerant + condensate routing with structure'] };
const META_ELECTRICAL: DisciplineMeta = { key: 'electrical', title: 'Power, Lights & Cameras', blurb: 'Every outlet, every fixture, every panel — plus low-voltage cameras and access control.', order: 7, discipline: 'elec', taskTemplates: ['Pull conductors per the panel + breaker feeder schedules', 'Mount light fixtures per the lighting plan', 'Land devices + cover plates per the power plan', 'Coordinate low-voltage camera + access raceways'] };
const META_FIRE: DisciplineMeta = { key: 'fire', title: 'Fire Safety', blurb: 'Sprinkler heads, alarm devices, exit paths — everything the fire code calls out.', order: 8, discipline: 'fp', taskTemplates: ['Lay out sprinkler heads per the fire protection plan', 'Coordinate sprinkler drops with the ceiling grid', 'Confirm alarm device placement with the life-safety plan'] };
const META_CIVIL: DisciplineMeta = { key: 'civil', title: 'Outside the Building', blurb: 'Site work, grading, paving, landscape, and the utilities that meet the building at the property line.', order: 9, discipline: 'other', taskTemplates: ['Stake the site per the civil plan before excavation', 'Coordinate utility tie-ins at the property line', 'Confirm grading + drainage with the engineer'] };

// Discipline-field lookup: backend-tagged discipline string → DisciplineMeta.
// Accepts both single-letter codes ("A", "P", "M") and full names
// ("architectural", "plumbing", "mechanical"). Folds adjacent disciplines
// into the closest match (telecom → electrical, landscape → civil) so
// every sheet lands in an in-order chapter — no "Other Sheets" catch-all.
const DISCIPLINE_MAP: Record<string, DisciplineMeta> = {
  // General / cover / lifesafety
  g: META_GENERAL, gen: META_GENERAL, general: META_GENERAL,
  cover: META_GENERAL, ls: META_GENERAL, lifesafety: META_GENERAL,
  // Demolition / existing conditions
  ad: META_DEMOLITION, d: META_DEMOLITION, demo: META_DEMOLITION, demolition: META_DEMOLITION,
  ex: META_DEMOLITION, exist: META_DEMOLITION, existing: META_DEMOLITION,
  // Architectural (incl. interiors, architectural site)
  a: META_ARCHITECTURAL, ai: META_ARCHITECTURAL, as: META_ARCHITECTURAL,
  arch: META_ARCHITECTURAL, architectural: META_ARCHITECTURAL,
  interior: META_ARCHITECTURAL, interiors: META_ARCHITECTURAL,
  // Structural
  s: META_STRUCTURAL, struct: META_STRUCTURAL, structural: META_STRUCTURAL,
  // Plumbing
  p: META_PLUMBING, pl: META_PLUMBING, plumb: META_PLUMBING, plumbing: META_PLUMBING,
  // Mechanical / HVAC (h often used for HVAC)
  m: META_MECHANICAL, h: META_MECHANICAL,
  mech: META_MECHANICAL, mechanical: META_MECHANICAL, hvac: META_MECHANICAL,
  // Electrical + adjacent low-voltage (telecom, data, security folded in)
  e: META_ELECTRICAL, ed: META_ELECTRICAL, el: META_ELECTRICAL,
  t: META_ELECTRICAL, tel: META_ELECTRICAL, telecom: META_ELECTRICAL,
  lv: META_ELECTRICAL, data: META_ELECTRICAL, sec: META_ELECTRICAL, security: META_ELECTRICAL,
  elec: META_ELECTRICAL, electrical: META_ELECTRICAL,
  // Fire protection / fire alarm
  fp: META_FIRE, f: META_FIRE, fa: META_FIRE,
  fire: META_FIRE, sprinkler: META_FIRE,
  // Civil + landscape + survey (folded in)
  c: META_CIVIL, ci: META_CIVIL, civ: META_CIVIL, civil: META_CIVIL,
  l: META_CIVIL, land: META_CIVIL, landscape: META_CIVIL,
  su: META_CIVIL, sur: META_CIVIL, survey: META_CIVIL,
};

/**
 * Pull the discipline prefix out of a sheet code. Handles the typical AIA
 * formats:
 *   "A-101"  → "A"        "FP-101" → "FP"      "AD-101" → "AD"
 *   "EX01"   → "EX"       "P-001"  → "P"       "S-1.1"  → "S"
 *   "A101"   → "A"        "M201"   → "M"       "C-100"  → "C"
 * Returns null if no recognizable prefix exists (e.g. a pure-numeric code
 * like "3" or "12" — Drew sometimes emits those when the title block OCR
 * can only see the page-position number).
 */
function disciplinePrefixFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = /^([A-Z]{1,3})(?:[-_\s]*\d|\d)/.exec(code.toUpperCase().trim());
  return m ? m[1] : null;
}

/**
 * Universal sheet → DisciplineMeta resolver. Tries three signals in order:
 *
 *   1. The backend-tagged `discipline` field if present and recognized.
 *   2. The sheet code prefix (covers the case where the classifier didn't
 *      tag the sheet but the title block extraction worked).
 *   3. Falls back to General. Never returns null.
 *
 * This is the keystone of universality — any AIA-conformant drawing set
 * lands every sheet in an in-order rookie chapter without backend changes.
 */
function disciplineMetaFor(sheet: BlueprintSheetRead): DisciplineMeta {
  // (1) explicit backend discipline tag
  const rawDiscipline = sheet.discipline?.trim().toLowerCase();
  if (rawDiscipline) {
    const exact = DISCIPLINE_MAP[rawDiscipline];
    if (exact) return exact;
    const firstSeg = DISCIPLINE_MAP[rawDiscipline.split(/[-_\s]/)[0]];
    if (firstSeg) return firstSeg;
  }
  // (2) sheet code prefix
  const prefix = disciplinePrefixFromCode(sheet.sheet_code ?? sheet.sheet_number);
  if (prefix) {
    const fromPrefix = DISCIPLINE_MAP[prefix.toLowerCase()];
    if (fromPrefix) return fromPrefix;
  }
  // (3) fall back to General — every sheet gets a real chapter, no catch-all
  return META_GENERAL;
}

/** True if any phase carries Drew-narrative content (real title or body_md). */
function phasesHaveNarrative(phases: BlueprintStory['phases']): boolean {
  if (!phases) return false;
  return phases.some((p) => {
    const title = (p.title ?? '').trim();
    const body = (p.body_md ?? '').trim();
    return title.length > 0 || body.length > 0;
  });
}

/**
 * 2026-05-25 — DV wave: pass through tier/routing fields when present;
 * default-omit when absent. We never fabricate tier values in the adapter —
 * the contract (§1.4) requires "render no badge when undefined".
 */
function sheetSource(s: BlueprintSheetRead, pageNumber: number): ChapterSource {
  const anyS = s as unknown as Record<string, unknown>;
  const out: ChapterSource = {
    sheet_code: s.sheet_code ?? s.sheet_number ?? `Sheet ${pageNumber}`,
    sheet_title: s.sheet_title ?? s.discipline ?? '',
    page_number: pageNumber,
    render_url: s.thumbnail_url,
  };
  if (anyS.tier !== undefined) out.tier = anyS.tier as ConfidenceTier;
  if (anyS.routing_action !== undefined) out.routing_action = anyS.routing_action as RoutingAction;
  if (anyS.receipt_id !== undefined) out.receipt_id = anyS.receipt_id as string;
  if (anyS.disqualifier_codes !== undefined) out.disqualifier_codes = anyS.disqualifier_codes as string[];
  return out;
}

/**
 * Build chapters by grouping sheets by discipline. Each chapter gets a
 * rookie-friendly title + blurb + an "IN SCOPE" list of every sheet in the
 * group. This is the path the UI takes when REASON hasn't filled in
 * narratives yet — so the contractor sees real content immediately on upload.
 */
function chaptersFromSheetGrouping(
  sheets: BlueprintSheetRead[],
  confidence: number,
): BlueprintChapter[] {
  if (sheets.length === 0) return [];

  // Group sheets by discipline meta. Map preserves insertion order so the
  // chapter sort happens after the grouping pass.
  const groups = new Map<string, { meta: DisciplineMeta; entries: { sheet: BlueprintSheetRead; pageNumber: number }[] }>();
  sheets.forEach((s, idx) => {
    const meta = disciplineMetaFor(s);
    const slot = groups.get(meta.key) ?? { meta, entries: [] };
    slot.entries.push({ sheet: s, pageNumber: idx + 1 });
    groups.set(meta.key, slot);
  });

  // Stable display order via DisciplineMeta.order.
  const ordered = [...groups.values()].sort((a, b) => a.meta.order - b.meta.order);

  return ordered.map((group, idx) => {
    const sources = group.entries.map((e) => sheetSource(e.sheet, e.pageNumber));

    // 2026-05-24 — IN SCOPE bullets now come from the per-discipline static
    // content library (`lib/scope/discipline-content.ts`) instead of
    // enumerating sheet codes. Sheet codes already live in DREW READ; IN
    // SCOPE should answer "what's covered" not "what sheets are here."
    const content = contentForChapter(group.meta.key);
    const inScope: ScopeItem[] = content.scopeItems.map((item) => ({
      text_md: item,
      evidence_sheet: sources[0]?.sheet_code,
    }));

    // Per-discipline tasks templates merged with the discipline meta tags so
    // the WHAT YOU HAVE TO DO zone shows the right discipline pill.
    const evidenceSheetCodes = sources.map((s) => s.sheet_code);
    const tasks: ChapterTask[] = group.meta.taskTemplates.map((tpl) => ({
      text_md: tpl,
      discipline: group.meta.discipline,
      evidence_sheets: evidenceSheetCodes,
    }));

    const sheetSummary = sources.length === 1
      ? `1 sheet (${sources[0].sheet_code})`
      : `${sources.length} sheets covering ${sources[0].sheet_code}–${sources[sources.length - 1].sheet_code}`;
    const whatThisIs = `${group.meta.blurb} Drew classified ${sheetSummary} into this chapter.`;

    // 3-bullet TL;DR pinned at the top of the left pane. Built from real
    // chapter data (count + first scope item + first common-mistake) so
    // the rookie can skim in 5 seconds.
    const tldr: string[] = [
      sheetSummary.charAt(0).toUpperCase() + sheetSummary.slice(1),
      content.scopeItems[0],
      content.commonMistakes[0] ? `Watch out: ${content.commonMistakes[0]}` : '',
    ].filter((b): b is string => Boolean(b));

    return {
      key: group.meta.key,
      ordinal: idx + 1,
      title: group.meta.title,
      confidence,
      source_pages: group.entries.map((e) => e.pageNumber),
      source_sheets: sources,
      thumbnail_url: sources[0]?.render_url ?? null,
      zones: {
        what_this_is: whatThisIs,
        in_scope: inScope,
        not_in_scope: [],
        tasks,
        buy_list: [],
        open_questions: [],
        common_mistakes: content.commonMistakes,
        order_of_ops: content.orderOfOps,
        tldr,
      },
    };
  });
}

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Lift legacy phases[] into a v2-shaped story.
 *
 *   - If phases have real narrative (Drew REASON has run), use them and
 *     distribute uploaded sheets across the chapters round-robin so each
 *     card still gets a real blueprint thumbnail.
 *   - Otherwise, generate chapters by grouping sheets by discipline so the
 *     contractor immediately sees rookie-friendly chapters with real
 *     content, even before Drew has finished narrating.
 *
 * Returns null if input is null.
 */
export function adaptLegacyStoryToV2(
  legacy: BlueprintStory | null,
  sheets: BlueprintSheetRead[],
): BlueprintStoryV2 | null {
  if (!legacy) return null;
  const phases = legacy.phases ?? [];
  const sheetCount = sheets.length;
  const confidence = legacy.mean_confidence ?? 0;

  let chapters: BlueprintChapter[];

  if (phasesHaveNarrative(phases)) {
    // ─── Phase narrative path ─────────────────────────────────────────────
    const phaseCount = Math.max(1, phases.length);
    const perChapter = sheetCount > 0 ? Math.max(1, Math.ceil(sheetCount / phaseCount)) : 0;
    chapters = phases.map((p, idx) => {
      const start = idx * perChapter;
      const slice = sheets.slice(start, start + perChapter);
      const sources: ChapterSource[] = slice.map((s, i) => sheetSource(s, start + i + 1));
      // 2026-05-25 — DV wave: pass through tier/routing fields when present;
      // default-omit when absent. Synthesized chapters never fabricate tier.
      const anyP = p as unknown as Record<string, unknown>;
      const chapter: BlueprintChapter = {
        key: p.key ?? `chapter-${idx + 1}`,
        ordinal: idx + 1,
        title: p.title ?? `Chapter ${idx + 1}`,
        confidence,
        source_pages: slice.map((_, i) => start + i + 1),
        source_sheets: sources,
        thumbnail_url: slice[0]?.thumbnail_url ?? null,
        zones: {
          what_this_is: p.body_md ?? '',
          in_scope: [],
          not_in_scope: [],
          tasks: [],
          buy_list: [],
          open_questions: [],
        },
      };
      if (anyP.confidence_tier !== undefined) chapter.confidence_tier = anyP.confidence_tier as ConfidenceTier;
      if (anyP.routing_summary !== undefined) chapter.routing_summary = anyP.routing_summary as { auto: number; review: number; open: number };
      return chapter;
    });
  } else {
    // ─── Sheet-grouping fallback ──────────────────────────────────────────
    // No real narrative yet — group sheets by discipline so the user sees
    // immediately-useful chapters with real content.
    chapters = chaptersFromSheetGrouping(sheets, confidence);
  }

  return {
    project_id: legacy.project_id,
    mean_confidence: confidence,
    truth_distribution: legacy.truth_distribution,
    updated_at: legacy.updated_at ?? null,
    chapters,
    coverage: {
      sheets_total: sheetCount,
      sheets_read: sheetCount,
      pages_total: sheetCount,
      pages_read: sheetCount,
    },
  };
}
