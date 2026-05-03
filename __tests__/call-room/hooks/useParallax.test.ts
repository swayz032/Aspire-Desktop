// __tests__/call-room/hooks/useParallax.test.ts
import { computeLayerOffset } from '../../../components/call-room/hooks/useParallax';

describe('computeLayerOffset', () => {
  const viewport = { width: 1000, height: 800 };

  it('returns { 0, 0 } when cursor is at viewport center', () => {
    const cursor = { x: 500, y: 400 };
    expect(computeLayerOffset(cursor, viewport, 20, 1)).toEqual({ x: 0, y: 0 });
  });

  it('returns { -range, -range } * intensity at top-left corner', () => {
    const cursor = { x: 0, y: 0 };
    expect(computeLayerOffset(cursor, viewport, 20, 1)).toEqual({ x: -20, y: -20 });
  });

  it('returns { +range, +range } * intensity at bottom-right corner', () => {
    const cursor = { x: 1000, y: 800 };
    expect(computeLayerOffset(cursor, viewport, 20, 1)).toEqual({ x: 20, y: 20 });
  });

  it('returns { 0, 0 } regardless of cursor when intensity is 0', () => {
    expect(computeLayerOffset({ x: 0, y: 0 }, viewport, 20, 0)).toEqual({ x: 0, y: 0 });
    expect(computeLayerOffset({ x: 1000, y: 800 }, viewport, 20, 0)).toEqual({ x: 0, y: 0 });
    expect(computeLayerOffset({ x: 250, y: 200 }, viewport, 20, 0)).toEqual({ x: 0, y: 0 });
  });

  it('doubles offset when intensity is 2 vs intensity 1', () => {
    const cursor = { x: 250, y: 200 }; // quarter from top-left
    const single = computeLayerOffset(cursor, viewport, 20, 1);
    const doubled = computeLayerOffset(cursor, viewport, 20, 2);
    expect(doubled.x).toBeCloseTo(single.x * 2);
    expect(doubled.y).toBeCloseTo(single.y * 2);
  });

  it('returns { 0, 0 } when parallaxRange is 0 (background layer)', () => {
    expect(computeLayerOffset({ x: 0, y: 0 }, viewport, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(computeLayerOffset({ x: 1000, y: 800 }, viewport, 0, 2)).toEqual({ x: 0, y: 0 });
  });

  it('returns { 0, 0 } when viewport.width is 0 (no divide by zero)', () => {
    expect(
      computeLayerOffset({ x: 100, y: 100 }, { width: 0, height: 800 }, 20, 1),
    ).toEqual({ x: 0, y: 0 });
    expect(
      computeLayerOffset({ x: 100, y: 100 }, { width: 1000, height: 0 }, 20, 1),
    ).toEqual({ x: 0, y: 0 });
  });
});
