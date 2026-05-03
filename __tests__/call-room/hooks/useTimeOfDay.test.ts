// __tests__/call-room/hooks/useTimeOfDay.test.ts
import { classifyHour, getTint } from '../../../components/call-room/hooks/useTimeOfDay';

describe('classifyHour', () => {
  it('classifies 6 as dawn', () => {
    expect(classifyHour(6)).toBe('dawn');
  });

  it('classifies 12 as day', () => {
    expect(classifyHour(12)).toBe('day');
  });

  it('classifies 18 as dusk', () => {
    expect(classifyHour(18)).toBe('dusk');
  });

  it('classifies 22 as night', () => {
    expect(classifyHour(22)).toBe('night');
  });

  it('classifies 3 as night', () => {
    expect(classifyHour(3)).toBe('night');
  });
});

describe('getTint', () => {
  it('night has the largest overlayOpacity of all states', () => {
    const night = getTint('night').overlayOpacity;
    expect(night).toBeGreaterThan(getTint('dawn').overlayOpacity);
    expect(night).toBeGreaterThan(getTint('day').overlayOpacity);
    expect(night).toBeGreaterThan(getTint('dusk').overlayOpacity);
  });

  it('day has the smallest overlayOpacity of all states', () => {
    const day = getTint('day').overlayOpacity;
    expect(day).toBeLessThan(getTint('dawn').overlayOpacity);
    expect(day).toBeLessThan(getTint('dusk').overlayOpacity);
    expect(day).toBeLessThan(getTint('night').overlayOpacity);
  });

  it('night includes a ceiling lamp config', () => {
    const lamp = getTint('night').ceilingLamp;
    expect(lamp).toBeDefined();
    expect(lamp!.color).toMatch(/^rgba\(/);
    expect(lamp!.cx).toBeGreaterThanOrEqual(0);
    expect(lamp!.cx).toBeLessThanOrEqual(100);
    expect(lamp!.radius).toBeGreaterThan(0);
  });

  it('day / dawn / dusk do NOT define a ceiling lamp', () => {
    expect(getTint('day').ceilingLamp).toBeUndefined();
    expect(getTint('dawn').ceilingLamp).toBeUndefined();
    expect(getTint('dusk').ceilingLamp).toBeUndefined();
  });
});
