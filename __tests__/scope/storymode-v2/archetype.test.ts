import { archetypeFor } from '@/lib/scope/archetype';

describe('archetypeFor', () => {
  describe('title-driven matches (highest priority)', () => {
    it('recognizes cover sheets by title', () => {
      expect(archetypeFor('G-001', 'Cover Sheet').archetype).toBe('cover');
      expect(archetypeFor('G-001', 'Title Sheet').archetype).toBe('cover');
    });

    it('recognizes sheet index', () => {
      expect(archetypeFor('G-002', 'Sheet Index & Narrative').archetype).toBe('index');
    });

    it('recognizes life-safety plans', () => {
      expect(archetypeFor('G-101', 'Life Safety Plan').archetype).toBe('lifesafety');
      expect(archetypeFor('G-101', 'Overall Life Safety Plan').archetype).toBe('lifesafety');
    });

    it('recognizes demolition + existing-conditions sheets', () => {
      expect(archetypeFor('AD-101', 'Demolition Plan').archetype).toBe('demo');
      expect(archetypeFor('EX01', 'Existing Conditions').archetype).toBe('demo');
    });

    it('recognizes reflected ceiling plans', () => {
      expect(archetypeFor('A-402', 'Enlarged Office Reflected Ceiling Plan').archetype).toBe('rcp');
      expect(archetypeFor('A-404', 'RCP — Restroom').archetype).toBe('rcp');
    });

    it('recognizes risers, schedules, notes, sections, elevations, details', () => {
      expect(archetypeFor('P-201', 'Plumbing Riser Diagram').archetype).toBe('riser');
      expect(archetypeFor('A-600', 'Door Schedule & Details').archetype).toBe('schedule');
      expect(archetypeFor('P-001', 'Plumbing Notes').archetype).toBe('notes');
      expect(archetypeFor('A-301', 'Building Section').archetype).toBe('section');
      expect(archetypeFor('G-004', 'Front Elevation').archetype).toBe('elevation');
      expect(archetypeFor('M-301', 'Mechanical Details').archetype).toBe('detail');
    });
  });

  describe('code-driven fallback (when title is empty)', () => {
    it('uses the numeric segment to infer archetype', () => {
      expect(archetypeFor('P-001', null).archetype).toBe('notes');     // 001 → notes
      expect(archetypeFor('A-101', null).archetype).toBe('plan');      // 101 → plan
      expect(archetypeFor('P-201', null).archetype).toBe('riser');     // 201 → riser
      expect(archetypeFor('A-301', null).archetype).toBe('section');   // 301 → section
      expect(archetypeFor('A-401', null).archetype).toBe('plan');      // 401 → enlarged plan
      expect(archetypeFor('A-600', null).archetype).toBe('schedule');  // 6xx → schedule
      expect(archetypeFor('A-702', null).archetype).toBe('detail');    // 7xx → finish
    });
  });

  describe('graceful fallback', () => {
    it('returns "sheet" when both code and title are unhelpful', () => {
      expect(archetypeFor(null, null).archetype).toBe('sheet');
      expect(archetypeFor('', '').archetype).toBe('sheet');
      expect(archetypeFor('XYZ', '').archetype).toBe('sheet');
    });
  });
});
