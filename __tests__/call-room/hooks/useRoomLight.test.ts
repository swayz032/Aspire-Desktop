// __tests__/call-room/hooks/useRoomLight.test.ts
import { computeLight } from '../../../components/call-room/hooks/useRoomLight';

describe('computeLight', () => {
  const viewport = { width: 1000, height: 800 };

  it('returns center defaults when cursor is at viewport center', () => {
    const cursor = { x: 500, y: 400 };
    const light = computeLight(cursor, viewport);
    expect(light.x).toBeCloseTo(0, 5);
    expect(light.y).toBeCloseTo(0, 5);
    expect(light.warmth).toBeCloseTo(0.5, 5);
    expect(light.intensity).toBe(1);
  });

  it('maps cursor at right edge to x = 1', () => {
    const light = computeLight({ x: 1000, y: 400 }, viewport);
    expect(light.x).toBeCloseTo(1, 5);
  });

  it('maps cursor at left edge to x = -1', () => {
    const light = computeLight({ x: 0, y: 400 }, viewport);
    expect(light.x).toBeCloseTo(-1, 5);
  });

  it('produces high warmth (>= 0.95) at right edge', () => {
    const light = computeLight({ x: 1000, y: 400 }, viewport);
    expect(light.warmth).toBeGreaterThanOrEqual(0.95);
  });

  it('produces low but positive warmth (<= 0.25, > 0) at left edge', () => {
    const light = computeLight({ x: 0, y: 400 }, viewport);
    expect(light.warmth).toBeLessThanOrEqual(0.25);
    expect(light.warmth).toBeGreaterThan(0);
  });

  it('maps vertical cursor: top edge -> y = -1, bottom edge -> y = 1', () => {
    const top = computeLight({ x: 500, y: 0 }, viewport);
    const bottom = computeLight({ x: 500, y: 800 }, viewport);
    expect(top.y).toBeCloseTo(-1, 5);
    expect(bottom.y).toBeCloseTo(1, 5);
  });

  it('returns safe defaults when viewport.width === 0', () => {
    const light = computeLight({ x: 100, y: 100 }, { width: 0, height: 800 });
    expect(light).toEqual({ x: 0, y: 0, warmth: 0.5, intensity: 1 });
  });
});
