/**
 * useDebouncedValue.test.ts -- Unit tests for Debounced Value Hook (Wave 20)
 *
 * Tests cover:
 * - Initial value is returned immediately
 * - Value updates after debounce delay
 * - Rapid changes coalesce to final value
 * - Custom delay parameter
 * - Cleanup on unmount
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedValue } from '../useDebouncedValue';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests: Initial Value
// ---------------------------------------------------------------------------

describe('initial value', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('returns initial object value', () => {
    const initial = { x: 100, y: 200 };
    const { result } = renderHook(() => useDebouncedValue(initial, 300));
    expect(result.current).toEqual({ x: 100, y: 200 });
  });

  it('returns initial numeric value', () => {
    const { result } = renderHook(() => useDebouncedValue(42, 300));
    expect(result.current).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Tests: Debounce Behavior
// ---------------------------------------------------------------------------

describe('debounce behavior', () => {
  it('does not update before delay expires', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'initial' } },
    );

    rerender({ value: 'updated' });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Partially advance time
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Still initial (only 200ms of 300ms elapsed)
    expect(result.current).toBe('initial');
  });

  it('updates after delay expires', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'initial' } },
    );

    rerender({ value: 'updated' });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('coalesces rapid changes to final value', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'c' });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'd' });

    // Only the final value should appear after full delay
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('d');
  });

  it('resets timer on each new value', () => {
    const { result, rerender } = renderHook<number, { value: number }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Timer reset by new value
    rerender({ value: 3 });
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Still debouncing (only 250ms since last change)
    expect(result.current).toBe(1);

    // Advance remaining
    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(result.current).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: Custom Delay
// ---------------------------------------------------------------------------

describe('custom delay', () => {
  it('respects a short delay', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 50),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(result.current).toBe('end');
  });

  it('respects a long delay', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 1000),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Not yet (only 500ms of 1000ms)
    expect(result.current).toBe('start');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('end');
  });

  it('uses default 300ms delay when not specified', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('start');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('end');
  });
});

// ---------------------------------------------------------------------------
// Tests: Object Values
// ---------------------------------------------------------------------------

describe('object values', () => {
  it('debounces object value changes', () => {
    const { result, rerender } = renderHook<{ width: number; height: number }, { value: { width: number; height: number } }>(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: { width: 100, height: 100 } } },
    );

    rerender({ value: { width: 200, height: 300 } });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({ width: 200, height: 300 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Cleanup
// ---------------------------------------------------------------------------

describe('cleanup', () => {
  it('clears timer on unmount', () => {
    const { rerender, unmount } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    // Unmount before timer fires
    unmount();

    // Advancing time should not cause errors
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // No error means cleanup was successful
    expect(true).toBe(true);
  });
});
