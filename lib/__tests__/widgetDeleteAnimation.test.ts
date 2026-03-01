/**
 * widgetDeleteAnimation.test.ts -- Unit tests for Widget Delete Animation (Wave 19)
 *
 * Tests cover:
 * - 4-phase choreography timing
 * - Reduced motion instant removal
 * - Animation target value changes
 * - Cleanup callback execution
 * - Reset function
 */

import {
  animateWidgetDelete,
  resetWidgetAnimation,
  PHASE_1_DURATION,
  PHASE_2_DURATION,
  PHASE_3_DURATION,
  TOTAL_DURATION,
} from '../widgetDeleteAnimation';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock react-native-reanimated
const mockWithSpring = jest.fn((toValue: number, _config?: unknown) => toValue);
const mockWithTiming = jest.fn((toValue: number, _config?: unknown) => toValue);
const mockWithSequence = jest.fn((...args: number[]) => args[args.length - 1]);
const mockWithDelay = jest.fn((_delay: number, animation: number) => animation);
const mockRunOnJS = jest.fn((fn: Function) => fn);

jest.mock('react-native-reanimated', () => ({
  withSpring: (toValue: number, config?: unknown) => mockWithSpring(toValue, config),
  withTiming: (toValue: number, config?: unknown) => mockWithTiming(toValue, config),
  withSequence: (...args: number[]) => mockWithSequence(...args),
  withDelay: (delay: number, animation: number) => mockWithDelay(delay, animation),
  runOnJS: (fn: Function) => {
    mockRunOnJS(fn);
    return fn;
  },
  Easing: {
    in: jest.fn((easing: Function) => easing),
    out: jest.fn((easing: Function) => easing),
    inOut: jest.fn((easing: Function) => easing),
    quad: jest.fn((t: number) => t * t),
    cubic: jest.fn((t: number) => t * t * t),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTargets() {
  return {
    scale: { value: 1 },
    opacity: { value: 1 },
    rotation: { value: 0 },
    translateY: { value: 0 },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests: Timing Constants
// ---------------------------------------------------------------------------

describe('timing constants', () => {
  it('total duration equals sum of phases', () => {
    expect(TOTAL_DURATION).toBe(PHASE_1_DURATION + PHASE_2_DURATION + PHASE_3_DURATION);
  });

  it('each phase is 100ms', () => {
    expect(PHASE_1_DURATION).toBe(100);
    expect(PHASE_2_DURATION).toBe(100);
    expect(PHASE_3_DURATION).toBe(100);
  });

  it('total duration is 300ms', () => {
    expect(TOTAL_DURATION).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Tests: Standard Animation
// ---------------------------------------------------------------------------

describe('animateWidgetDelete (standard)', () => {
  it('calls withSpring for Phase 1 scale', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    // Phase 1: scale should be animated (withSpring called)
    expect(mockWithSpring).toHaveBeenCalled();
  });

  it('calls withTiming for Phase 1 opacity', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    expect(mockWithTiming).toHaveBeenCalled();
  });

  it('calls withSequence for Phase 1 rotation shake', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    // Rotation uses withSequence for shake effect
    expect(mockWithSequence).toHaveBeenCalled();
  });

  it('calls withDelay for Phase 2 animations', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    // withDelay should be called with PHASE_1_DURATION offset
    expect(mockWithDelay).toHaveBeenCalledWith(
      PHASE_1_DURATION,
      expect.anything(),
    );
  });

  it('calls withDelay for Phase 3 animations', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    // withDelay should be called with PHASE_1 + PHASE_2 offset
    expect(mockWithDelay).toHaveBeenCalledWith(
      PHASE_1_DURATION + PHASE_2_DURATION,
      expect.anything(),
    );
  });

  it('calls onComplete after total duration + buffer', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    // Not called yet
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past total duration + 50ms buffer
    jest.advanceTimersByTime(TOTAL_DURATION + 50);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete before total duration', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, { onComplete });

    jest.advanceTimersByTime(TOTAL_DURATION - 10);

    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Reduced Motion
// ---------------------------------------------------------------------------

describe('animateWidgetDelete (reduced motion)', () => {
  it('instantly sets scale to 0', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    expect(targets.scale.value).toBe(0);
  });

  it('instantly sets opacity to 0', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    expect(targets.opacity.value).toBe(0);
  });

  it('resets rotation to 0', () => {
    const targets = createMockTargets();
    targets.rotation.value = 5; // Pre-existing rotation
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    expect(targets.rotation.value).toBe(0);
  });

  it('resets translateY to 0', () => {
    const targets = createMockTargets();
    targets.translateY.value = 10;
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    expect(targets.translateY.value).toBe(0);
  });

  it('calls onComplete immediately via runOnJS', () => {
    const targets = createMockTargets();
    const onComplete = jest.fn();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete,
    });

    expect(mockRunOnJS).toHaveBeenCalledWith(onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call withSpring or withTiming', () => {
    mockWithSpring.mockClear();
    mockWithTiming.mockClear();

    const targets = createMockTargets();

    animateWidgetDelete(targets as any, {
      reducedMotion: true,
      onComplete: jest.fn(),
    });

    expect(mockWithSpring).not.toHaveBeenCalled();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Reset Animation
// ---------------------------------------------------------------------------

describe('resetWidgetAnimation', () => {
  it('resets scale with spring', () => {
    const targets = createMockTargets();
    targets.scale.value = 0;

    resetWidgetAnimation(targets as any);

    expect(mockWithSpring).toHaveBeenCalledWith(1, expect.objectContaining({
      damping: 20,
      stiffness: 300,
    }));
  });

  it('resets opacity with timing', () => {
    const targets = createMockTargets();
    targets.opacity.value = 0;

    resetWidgetAnimation(targets as any);

    expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({
      duration: 200,
    }));
  });

  it('resets rotation with spring', () => {
    const targets = createMockTargets();
    targets.rotation.value = -8;

    resetWidgetAnimation(targets as any);

    expect(mockWithSpring).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it('resets translateY with spring', () => {
    const targets = createMockTargets();
    targets.translateY.value = 24;

    resetWidgetAnimation(targets as any);

    expect(mockWithSpring).toHaveBeenCalledWith(0, expect.any(Object));
  });
});
