import { adaptLegacyStoryToV2, _assertBlueprintStoryV2 } from '@/lib/api/blueprintsStoryV2';
import type { BlueprintStory } from '@/lib/api/blueprintsApi';

describe('blueprintsStoryV2 adapter', () => {
  it('returns null when input is null', () => {
    expect(adaptLegacyStoryToV2(null, [])).toBeNull();
  });

  it('converts legacy phases into v2 placeholder chapters until Drew emits real ones', () => {
    const legacy: BlueprintStory = {
      project_id: 'p1',
      mean_confidence: 0.94,
      truth_distribution: { observed: 5, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 1, missing: 0, derived: 0 },
      phases: [
        { key: 'demo', title: 'Demo', body_md: 'tear it out', facts: [] },
      ],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    };
    const v2 = adaptLegacyStoryToV2(legacy, []);
    expect(v2).not.toBeNull();
    expect(v2!.chapters).toHaveLength(1);
    expect(v2!.chapters[0].title).toBe('Demo');
    expect(v2!.chapters[0].zones.what_this_is).toBe('tear it out');
    expect(v2!.coverage.sheets_read).toBe(0);
    expect(v2!.project_id).toBe('p1');
  });

  it('asserts shape and throws for missing chapters array', () => {
    expect(() => _assertBlueprintStoryV2({ chapters: 'oops' })).toThrow(/chapters/);
  });

  it('distributes provided sheets across chapters with real thumbnails + source sheets', () => {
    const legacy: BlueprintStory = {
      project_id: 'p1', mean_confidence: 0.5,
      truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
      phases: [
        { key: 'a', title: 'A', body_md: '', facts: [] },
        { key: 'b', title: 'B', body_md: '', facts: [] },
      ],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    };
    // 4 sheets across 2 phases → 2 sheets per chapter
    const sheets = [
      { id: 's1', sheet_number: '1', sheet_code: 'A-1', sheet_title: 'Cover', discipline: 'A', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/1.png', seal_detected: false, created_at: '' },
      { id: 's2', sheet_number: '2', sheet_code: 'A-2', sheet_title: 'Plan', discipline: 'A', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/2.png', seal_detected: false, created_at: '' },
      { id: 's3', sheet_number: '3', sheet_code: 'P-1', sheet_title: 'Plumb', discipline: 'P', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/3.png', seal_detected: false, created_at: '' },
      { id: 's4', sheet_number: '4', sheet_code: 'E-1', sheet_title: 'Elec', discipline: 'E', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/4.png', seal_detected: false, created_at: '' },
    ];
    const v2 = adaptLegacyStoryToV2(legacy, sheets);
    expect(v2).not.toBeNull();
    expect(v2!.chapters).toHaveLength(2);

    // Chapter 1 gets sheets 1+2
    expect(v2!.chapters[0].thumbnail_url).toBe('https://x/1.png');
    expect(v2!.chapters[0].source_sheets).toHaveLength(2);
    expect(v2!.chapters[0].source_sheets[0].sheet_code).toBe('A-1');
    expect(v2!.chapters[0].source_sheets[1].sheet_code).toBe('A-2');

    // Chapter 2 gets sheets 3+4
    expect(v2!.chapters[1].thumbnail_url).toBe('https://x/3.png');
    expect(v2!.chapters[1].source_sheets).toHaveLength(2);
    expect(v2!.chapters[1].source_sheets[0].sheet_code).toBe('P-1');
    expect(v2!.chapters[1].source_sheets[1].sheet_code).toBe('E-1');

    // Coverage reflects real sheet count
    expect(v2!.coverage.sheets_total).toBe(4);
    expect(v2!.coverage.sheets_read).toBe(4);
  });

  it('returns null thumbnails + empty source_sheets when no sheets are provided', () => {
    const legacy: BlueprintStory = {
      project_id: 'p1', mean_confidence: 0.5,
      truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
      phases: [{ key: 'a', title: 'A', body_md: '', facts: [] }],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    };
    const v2 = adaptLegacyStoryToV2(legacy, []);
    expect(v2!.chapters[0].thumbnail_url).toBeNull();
    expect(v2!.chapters[0].source_sheets).toEqual([]);
    expect(v2!.coverage.sheets_total).toBe(0);
  });
});
