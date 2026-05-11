/**
 * Tests for tablet-layout classification — exercises the pure
 * `classifyTabletLayout(width, height)` function, which is what the
 * `useTabletLayout()` hook delegates to. Testing the pure function avoids
 * RN/RNTL/jest-expo plumbing and is what the hook actually does internally.
 */
import { classifyTabletLayout } from '@/lib/useDesktop';

describe('classifyTabletLayout (used by useTabletLayout)', () => {
  it('800x1280 -> tabletPortrait + portrait orientation', () => {
    const r = classifyTabletLayout(800, 1280);
    expect(r.isTabletPortrait).toBe(true);
    expect(r.isTabletLandscape).toBe(false);
    expect(r.isTabletAny).toBe(true);
    expect(r.orientation).toBe('portrait');
    expect(r.width).toBe(800);
    expect(r.height).toBe(1280);
  });

  it('1024x1366 -> tabletLandscape band + portrait orientation (iPad Pro portrait)', () => {
    const r = classifyTabletLayout(1024, 1366);
    expect(r.isTabletPortrait).toBe(false);
    expect(r.isTabletLandscape).toBe(true);
    expect(r.isTabletAny).toBe(true);
    expect(r.orientation).toBe('portrait');
  });

  it('1280x800 -> NOT tablet (>=desktop floor) + landscape orientation', () => {
    const r = classifyTabletLayout(1280, 800);
    expect(r.isTabletPortrait).toBe(false);
    expect(r.isTabletLandscape).toBe(false);
    expect(r.isTabletAny).toBe(false);
    expect(r.orientation).toBe('landscape');
  });

  it('1366x1024 -> above-tablet-band + landscape orientation', () => {
    const r = classifyTabletLayout(1366, 1024);
    expect(r.isTabletAny).toBe(false);
    expect(r.orientation).toBe('landscape');
  });

  it('600x900 -> below tablet bands + portrait orientation', () => {
    const r = classifyTabletLayout(600, 900);
    expect(r.isTabletPortrait).toBe(false);
    expect(r.isTabletLandscape).toBe(false);
    expect(r.isTabletAny).toBe(false);
    expect(r.orientation).toBe('portrait');
  });

  it('boundary: width === height treated as landscape (square is non-portrait)', () => {
    const r = classifyTabletLayout(900, 900);
    expect(r.orientation).toBe('landscape');
  });
});
