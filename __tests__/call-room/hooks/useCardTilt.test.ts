// __tests__/call-room/hooks/useCardTilt.test.ts
import {
  computeTilt,
  TILT_AMPLITUDE,
} from '../../../components/call-room/hooks/useCardTilt';

describe('computeTilt', () => {
  const viewport = { width: 1000, height: 800 };

  it('returns zero tilt at viewport center', () => {
    const t = computeTilt({ x: 500, y: 400 }, viewport, 2);
    expect(t.rotateX).toBeCloseTo(0, 5);
    expect(t.rotateY).toBeCloseTo(0, 5);
  });

  it('returns rotateY === maxDeg at right edge', () => {
    const t = computeTilt({ x: 1000, y: 400 }, viewport, 2);
    expect(t.rotateY).toBeCloseTo(2, 5);
  });

  it('returns rotateY === -maxDeg at left edge', () => {
    const t = computeTilt({ x: 0, y: 400 }, viewport, 2);
    expect(t.rotateY).toBeCloseTo(-2, 5);
  });

  it('returns rotateX === -maxDeg at top edge', () => {
    const t = computeTilt({ x: 500, y: 0 }, viewport, 2);
    expect(t.rotateX).toBeCloseTo(-2, 5);
  });

  it('returns rotateX === +maxDeg at bottom edge', () => {
    const t = computeTilt({ x: 500, y: 800 }, viewport, 2);
    expect(t.rotateX).toBeCloseTo(2, 5);
  });

  it('respects custom maxDeg parameter', () => {
    const t = computeTilt({ x: 1000, y: 800 }, viewport, 4);
    expect(t.rotateY).toBeCloseTo(4, 5);
    expect(t.rotateX).toBeCloseTo(4, 5);
  });

  it('returns zero tilt when viewport.width === 0', () => {
    const t = computeTilt({ x: 100, y: 100 }, { width: 0, height: 800 }, 2);
    expect(t.rotateX).toBe(0);
    expect(t.rotateY).toBe(0);
  });

  it('returns zero tilt when viewport.height === 0', () => {
    const t = computeTilt({ x: 100, y: 100 }, { width: 1000, height: 0 }, 2);
    expect(t.rotateX).toBe(0);
    expect(t.rotateY).toBe(0);
  });

  describe('TILT_AMPLITUDE — agency-grade defaults (canary feedback 2026-05)', () => {
    it('exposes a desktop amplitude well above the legacy ±2°', () => {
      // Canary tester: "it barely moves especially on safari". The legacy
      // default of 2° was the root cause; we boosted to 14° for pointer-
      // precise surfaces. Lock that in so a future refactor doesn't
      // silently revert to "barely moves".
      expect(TILT_AMPLITUDE.desktop).toBeGreaterThanOrEqual(12);
      expect(TILT_AMPLITUDE.laptop).toBeGreaterThanOrEqual(12);
    });

    it('uses a softer tablet amplitude than desktop', () => {
      // Touch surfaces shouldn't wobble as hard — phone-style tilt feels
      // nausea-inducing past ~10°.
      expect(TILT_AMPLITUDE.tablet).toBeLessThan(TILT_AMPLITUDE.desktop);
      expect(TILT_AMPLITUDE.tablet).toBeGreaterThan(0);
    });

    it('reduced-motion amplitude is exactly zero', () => {
      // prefers-reduced-motion: reduce -> static card, no rotation.
      expect(TILT_AMPLITUDE.reducedMotion).toBe(0);
    });

    it('honors the desktop amplitude at full edge deflection', () => {
      const t = computeTilt(
        { x: 1000, y: 800 },
        { width: 1000, height: 800 },
        TILT_AMPLITUDE.desktop,
      );
      expect(t.rotateX).toBeCloseTo(TILT_AMPLITUDE.desktop, 5);
      expect(t.rotateY).toBeCloseTo(TILT_AMPLITUDE.desktop, 5);
    });

    it('returns zero tilt when amplitude is the reduced-motion value', () => {
      const t = computeTilt(
        { x: 1000, y: 800 },
        { width: 1000, height: 800 },
        TILT_AMPLITUDE.reducedMotion,
      );
      expect(t.rotateX).toBe(0);
      expect(t.rotateY).toBe(0);
    });
  });
});
