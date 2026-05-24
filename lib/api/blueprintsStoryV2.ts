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
  /** Discipline tag used for task rendering. */
  discipline: ChapterDiscipline;
  /** Generic per-discipline task templates. `{sheets}` interpolates the
   *  comma-joined sheet code list. Renders into the WHAT YOU HAVE TO DO zone. */
  taskTemplates: string[];
}

const META_GENERAL: DisciplineMeta = { key: 'general', title: "What's Getting Built", blurb: 'Cover sheet, sheet index, codes, and the project-wide rules everyone on site has to follow.', order: 1, discipline: 'other', taskTemplates: ['Review project codes and amendments before any field work', 'Walk the site with the cover sheet to confirm scope boundaries'] };
const META_ARCHITECTURAL: DisciplineMeta = { key: 'architectural', title: 'Floor Plans & Architecture', blurb: 'Where every room lives, how the partitions divide the space, and what finishes the architect specified.', order: 2, discipline: 'frame', taskTemplates: ['Frame partitions per the floor plan layout', 'Coordinate ceiling heights with the reflected ceiling plan', 'Install doors and frames per the door schedule', 'Apply wall + floor finishes per the finish schedule'] };
const META_STRUCTURAL: DisciplineMeta = { key: 'structural', title: 'How It Stands Up', blurb: 'Beams, columns, slabs, and load paths — the frame that holds the whole building together.', order: 3, discipline: 'frame', taskTemplates: ['Confirm slab + footing dimensions before pour', 'Coordinate steel/beam erection with the structural plans', 'Verify load paths with the engineer of record'] };
const META_PLUMBING: DisciplineMeta = { key: 'plumbing', title: 'Water & Drains', blurb: 'Where the water comes in, where the waste goes out, and every fixture in between.', order: 4, discipline: 'plumb', taskTemplates: ['Rough-in supply lines per the domestic supply plan', 'Run waste + vent per the waste/vent plan', 'Set fixtures per the plumbing fixture schedule', 'Install isolation valves where code requires'] };
const META_MECHANICAL: DisciplineMeta = { key: 'mechanical', title: 'Heating, Cooling & Air', blurb: 'How the building stays comfortable — heat pumps, AHUs, ductwork, exhaust, and fresh-air units.', order: 5, discipline: 'mech', taskTemplates: ['Set equipment per the mechanical plan (AHU, HP, ERV)', 'Run ductwork and supports per the mechanical layout', 'Cut and frame the louvers + exhaust penetrations', 'Coordinate refrigerant + condensate routing with structure'] };
const META_ELECTRICAL: DisciplineMeta = { key: 'electrical', title: 'Power, Lights & Cameras', blurb: 'Every outlet, every fixture, every panel — plus low-voltage cameras and access control.', order: 6, discipline: 'elec', taskTemplates: ['Pull conductors per the panel + breaker feeder schedules', 'Mount light fixtures per the lighting plan', 'Land devices + cover plates per the power plan', 'Coordinate low-voltage camera + access raceways'] };
const META_FIRE: DisciplineMeta = { key: 'fire', title: 'Fire Safety', blurb: 'Sprinkler heads, alarm devices, exit paths — everything the fire code calls out.', order: 7, discipline: 'fp', taskTemplates: ['Lay out sprinkler heads per the fire protection plan', 'Coordinate sprinkler drops with the ceiling grid', 'Confirm alarm device placement with the life-safety plan'] };
const META_CIVIL: DisciplineMeta = { key: 'civil', title: 'Outside the Building', blurb: 'Site work, grading, paving, and the utilities that meet the building at the property line.', order: 8, discipline: 'other', taskTemplates: ['Stake the site per the civil plan before excavation', 'Coordinate utility tie-ins at the property line', 'Confirm grading + drainage with the engineer'] };

const DISCIPLINE_MAP: Record<string, DisciplineMeta> = {
  a: META_ARCHITECTURAL, arch: META_ARCHITECTURAL, architectural: META_ARCHITECTURAL,
  s: META_STRUCTURAL, struct: META_STRUCTURAL, structural: META_STRUCTURAL,
  p: META_PLUMBING, plumb: META_PLUMBING, plumbing: META_PLUMBING,
  m: META_MECHANICAL, mech: META_MECHANICAL, mechanical: META_MECHANICAL, hvac: META_MECHANICAL,
  e: META_ELECTRICAL, elec: META_ELECTRICAL, electrical: META_ELECTRICAL,
  fp: META_FIRE, fire: META_FIRE,
  c: META_CIVIL, civ: META_CIVIL, civil: META_CIVIL,
  g: META_GENERAL, gen: META_GENERAL, general: META_GENERAL,
};

/**
 * Map a sheet's raw discipline string to a known DisciplineMeta. Sheets the
 * classifier couldn't place go into General — there is intentionally no
 * "Other Sheets" bucket; every sheet needs to land in an in-order chapter.
 */
function disciplineMetaFor(raw: string | null | undefined): DisciplineMeta {
  if (!raw) return META_GENERAL;
  const lower = raw.trim().toLowerCase();
  return DISCIPLINE_MAP[lower] ?? DISCIPLINE_MAP[lower.split(/[-_\s]/)[0]] ?? META_GENERAL;
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

    // Paraphrase sheet titles as scope-style bullets (drop the raw code,
    // lead with the title content). When the title is missing, fall back
    // to a friendly version of the sheet code.
    const inScope: ScopeItem[] = sources.map((src) => {
      const trimmedTitle = src.sheet_title.trim();
      const body = trimmedTitle.length > 0
        ? `${capitalizeFirst(trimmedTitle)} — per **${src.sheet_code}**`
        : `Per **${src.sheet_code}**`;
      return { text_md: body, evidence_sheet: src.sheet_code };
    });

    // Generic per-discipline tasks. Once Drew's REASON stage emits real
    // tasks, the narrative path takes over and these are unused.
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
