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
      phases: [{ key: 'a', title: 'A', body_md: 'real narrative', facts: [] }],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    };
    const v2 = adaptLegacyStoryToV2(legacy, []);
    expect(v2!.chapters[0].thumbnail_url).toBeNull();
    expect(v2!.chapters[0].source_sheets).toEqual([]);
    expect(v2!.coverage.sheets_total).toBe(0);
  });
});

describe('blueprintsStoryV2 adapter — sheet-grouping fallback (REASON not done)', () => {
  // Reuse the sheet shape from the distribute test above. When phases have
  // no narrative content, the adapter groups sheets by discipline into
  // rookie-friendly chapters so the user sees real content immediately.

  const sheetsAcrossDisciplines = [
    { id: 'g1', sheet_number: '1', sheet_code: 'G-001', sheet_title: 'Cover Sheet', discipline: 'G', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/g1.png', seal_detected: false, created_at: '' },
    { id: 'a1', sheet_number: '2', sheet_code: 'A-101', sheet_title: 'Floor Plan', discipline: 'A', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/a1.png', seal_detected: false, created_at: '' },
    { id: 'a2', sheet_number: '3', sheet_code: 'A-401', sheet_title: 'Enlarged Office', discipline: 'A', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/a2.png', seal_detected: false, created_at: '' },
    { id: 'p1', sheet_number: '4', sheet_code: 'P-001', sheet_title: 'Plumbing Notes', discipline: 'P', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/p1.png', seal_detected: false, created_at: '' },
    { id: 'p2', sheet_number: '5', sheet_code: 'P-101', sheet_title: 'Waste/Vent Plan', discipline: 'P', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/p2.png', seal_detected: false, created_at: '' },
    { id: 'e1', sheet_number: '6', sheet_code: 'E-001', sheet_title: 'Electrical Notes', discipline: 'E', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/e1.png', seal_detected: false, created_at: '' },
  ];

  const emptyPhasesLegacy: BlueprintStory = {
    project_id: 'p1', mean_confidence: 0.75,
    truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
    // These are the empty shells the user is hitting in production — phases
    // present but title + body_md blank because Drew's REASON hasn't filled
    // them in. The adapter must fall back to sheet grouping.
    phases: [
      { key: 'p1', title: '', body_md: '', facts: [] },
      { key: 'p2', title: '', body_md: '', facts: [] },
    ],
    updated_at: '2026-05-22T00:00:00Z',
    status: 'in_progress',
  };

  it('falls back to discipline-grouped chapters when phases have no narrative', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    expect(v2).not.toBeNull();
    expect(v2!.chapters.length).toBeGreaterThan(0);
    // Chapter count should equal distinct disciplines (G, A, P, E) = 4, NOT
    // the empty-phase count (2).
    expect(v2!.chapters.length).toBe(4);
  });

  it('orders chapters by canonical discipline order (general → arch → plumb → elec)', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    const titles = v2!.chapters.map((c) => c.title);
    expect(titles[0]).toMatch(/Getting Built/);  // G — order 1
    expect(titles[1]).toMatch(/Floor Plans/);     // A — order 2
    expect(titles[2]).toMatch(/Water & Drains/);  // P — order 4
    expect(titles[3]).toMatch(/Power, Lights/);   // E — order 6
  });

  it('every generated chapter has thumbnail, source_sheets, and what_this_is content', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    for (const c of v2!.chapters) {
      expect(c.thumbnail_url).toBeTruthy();
      expect(c.source_sheets.length).toBeGreaterThan(0);
      expect(c.zones.what_this_is.length).toBeGreaterThan(0);
    }
  });

  it('populates in_scope with one ScopeItem per source sheet', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    const plumbing = v2!.chapters.find((c) => c.title.includes('Water'));
    expect(plumbing).toBeDefined();
    expect(plumbing!.zones.in_scope).toHaveLength(2);
    expect(plumbing!.zones.in_scope[0].text_md).toContain('P-001');
    expect(plumbing!.zones.in_scope[0].text_md).toContain('Plumbing Notes');
    expect(plumbing!.zones.in_scope[1].text_md).toContain('P-101');
  });

  it('uses the first sheet of the discipline group as the chapter thumbnail', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    const plumbing = v2!.chapters.find((c) => c.title.includes('Water'));
    expect(plumbing!.thumbnail_url).toBe('https://x/p1.png');
  });

  it('handles unknown disciplines via the "Other" bucket', () => {
    const sheetsWithUnknown = [
      ...sheetsAcrossDisciplines,
      { id: 'x1', sheet_number: '7', sheet_code: 'X-1', sheet_title: 'Weird Sheet', discipline: 'XYZ', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/x1.png', seal_detected: false, created_at: '' },
    ];
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsWithUnknown);
    const other = v2!.chapters.find((c) => c.title === 'Other Sheets');
    expect(other).toBeDefined();
    expect(other!.source_sheets[0].sheet_code).toBe('X-1');
  });

  it('does NOT fall back to grouping when any phase has real narrative', () => {
    const phaseWithNarrative: BlueprintStory = {
      ...emptyPhasesLegacy,
      phases: [
        { key: 'p1', title: 'Real Phase', body_md: 'Actual narrative from Drew', facts: [] },
      ],
    };
    const v2 = adaptLegacyStoryToV2(phaseWithNarrative, sheetsAcrossDisciplines);
    // 1 phase with narrative → exactly 1 chapter (NOT 4 discipline groups)
    expect(v2!.chapters).toHaveLength(1);
    expect(v2!.chapters[0].title).toBe('Real Phase');
    expect(v2!.chapters[0].zones.what_this_is).toBe('Actual narrative from Drew');
  });

  it('returns empty chapters array when both phases are empty AND no sheets uploaded', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, []);
    expect(v2).not.toBeNull();
    expect(v2!.chapters).toEqual([]);
  });
});
