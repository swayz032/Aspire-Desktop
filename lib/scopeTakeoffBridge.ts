/**
 * scopeTakeoffBridge — shared cross-tab query-param contract.
 *
 * Story Mode (Scope tab) emits per-chapter Buy List rows. Tapping a row
 * navigates to Takeoff → Materials prefiltered to that chapter's slice.
 * The query param name + value format are defined HERE so both tabs
 * import from a single source of truth — preventing the typical
 * "two-team string mismatch" bug.
 *
 * Coordination contract:
 *   - Builder lives on the Scope side (Story Mode).
 *   - Parser lives on the Takeoff Materials side (other agent's sub-tab).
 *   - Both import from this module — never hardcode the param name.
 *
 * If the Materials sub-tab is not ready when Story Mode v2 ships,
 * `buildMaterialsHref({ chapterKey: null })` is the safe fallback
 * (navigates to Takeoff with no filter).
 *
 * Law #7: pure helpers — no state, no side effects.
 */

export const MATERIALS_FILTER_PARAM = 'materials_filter';

const TAKEOFF_BASE = '/service-hub/estimate-studio/takeoff';

export interface MaterialsHrefOptions {
  chapterKey: string | null;
}

export function buildMaterialsHref(opts: MaterialsHrefOptions): string {
  if (!opts.chapterKey) return TAKEOFF_BASE;
  const value = `chapter:${opts.chapterKey}`;
  return `${TAKEOFF_BASE}?${MATERIALS_FILTER_PARAM}=${encodeURIComponent(value)}`;
}

export type MaterialsFilter = { kind: 'chapter'; chapterKey: string };

export function parseMaterialsFilter(raw: string | null | undefined): MaterialsFilter | null {
  if (!raw) return null;
  const match = /^chapter:(.+)$/.exec(raw);
  if (!match) return null;
  const key = match[1].trim();
  if (!key) return null;
  return { kind: 'chapter', chapterKey: key };
}
