// __tests__/call-room/hooks/useCardTilt.test.ts
import { computeTilt } from '../../../components/call-room/hooks/useCardTilt';

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
});
