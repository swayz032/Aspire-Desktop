/**
 * Tests for the construction glossary + SmartText parser. Pure-function
 * tests — no React rendering involved.
 */
import { GLOSSARY, parseTextWithMatches } from '@/lib/scope/glossary';

describe('glossary parser', () => {
  it('returns a single plain segment when the text has no matches', () => {
    const out = parseTextWithMatches('Just regular sentence with no jargon.');
    expect(out).toEqual([{ kind: 'plain', text: 'Just regular sentence with no jargon.' }]);
  });

  it('returns an empty array on empty input', () => {
    expect(parseTextWithMatches('')).toEqual([]);
  });

  it('extracts a single glossary abbreviation', () => {
    const out = parseTextWithMatches('Mount the EWC at 36 in AFF.');
    const kinds = out.map((s) => s.kind);
    expect(kinds).toContain('glossary');
    const ewc = out.find((s) => s.text === 'EWC');
    expect(ewc?.meta).toBe(GLOSSARY['EWC']);
    const aff = out.find((s) => s.text === 'AFF');
    expect(aff?.meta).toBe(GLOSSARY['AFF']);
  });

  it('respects word boundaries — does NOT match mid-word', () => {
    // "EWClicker" contains "EWC" but should NOT match (no word boundary).
    const out = parseTextWithMatches('EWClicker is not a real word.');
    expect(out.find((s) => s.kind === 'glossary')).toBeUndefined();
  });

  it('handles dotted abbreviations like V.T.R. correctly', () => {
    const out = parseTextWithMatches('Run a 3" V.T.R. above the roofline.');
    const vtr = out.find((s) => s.text === 'V.T.R.');
    expect(vtr?.kind).toBe('glossary');
    expect(vtr?.meta).toBe('Vent Through Roof');
  });

  it('extracts sheet codes with a known prefix', () => {
    const out = parseTextWithMatches('See A-101 for partition locations.');
    const sheet = out.find((s) => s.text === 'A-101');
    expect(sheet?.kind).toBe('sheet');
    expect(sheet?.meta).toBe('A-101');
  });

  it('extracts multiple sheet codes in one sentence', () => {
    const out = parseTextWithMatches('Per A-101 and P-103, coordinate the rough-in.');
    const sheets = out.filter((s) => s.kind === 'sheet').map((s) => s.text);
    expect(sheets).toEqual(['A-101', 'P-103']);
  });

  it('rejects sheet-code-looking text with an unknown prefix', () => {
    // "XY-100" is not a known discipline prefix → stays plain.
    const out = parseTextWithMatches('Item XY-100 is generic.');
    expect(out.find((s) => s.kind === 'sheet')).toBeUndefined();
  });

  it('mixes glossary + sheet codes in the same text', () => {
    const out = parseTextWithMatches('Install the EWC per A-101 at 36 in AFF.');
    const glossary = out.filter((s) => s.kind === 'glossary').map((s) => s.text);
    const sheets = out.filter((s) => s.kind === 'sheet').map((s) => s.text);
    expect(glossary).toEqual(expect.arrayContaining(['EWC', 'AFF']));
    expect(sheets).toEqual(['A-101']);
  });

  it('collapses adjacent plain segments', () => {
    const out = parseTextWithMatches('Plain only sentence.');
    expect(out.length).toBe(1);
  });

  it('matches FP-101 as a sheet code (3-letter prefix)', () => {
    const out = parseTextWithMatches('Update FP-101 sprinkler layout.');
    expect(out.find((s) => s.text === 'FP-101')?.kind).toBe('sheet');
  });

  it('matches AD-101 as a sheet code (demolition prefix)', () => {
    const out = parseTextWithMatches('Demo per AD-101 before any new work.');
    expect(out.find((s) => s.text === 'AD-101')?.kind).toBe('sheet');
  });
});
