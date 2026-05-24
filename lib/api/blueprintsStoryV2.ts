/**
 * BlueprintStoryV2 — chapter-based shape that replaces phases[] over time.
 *
 * Coexists with legacy BlueprintStory.phases[] for one wave. The
 * `adaptLegacyStoryToV2` adapter lets the v2 UI render against the
 * current backend by lifting each legacy phase into a placeholder
 * chapter with empty zones and no source sheets. Once Drew backend
 * emits real chapters[], the adapter becomes a passthrough and the
 * legacy phases[] field is removed in a follow-up wave.
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
  // TODO(story-v2 follow-up): when the first network parse site lands
  // (Drew backend cuts over from phases[] → chapters[]), tighten this
  // to match `_assertShape` in blueprintsApi.ts — validate every required
  // primitive (project_id, mean_confidence, truth_distribution, coverage,
  // updated_at) and throw BlueprintsApiError(502, 'BAD_RESPONSE_SHAPE',…)
  // so error telemetry stays consistent with the rest of the API.
}

/**
 * Lift legacy phases[] into a v2-shaped story with placeholder chapters.
 *
 * Sheets are distributed across the placeholder chapters round-robin (each
 * chapter gets a contiguous slice) so the UI can show real blueprint
 * thumbnails + sheet-tab switching even while Drew is still emitting only
 * legacy phases. Mapping is semantically arbitrary for legacy data — once
 * Drew emits real chapters[] with first-class `source_sheets`, the adapter
 * becomes a passthrough and this distribution code becomes dead.
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
  const phaseCount = Math.max(1, phases.length);
  const perChapter = sheetCount > 0 ? Math.max(1, Math.ceil(sheetCount / phaseCount)) : 0;

  return {
    project_id: legacy.project_id,
    mean_confidence: legacy.mean_confidence ?? 0,
    truth_distribution: legacy.truth_distribution,
    updated_at: legacy.updated_at ?? null,
    chapters: phases.map((p, idx) => {
      const start = idx * perChapter;
      const slice = sheets.slice(start, start + perChapter);
      const sources: ChapterSource[] = slice.map((s, i) => ({
        sheet_code: s.sheet_code ?? s.sheet_number ?? `Sheet ${start + i + 1}`,
        sheet_title: s.sheet_title ?? s.discipline ?? '',
        page_number: start + i + 1,
        render_url: s.thumbnail_url,
      }));
      return {
        key: p.key ?? `chapter-${idx + 1}`,
        ordinal: idx + 1,
        title: p.title ?? `Chapter ${idx + 1}`,
        confidence: legacy.mean_confidence ?? 0,
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
    }),
    coverage: {
      sheets_total: sheetCount,
      sheets_read: sheetCount,
      pages_total: sheetCount,
      pages_read: sheetCount,
    },
  };
}
