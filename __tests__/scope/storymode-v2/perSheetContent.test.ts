import { storyForSheet } from '@/lib/scope/per-sheet-content';

describe('storyForSheet', () => {
  it('produces a complete story for a plumbing plan sheet', () => {
    const s = storyForSheet('plan', 'plumbing', 'P-101', 'Waste/Vent Plan');
    expect(s.whatThisSheetShows.length).toBeGreaterThan(20);
    expect(s.whatsOnIt.length).toBeGreaterThanOrEqual(3);
    expect(s.whenToUseIt.length).toBeGreaterThan(10);
    expect(s.watchOutFor.length).toBeGreaterThanOrEqual(2);
    // Discipline-specific noun interpolation works.
    expect(s.whatThisSheetShows.toLowerCase()).toContain('plumbing');
    // Plumbing plan should have a real procurement list.
    expect(s.whatToBuy.length).toBeGreaterThanOrEqual(3);
    expect(s.whatToBuy.join(' ').toLowerCase()).toMatch(/pipe|fitting/);
  });

  it('returns an empty whatToBuy array for archetypes that do not drive procurement', () => {
    expect(storyForSheet('cover', 'general', 'G-000', '').whatToBuy).toEqual([]);
    expect(storyForSheet('index', 'general', 'G-001', '').whatToBuy).toEqual([]);
    expect(storyForSheet('legend', 'general', 'G-010', '').whatToBuy).toEqual([]);
  });

  it('produces an electrical-specific buy list for an electrical plan', () => {
    const s = storyForSheet('plan', 'electrical', 'E-101', 'Lighting Plan');
    expect(s.whatToBuy.length).toBeGreaterThanOrEqual(3);
    expect(s.whatToBuy.join(' ').toLowerCase()).toMatch(/conduit|wire|breaker/);
  });

  it('produces a sheet-specific buy list for a schedule sheet', () => {
    const s = storyForSheet('schedule', 'plumbing', 'P-002', 'Fixture Schedule');
    expect(s.whatToBuy.length).toBeGreaterThanOrEqual(3);
  });

  it('produces a complete story for a schedule sheet', () => {
    const s = storyForSheet('schedule', 'plumbing', 'P-002', 'Plumbing Schedules');
    expect(s.whatThisSheetShows.toLowerCase()).toContain('parts catalog');
    expect(s.whenToUseIt.toLowerCase()).toContain('procurement');
  });

  it('produces a complete story for an architectural RCP', () => {
    const s = storyForSheet('rcp', 'architectural', 'A-402', 'Office RCP');
    expect(s.whatThisSheetShows.toLowerCase()).toContain('ceiling');
    expect(s.whatsOnIt.some((b) => b.toLowerCase().includes('grid'))).toBe(true);
  });

  it('produces a complete story for a demolition sheet', () => {
    const s = storyForSheet('demo', 'demolition', 'AD-101', 'Demolition Plan');
    expect(s.whatThisSheetShows.toLowerCase()).toContain('demolition');
    expect(s.whenToUseIt.toLowerCase()).toContain('day 1');
  });

  it('falls back to a graceful generic story for unknown archetype', () => {
    const s = storyForSheet('sheet', 'architectural', 'XYZ', '');
    expect(s.whatThisSheetShows).toBeTruthy();
    expect(s.whatsOnIt.length).toBeGreaterThan(0);
    expect(s.whatsOnIt.length).toBeGreaterThan(0);
  });

  it('uses the sheet title in WHAT THIS SHEET SHOWS when present', () => {
    const s = storyForSheet('plan', 'electrical', 'E-101', 'Overall Lighting Plan');
    expect(s.whatThisSheetShows).toContain('Overall Lighting Plan');
  });

  it('omits parenthetical title when sheet title is empty', () => {
    const s = storyForSheet('plan', 'electrical', 'E-101', '');
    expect(s.whatThisSheetShows).not.toContain('()');
  });

  it('produces distinct stories for the same archetype across disciplines', () => {
    const plumb = storyForSheet('plan', 'plumbing', 'P-101', '');
    const elec = storyForSheet('plan', 'electrical', 'E-101', '');
    expect(plumb.whatThisSheetShows).not.toEqual(elec.whatThisSheetShows);
  });
});
