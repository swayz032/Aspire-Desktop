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
});
