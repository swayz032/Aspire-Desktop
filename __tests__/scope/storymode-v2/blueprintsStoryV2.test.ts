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

  it('folds unknown disciplines into General — no separate "Other Sheets" card', () => {
    const sheetsWithUnknown = [
      ...sheetsAcrossDisciplines,
      { id: 'x1', sheet_number: '7', sheet_code: 'X-1', sheet_title: 'Weird Sheet', discipline: 'XYZ', scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/x1.png', seal_detected: false, created_at: '' },
    ];
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsWithUnknown);
    expect(v2!.chapters.find((c) => c.title === 'Other Sheets')).toBeUndefined();
    const general = v2!.chapters.find((c) => c.title.includes('Getting Built'));
    expect(general).toBeDefined();
    // The unknown sheet lands in General alongside the G-sheet.
    const generalSheetCodes = general!.source_sheets.map((s) => s.sheet_code);
    expect(generalSheetCodes).toContain('X-1');
    expect(generalSheetCodes).toContain('G-001');
  });

  it('populates per-discipline TASKS so the left pane is never empty', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    const plumbing = v2!.chapters.find((c) => c.title.includes('Water'));
    expect(plumbing!.zones.tasks.length).toBeGreaterThan(0);
    expect(plumbing!.zones.tasks[0].discipline).toBe('plumb');
    expect(plumbing!.zones.tasks[0].evidence_sheets).toEqual(expect.arrayContaining(['P-001', 'P-101']));
    const electrical = v2!.chapters.find((c) => c.title.includes('Power'));
    expect(electrical!.zones.tasks[0].discipline).toBe('elec');
  });

  it('paraphrases in_scope items from sheet titles (no raw "**A-101** — Floor Plan" dump)', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesLegacy, sheetsAcrossDisciplines);
    const plumbing = v2!.chapters.find((c) => c.title.includes('Water'));
    // Leads with the title content (capitalized), references the sheet via "per **CODE**".
    expect(plumbing!.zones.in_scope[0].text_md).toMatch(/^Plumbing Notes\s+—\s+per \*\*P-001\*\*/);
    expect(plumbing!.zones.in_scope[1].text_md).toMatch(/^Waste\/Vent Plan\s+—\s+per \*\*P-101\*\*/);
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

describe('blueprintsStoryV2 adapter — universal sheet-code taxonomy', () => {
  // Realistic AIA-style sheet set covering every prefix the discipline map
  // must handle. Each sheet has discipline = null to prove the adapter
  // infers from the code prefix alone.
  const aiaUniversalSheets = [
    { id: 'cover', sheet_number: '1', sheet_code: null, sheet_title: 'Cover Sheet', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/cover.png', seal_detected: false, created_at: '' },
    { id: 'g1', sheet_number: '2', sheet_code: 'G-001', sheet_title: 'Sheet Index', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/g1.png', seal_detected: false, created_at: '' },
    { id: 'ex1', sheet_number: '3', sheet_code: 'EX01', sheet_title: 'Existing Conditions', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/ex.png', seal_detected: false, created_at: '' },
    { id: 'ad1', sheet_number: '4', sheet_code: 'AD-101', sheet_title: 'Demolition Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/ad.png', seal_detected: false, created_at: '' },
    { id: 'a1', sheet_number: '5', sheet_code: 'A-101', sheet_title: 'Floor Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/a.png', seal_detected: false, created_at: '' },
    { id: 's1', sheet_number: '6', sheet_code: 'S-100', sheet_title: 'Foundation Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/s.png', seal_detected: false, created_at: '' },
    { id: 'p1', sheet_number: '7', sheet_code: 'P-001', sheet_title: 'Plumbing Notes', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/p.png', seal_detected: false, created_at: '' },
    { id: 'm1', sheet_number: '8', sheet_code: 'M-101', sheet_title: 'Mechanical Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/m.png', seal_detected: false, created_at: '' },
    { id: 'e1', sheet_number: '9', sheet_code: 'E-101', sheet_title: 'Lighting Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/e.png', seal_detected: false, created_at: '' },
    { id: 't1', sheet_number: '10', sheet_code: 'T-101', sheet_title: 'Telecom Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/t.png', seal_detected: false, created_at: '' },
    { id: 'fp1', sheet_number: '11', sheet_code: 'FP-101', sheet_title: 'Sprinkler Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/fp.png', seal_detected: false, created_at: '' },
    { id: 'c1', sheet_number: '12', sheet_code: 'C-100', sheet_title: 'Site Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/c.png', seal_detected: false, created_at: '' },
    { id: 'l1', sheet_number: '13', sheet_code: 'L-101', sheet_title: 'Landscape Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/l.png', seal_detected: false, created_at: '' },
  ];

  const emptyPhasesNullDisciplines: BlueprintStory = {
    project_id: 'p1', mean_confidence: 0.5,
    truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
    phases: [{ key: 'a', title: '', body_md: '', facts: [] }],
    updated_at: '2026-05-22T00:00:00Z',
    status: 'in_progress',
  };

  it('infers discipline from sheet code prefix when discipline field is null', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, aiaUniversalSheets);
    expect(v2).not.toBeNull();
    const titles = v2!.chapters.map((c) => c.title);
    expect(titles).toEqual([
      "What's Getting Built",
      "What We're Tearing Out",
      'Floor Plans & Architecture',
      'How It Stands Up',
      'Water & Drains',
      'Heating, Cooling & Air',
      'Power, Lights & Cameras',
      'Fire Safety',
      'Outside the Building',
    ]);
  });

  it('groups AD-xxx demolition + EX existing-conditions sheets into one Demolition chapter', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, aiaUniversalSheets);
    const demo = v2!.chapters.find((c) => c.title === "What We're Tearing Out");
    expect(demo).toBeDefined();
    const codes = demo!.source_sheets.map((s) => s.sheet_code);
    expect(codes).toContain('EX01');
    expect(codes).toContain('AD-101');
  });

  it('folds T-xxx telecom sheets into the Electrical chapter', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, aiaUniversalSheets);
    const elec = v2!.chapters.find((c) => c.title === 'Power, Lights & Cameras');
    const codes = elec!.source_sheets.map((s) => s.sheet_code);
    expect(codes).toContain('E-101');
    expect(codes).toContain('T-101');
  });

  it('folds L-xxx landscape sheets into the Civil chapter', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, aiaUniversalSheets);
    const civil = v2!.chapters.find((c) => c.title === 'Outside the Building');
    const codes = civil!.source_sheets.map((s) => s.sheet_code);
    expect(codes).toContain('C-100');
    expect(codes).toContain('L-101');
  });

  it('never produces an "Other Sheets" chapter regardless of input shape', () => {
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, aiaUniversalSheets);
    expect(v2!.chapters.every((c) => c.title !== 'Other Sheets')).toBe(true);
  });

  it('handles pure-numeric sheet codes by folding into General (no crash, no Other)', () => {
    const sheetsWithJunkCodes = [
      { id: 'a1', sheet_number: '1', sheet_code: '3', sheet_title: 'Mystery Page', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/3.png', seal_detected: false, created_at: '' },
      { id: 'a2', sheet_number: '2', sheet_code: 'A-101', sheet_title: 'Floor Plan', discipline: null, scale: null, revision: 0, supersedes_id: null, thumbnail_url: 'https://x/a.png', seal_detected: false, created_at: '' },
    ];
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, sheetsWithJunkCodes);
    const titles = v2!.chapters.map((c) => c.title);
    expect(titles).toEqual(["What's Getting Built", 'Floor Plans & Architecture']);
    expect(titles).not.toContain('Other Sheets');
  });

  it('backend discipline tag takes precedence over the code prefix', () => {
    const conflicted = [
      { id: 'x', sheet_number: '1', sheet_code: 'FP-101', sheet_title: 'Mislabeled', discipline: 'architectural', scale: null, revision: 0, supersedes_id: null, thumbnail_url: null, seal_detected: false, created_at: '' },
    ];
    const v2 = adaptLegacyStoryToV2(emptyPhasesNullDisciplines, conflicted);
    expect(v2!.chapters).toHaveLength(1);
    expect(v2!.chapters[0].title).toBe('Floor Plans & Architecture');
  });
});
