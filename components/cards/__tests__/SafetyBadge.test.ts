/**
 * SafetyBadge.test.ts -- Unit tests for tier derivation and glow color mapping.
 */

import { deriveTier, tierToGlowColor, type SafetyTier } from '../SafetyBadge';

describe('deriveTier', () => {
  it('returns recommended for score >= 7.5', () => {
    expect(deriveTier(7.5)).toBe('recommended');
    expect(deriveTier(9.2)).toBe('recommended');
    expect(deriveTier(10)).toBe('recommended');
  });

  it('returns caution for score 3.5-7.4', () => {
    expect(deriveTier(3.5)).toBe('caution');
    expect(deriveTier(5.0)).toBe('caution');
    expect(deriveTier(7.4)).toBe('caution');
  });

  it('returns not_recommended for score < 3.5', () => {
    expect(deriveTier(3.4)).toBe('not_recommended');
    expect(deriveTier(0)).toBe('not_recommended');
    expect(deriveTier(1.2)).toBe('not_recommended');
  });

  it('handles boundary at 7.5 exactly', () => {
    expect(deriveTier(7.5)).toBe('recommended');
    expect(deriveTier(7.49)).toBe('caution');
  });

  it('handles boundary at 3.5 exactly', () => {
    expect(deriveTier(3.5)).toBe('caution');
    expect(deriveTier(3.49)).toBe('not_recommended');
  });
});

describe('tierToGlowColor', () => {
  it('maps recommended to green', () => {
    expect(tierToGlowColor('recommended')).toBe('#10B981');
  });

  it('maps caution to amber', () => {
    expect(tierToGlowColor('caution')).toBe('#F59E0B');
  });

  it('maps not_recommended to red', () => {
    expect(tierToGlowColor('not_recommended')).toBe('#EF4444');
  });
});
