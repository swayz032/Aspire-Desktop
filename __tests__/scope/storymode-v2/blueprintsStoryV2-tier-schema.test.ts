/**
 * DV Pass 1 — Subagent A: tier schema + adapter pass-through.
 *
 * Covers:
 *   1. Type guards (isGreen / isYellow / isRed) — value + narrowing.
 *   2. Adapter pass-through — when legacy story carries DV fields, they
 *      survive the transform unchanged. When absent, output is undefined
 *      (no fabrication — per contract §1.4 render-no-badge-when-undefined).
 */
import {
  adaptLegacyStoryToV2,
  isGreen,
  isYellow,
  isRed,
  type ConfidenceTier,
  type RoutingAction,
  type BlueprintChapter,
  type ChapterSource,
} from '@/lib/api/blueprintsStoryV2';
import type {
  BlueprintStory,
  BlueprintSheetRead,
} from '@/lib/api/blueprintsApi';

describe('ConfidenceTier type guards', () => {
  describe('isGreen', () => {
    it('returns true for GREEN', () => {
      expect(isGreen('GREEN')).toBe(true);
    });
    it('returns false for YELLOW/RED/undefined', () => {
      expect(isGreen('YELLOW')).toBe(false);
      expect(isGreen('RED')).toBe(false);
      expect(isGreen(undefined)).toBe(false);
    });
  });

  describe('isYellow', () => {
    it('returns true for YELLOW', () => {
      expect(isYellow('YELLOW')).toBe(true);
    });
    it('returns false for GREEN/RED/undefined', () => {
      expect(isYellow('GREEN')).toBe(false);
      expect(isYellow('RED')).toBe(false);
      expect(isYellow(undefined)).toBe(false);
    });
  });

  describe('isRed', () => {
    it('returns true for RED', () => {
      expect(isRed('RED')).toBe(true);
    });
    it('returns false for GREEN/YELLOW/undefined', () => {
      expect(isRed('GREEN')).toBe(false);
      expect(isRed('YELLOW')).toBe(false);
      expect(isRed(undefined)).toBe(false);
    });
  });

  it('exposes locked literal types', () => {
    // Compile-time check — the type aliases must accept exactly these three.
    const tiers: ConfidenceTier[] = ['GREEN', 'YELLOW', 'RED'];
    const actions: RoutingAction[] = ['AUTO_POPULATE', 'REVIEW_PENDING', 'OPEN_QUESTION'];
    expect(tiers).toHaveLength(3);
    expect(actions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Adapter pass-through
// ---------------------------------------------------------------------------

function makeSheet(overrides: Partial<BlueprintSheetRead> = {}): BlueprintSheetRead {
  return {
    id: 'sheet-1',
    sheet_number: 'A-101',
    sheet_code: 'A-101',
    sheet_title: 'First Floor',
    discipline: 'architectural',
    scale: '1/4"',
    revision: 0,
    supersedes_id: null,
    thumbnail_url: 'https://example.com/thumb.png',
    seal_detected: false,
    created_at: '2026-05-25T00:00:00Z',
    ...overrides,
  };
}

function makeLegacy(
  phasesOverride?: BlueprintStory['phases'],
): BlueprintStory {
  return {
    project_id: 'proj-1',
    mean_confidence: 0.8,
    truth_distribution: {
      observed: 1, derived: 0, assumed: 0, missing: 0,
      field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0,
    },
    phases: phasesOverride ?? [],
    updated_at: '2026-05-25T00:00:00Z',
  } as BlueprintStory;
}

describe('adaptLegacyStoryToV2 — DV field pass-through', () => {
  it('returns undefined tier/routing fields when legacy carries none', () => {
    const story = makeLegacy([
      { key: 'p1', title: 'Demo', body_md: 'Tear-out scope', facts: [] },
    ]);
    const sheets = [makeSheet()];
    const result = adaptLegacyStoryToV2(story, sheets);
    expect(result).not.toBeNull();
    const chapter = result!.chapters[0] as BlueprintChapter;
    expect(chapter.confidence_tier).toBeUndefined();
    expect(chapter.routing_summary).toBeUndefined();
    expect(chapter.source_sheets[0].tier).toBeUndefined();
    expect(chapter.source_sheets[0].routing_action).toBeUndefined();
    expect(chapter.source_sheets[0].receipt_id).toBeUndefined();
    expect(chapter.source_sheets[0].disqualifier_codes).toBeUndefined();
  });

  it('passes through chapter-level confidence_tier + routing_summary when present on legacy phase', () => {
    // Construct a phase carrying DV fields (legacy type does not declare them
    // — the adapter is defensive and reads-through any extras).
    const legacyPhase = {
      key: 'p1',
      title: 'Plumbing',
      body_md: 'Water & drains',
      facts: [],
      confidence_tier: 'YELLOW' as ConfidenceTier,
      routing_summary: { auto: 4, review: 2, open: 1 },
    };
    const story = makeLegacy([legacyPhase as unknown as BlueprintStory['phases'][number]]);
    const result = adaptLegacyStoryToV2(story, [makeSheet()]);
    const chapter = result!.chapters[0];
    expect(chapter.confidence_tier).toBe('YELLOW');
    expect(chapter.routing_summary).toEqual({ auto: 4, review: 2, open: 1 });
  });

  it('passes through per-source tier/routing_action/receipt_id/disqualifier_codes when present on sheet', () => {
    const sheetWithDV = makeSheet({}) as BlueprintSheetRead;
    // Defensively attach DV fields the BlueprintSheetRead type does not declare.
    (sheetWithDV as unknown as Record<string, unknown>).tier = 'RED';
    (sheetWithDV as unknown as Record<string, unknown>).routing_action = 'OPEN_QUESTION';
    (sheetWithDV as unknown as Record<string, unknown>).receipt_id = 'rec_abc123';
    (sheetWithDV as unknown as Record<string, unknown>).disqualifier_codes = ['LOW_OCR', 'NO_SEAL'];

    const story = makeLegacy([
      { key: 'p1', title: 'Demo', body_md: 'Scope', facts: [] },
    ]);
    const result = adaptLegacyStoryToV2(story, [sheetWithDV]);
    const src: ChapterSource = result!.chapters[0].source_sheets[0];
    expect(src.tier).toBe('RED');
    expect(src.routing_action).toBe('OPEN_QUESTION');
    expect(src.receipt_id).toBe('rec_abc123');
    expect(src.disqualifier_codes).toEqual(['LOW_OCR', 'NO_SEAL']);
  });

  it('does NOT fabricate tier values on synthesized (sheet-grouping) chapters', () => {
    // Empty phases → synthesized chapters path. Per contract §1.4 the adapter
    // must NOT invent tier values — render layer renders no badge when undefined.
    const story = makeLegacy([]);
    const sheets = [
      makeSheet({ id: 's1', sheet_code: 'P-1', sheet_title: 'Plumbing', discipline: 'plumbing' }),
      makeSheet({ id: 's2', sheet_code: 'E-1', sheet_title: 'Power', discipline: 'electrical' }),
    ];
    const result = adaptLegacyStoryToV2(story, sheets);
    expect(result!.chapters.length).toBeGreaterThan(0);
    for (const ch of result!.chapters) {
      expect(ch.confidence_tier).toBeUndefined();
      expect(ch.routing_summary).toBeUndefined();
      for (const src of ch.source_sheets) {
        expect(src.tier).toBeUndefined();
        expect(src.routing_action).toBeUndefined();
        expect(src.receipt_id).toBeUndefined();
        expect(src.disqualifier_codes).toBeUndefined();
      }
    }
  });
});
