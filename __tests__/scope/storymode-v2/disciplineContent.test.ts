import { contentForChapter, DISCIPLINE_CONTENT, FALLBACK_CONTENT } from '@/lib/scope/discipline-content';

describe('discipline-content library', () => {
  it('returns the right shape for each known chapter key', () => {
    const keys = ['general', 'demolition', 'architectural', 'structural', 'plumbing', 'mechanical', 'electrical', 'fire', 'civil'];
    for (const k of keys) {
      const c = contentForChapter(k);
      expect(c.scopeItems.length).toBeGreaterThanOrEqual(3);
      expect(c.commonMistakes.length).toBeGreaterThanOrEqual(2);
      expect(c.orderOfOps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back to FALLBACK_CONTENT for unknown keys', () => {
    expect(contentForChapter('nonsense')).toBe(FALLBACK_CONTENT);
  });

  it('every scopeItem reads like a noun phrase, not a sheet reference', () => {
    // Regression guard against the old "A — per **A-301**" pattern.
    for (const [, content] of Object.entries(DISCIPLINE_CONTENT)) {
      for (const item of content.scopeItems) {
        expect(item).not.toMatch(/^\*\*[A-Z]{1,3}-\d+\*\*/);
        expect(item).not.toMatch(/^per \*\*/);
      }
    }
  });
});
