import { sheetDisplayName, disciplineFromCode } from '@/lib/scope/sheet-naming';

describe('disciplineFromCode', () => {
  it.each([
    ['A-301', 'architectural'],
    ['AD-101', 'demolition'],
    ['S-201', 'structural'],
    ['C-101', 'civil'],
    ['P-101', 'plumbing'],
    ['M-301', 'mechanical'],
    ['E-101', 'electrical'],
    ['FP-101', 'fire'],
    ['G-001', 'general'],
    ['PT-1', 'partition'],
    ['SC-1', 'finish'],
    ['', 'unknown'],
    ['27', 'unknown'],
  ])('maps %s to %s', (code, expected) => {
    expect(disciplineFromCode(code)).toBe(expected);
  });
});

describe('sheetDisplayName', () => {
  it('never returns a bare "Notes" secondary label', () => {
    // The cases from the user-flagged screenshot.
    const a301 = sheetDisplayName('A-301', 'A');
    const a600 = sheetDisplayName('A-600', 'A');
    const one = sheetDisplayName('1', 'Addenda');
    const pt1 = sheetDisplayName('PT-1', 'Addenda');
    const sc1 = sheetDisplayName('SC-1', 'Schedules');
    const twentySeven = sheetDisplayName('27', '');

    for (const s of [a301, a600, one, pt1, sc1, twentySeven]) {
      expect(s.secondary.toLowerCase()).not.toBe('notes');
      expect(s.secondary.length).toBeGreaterThan(3);
    }
  });

  it('promotes single-letter title "A" into purpose-specific label', () => {
    const s = sheetDisplayName('A-301', 'A');
    expect(s.primary).toBe('A-301');
    expect(s.secondary).toBe('Wall Section');
  });

  it('treats plain-digit codes as Sheet N or Addendum N', () => {
    expect(sheetDisplayName('27', '').primary).toBe('Sheet 27');
    expect(sheetDisplayName('1', 'Addenda').primary).toBe('Addendum 1');
  });

  it('uses the real title when it is genuinely useful', () => {
    const s = sheetDisplayName('A-403', 'Restroom Plan');
    expect(s.primary).toBe('A-403');
    expect(s.secondary).toBe('Restroom Plan');
  });

  it('maps PT-N without useful title to Partition Schedule', () => {
    const s = sheetDisplayName('PT-1', 'Addenda');
    expect(s.secondary).toBe('Partition Schedule');
  });

  it('maps SC-N to Finish Schedule when title is just "Schedules"', () => {
    const s = sheetDisplayName('SC-1', 'Schedules');
    expect(s.secondary).toBe('Finish Schedule');
  });

  it('maps plain digit + Addenda title to Project Updates', () => {
    const s = sheetDisplayName('1', 'Addenda');
    expect(s.secondary).toBe('Project Updates');
  });

  it('detects Door Schedule from title regardless of code', () => {
    expect(sheetDisplayName('A-600', 'Door Schedule').secondary).toBe('Door Schedule');
  });

  it('detects Ceiling Plan from RCP archetype', () => {
    expect(sheetDisplayName('A-402', 'Office RCP').secondary).toBe('Ceiling Plan');
  });

  it('maps plumbing notes prefix to discipline-specific notes', () => {
    expect(sheetDisplayName('P-001', '').secondary).toBe('Plumbing Notes');
  });

  it('maps electrical notes prefix to Electrical Notes', () => {
    expect(sheetDisplayName('E-001', '').secondary).toBe('Electrical Notes');
  });

  it('maps fire protection prefix to Fire Safety Notes', () => {
    expect(sheetDisplayName('FP-001', '').secondary).toBe('Fire Safety Notes');
  });

  it('maps demolition prefix to Demo Plan', () => {
    expect(sheetDisplayName('AD-101', '').secondary).toBe('Demo Plan');
  });

  it('produces "General Notes" for bare digit + empty title (inferred general)', () => {
    expect(sheetDisplayName('27', '').secondary).toBe('General Notes');
  });

  it('handles null and undefined input gracefully', () => {
    const a = sheetDisplayName(null, null);
    const b = sheetDisplayName(undefined, undefined);
    expect(a.primary).toBeDefined();
    expect(a.secondary).toBeDefined();
    expect(b.primary).toBeDefined();
    expect(b.secondary).toBeDefined();
  });

  it('does not produce identical labels for the same archetype across disciplines', () => {
    const plumb = sheetDisplayName('P-101', '');
    const elec = sheetDisplayName('E-101', '');
    expect(plumb.secondary).not.toBe(elec.secondary);
  });
});
