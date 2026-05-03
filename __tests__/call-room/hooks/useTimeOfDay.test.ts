// __tests__/call-room/hooks/useTimeOfDay.test.ts
import { classifyHour } from '../../../components/call-room/hooks/useTimeOfDay';

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

  it('classifies 7 as day (boundary)', () => {
    expect(classifyHour(7)).toBe('day');
  });

  it('classifies 17 as dusk (boundary)', () => {
    expect(classifyHour(17)).toBe('dusk');
  });
});
