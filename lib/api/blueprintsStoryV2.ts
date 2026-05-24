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
}

export interface ChapterSource {
  sheet_code: string;
  sheet_title: string;
  page_number: number;
  render_url: string | null;
}

export interface ChapterZones {
  what_this_is: string;
  in_scope: ScopeItem[];
  not_in_scope: ScopeItem[];
  tasks: ChapterTask[];
  buy_list: ChapterMaterial[];
  open_questions: OpenQuestion[];
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
}

const DISCIPLINE_MAP: Record<string, DisciplineMeta> = {
  // Architectural — floor plans, partitions, finishes
  a: { key: 'architectural', title: 'Floor Plans & Architecture', blurb: 'Where every room lives, how the partitions divide the space, and what finishes the architect specified.', order: 2 },
  arch: { key: 'architectural', title: 'Floor Plans & Architecture', blurb: 'Where every room lives, how the partitions divide the space, and what finishes the architect specified.', order: 2 },
  architectural: { key: 'architectural', title: 'Floor Plans & Architecture', blurb: 'Where every room lives, how the partitions divide the space, and what finishes the architect specified.', order: 2 },
  // Structural — frame, load paths
  s: { key: 'structural', title: 'How It Stands Up', blurb: 'Beams, columns, slabs, and load paths — the frame that holds the whole building together.', order: 3 },
  struct: { key: 'structural', title: 'How It Stands Up', blurb: 'Beams, columns, slabs, and load paths — the frame that holds the whole building together.', order: 3 },
  structural: { key: 'structural', title: 'How It Stands Up', blurb: 'Beams, columns, slabs, and load paths — the frame that holds the whole building together.', order: 3 },
  // Plumbing — water + drains
  p: { key: 'plumbing', title: 'Water & Drains', blurb: 'Where the water comes in, where the waste goes out, and every fixture in between.', order: 4 },
  plumb: { key: 'plumbing', title: 'Water & Drains', blurb: 'Where the water comes in, where the waste goes out, and every fixture in between.', order: 4 },
  plumbing: { key: 'plumbing', title: 'Water & Drains', blurb: 'Where the water comes in, where the waste goes out, and every fixture in between.', order: 4 },
  // Mechanical / HVAC
  m: { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 5 },
  mech: { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 5 },
  mechanical: { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 5 },
  hvac: { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 5 },
  // Electrical
  e: { key: 'electrical', title: 'Power, Lights & Cameras', blurb: 'Every outlet, every fixture, every panel — plus low-voltage cameras and access control.', order: 6 },
  elec: { key: 'electrical', title: 'Power, Lights & Cameras', blurb: 'Every outlet, every fixture, every panel — plus low-voltage cameras and access control.', order: 6 },
  electrical: { key: 'electrical', title: 'Power, Lights & Cameras', blurb: 'Every outlet, every fixture, every panel — plus low-voltage cameras and access control.', order: 6 },
  // Fire protection
  fp: { key: 'fire', title: 'Fire Safety', blurb: 'Sprinkler heads, alarm devices, exit paths — everything the fire code calls out.', order: 7 },
  fire: { key: 'fire', title: 'Fire Safety', blurb: 'Sprinkler heads, alarm devices, exit paths — everything the fire code calls out.', order: 7 },
  // Civil / site
  c: { key: 'civil', title: 'Outside the Building', blurb: 'Site work, grading, paving, and the utilities that meet the building at the property line.', order: 8 },
  civ: { key: 'civil', title: 'Outside the Building', blurb: 'Site work, grading, paving, and the utilities that meet the building at the property line.', order: 8 },
  civil: { key: 'civil', title: 'Outside the Building', blurb: 'Site work, grading, paving, and the utilities that meet the building at the property line.', order: 8 },
  // General / cover sheets
  g: { key: 'general', title: "What's Getting Built", blurb: 'Cover sheet, sheet index, codes, and the project-wide rules everyone on site has to follow.', order: 1 },
  gen: { key: 'general', title: "What's Getting Built", blurb: 'Cover sheet, sheet index, codes, and the project-wide rules everyone on site has to follow.', order: 1 },
  general: { key: 'general', title: "What's Getting Built", blurb: 'Cover sheet, sheet index, codes, and the project-wide rules everyone on site has to follow.', order: 1 },
};

const OTHER_META: DisciplineMeta = {
  key: 'other',
  title: 'Other Sheets',
  blurb: 'Sheets the classifier did not place into a known discipline yet.',
  order: 99,
};

function disciplineMetaFor(raw: string | null | undefined): DisciplineMeta {
  if (!raw) return OTHER_META;
  const lower = raw.trim().toLowerCase();
  // Try the exact value, then the first segment up to a separator (e.g. "P-PLUMB" → "p").
  return DISCIPLINE_MAP[lower] ?? DISCIPLINE_MAP[lower.split(/[-_\s]/)[0]] ?? OTHER_META;
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

function sheetSource(s: BlueprintSheetRead, pageNumber: number): ChapterSource {
  return {
    sheet_code: s.sheet_code ?? s.sheet_number ?? `Sheet ${pageNumber}`,
    sheet_title: s.sheet_title ?? s.discipline ?? '',
    page_number: pageNumber,
    render_url: s.thumbnail_url,
  };
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
    const meta = disciplineMetaFor(s.discipline);
    const slot = groups.get(meta.key) ?? { meta, entries: [] };
    slot.entries.push({ sheet: s, pageNumber: idx + 1 });
    groups.set(meta.key, slot);
  });

  // Stable display order via DisciplineMeta.order.
  const ordered = [...groups.values()].sort((a, b) => a.meta.order - b.meta.order);

  return ordered.map((group, idx) => {
    const sources = group.entries.map((e) => sheetSource(e.sheet, e.pageNumber));
    const inScope: ScopeItem[] = sources.map((src) => ({
      text_md: src.sheet_title
        ? `**${src.sheet_code}** — ${src.sheet_title}`
        : `**${src.sheet_code}**`,
      evidence_sheet: src.sheet_code,
    }));
    const sheetSummary = sources.length === 1
      ? `1 sheet (${sources[0].sheet_code})`
      : `${sources.length} sheets covering ${sources[0].sheet_code}–${sources[sources.length - 1].sheet_code}`;
    const whatThisIs = `${group.meta.blurb} Drew classified ${sheetSummary} into this chapter.`;

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
        tasks: [],
        buy_list: [],
        open_questions: [],
      },
    };
  });
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
      return {
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
