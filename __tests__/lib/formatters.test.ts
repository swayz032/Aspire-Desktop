/**
 * Pass C — unit tests for the Front Desk utility helpers in lib/formatters.ts.
 *
 * Covers:
 *   - hashStringToColor   — deterministic, collision-resistant
 *   - extractInitials     — first letter of first two words
 *   - extractAreaCode     — US area code extraction (E.164, 10-digit, formatted)
 */

import {
  hashStringToColor,
  extractInitials,
  extractAreaCode,
} from '@/lib/formatters';

// ---------------------------------------------------------------------------
// hashStringToColor
// ---------------------------------------------------------------------------

describe('hashStringToColor', () => {
  it('returns the same color on repeated calls with the same input', () => {
    const a = hashStringToColor('John Carter');
    const b = hashStringToColor('John Carter');
    expect(a).toBe(b);
  });

  it('returns a non-empty hex color string', () => {
    const color = hashStringToColor('Maria Lewis');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('maps 5 distinct names to at least 2 distinct colors (collision-resistant)', () => {
    const names = ['John Carter', 'Maria Lewis', 'Brighton Office Build', 'David Reed', 'Amanda Hill'];
    const colors = names.map(hashStringToColor);
    const distinct = new Set(colors);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  it('different names produce the same color only by palette coincidence — result is deterministic', () => {
    // Hash is purely deterministic: same input → same output
    expect(hashStringToColor('Alpha')).toBe(hashStringToColor('Alpha'));
    expect(hashStringToColor('Beta')).toBe(hashStringToColor('Beta'));
  });

  it('empty string returns a color from the palette (no crash)', () => {
    const color = hashStringToColor('');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('very long string returns a color from the palette (no crash)', () => {
    const color = hashStringToColor('A'.repeat(5000));
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// extractInitials
// ---------------------------------------------------------------------------

describe('extractInitials', () => {
  it('returns first two word initials in uppercase for multi-word name', () => {
    expect(extractInitials('Brighton Office Build')).toBe('BO');
  });

  it('returns single uppercase letter for a single-word name', () => {
    expect(extractInitials('Sarah')).toBe('S');
  });

  it('returns "SK" for "Sarah Klein"', () => {
    expect(extractInitials('Sarah Klein')).toBe('SK');
  });

  it('returns "DR" for "David Reed"', () => {
    expect(extractInitials('David Reed')).toBe('DR');
  });

  it('returns "?" for an empty string', () => {
    expect(extractInitials('')).toBe('?');
  });

  it('handles extra whitespace between words correctly', () => {
    // Multiple spaces should not produce empty word tokens
    expect(extractInitials('   John   Carter  ')).toBe('JC');
  });

  it('uppercases lowercase first letters', () => {
    expect(extractInitials('john carter')).toBe('JC');
  });
});

// ---------------------------------------------------------------------------
// extractAreaCode
// ---------------------------------------------------------------------------

describe('extractAreaCode', () => {
  it('extracts 617 from E.164 +1 number (+16175550188)', () => {
    expect(extractAreaCode('+16175550188')).toBe('617');
  });

  it('extracts 617 from 10-digit number (6175550188)', () => {
    expect(extractAreaCode('6175550188')).toBe('617');
  });

  it('extracts 978 from formatted number ((978) 555-0501)', () => {
    expect(extractAreaCode('(978) 555-0501')).toBe('978');
  });

  it('extracts 617 from dashed format (617-555-0188)', () => {
    expect(extractAreaCode('617-555-0188')).toBe('617');
  });

  it('returns null for a non-US international number (+442071234567)', () => {
    expect(extractAreaCode('+442071234567')).toBeNull();
  });

  it('returns null for an invalid/nonsense string', () => {
    expect(extractAreaCode('invalid')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractAreaCode('')).toBeNull();
  });

  it('returns null for a short domestic fragment (fewer than 10 digits)', () => {
    expect(extractAreaCode('617555')).toBeNull();
  });
});
