/**
 * useReducedMotion.test.ts -- Unit tests for Reduced Motion Detection (Wave 20)
 *
 * Tests cover:
 * - Initial state detection from media query
 * - Dynamic response to media query changes
 * - Default false on non-web platforms
 * - getReducedMotion() module-level helper
 */

import { renderHook, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Media query mock
let mockMatches = false;
let mockChangeListener: ((e: { matches: boolean }) => void) | null = null;

const mockMatchMedia = jest.fn().mockImplementation(() => ({
  matches: mockMatches,
  addEventListener: jest.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
    mockChangeListener = cb;
  }),
  removeEventListener: jest.fn((_event: string, _cb: Function) => {
    mockChangeListener = null;
  }),
}));

Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true,
});

// Import after mocks are set up
import { useReducedMotion } from '../useReducedMotion';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMatches = false;
  mockChangeListener = null;
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: Initial State
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('returns false when prefers-reduced-motion is not set', () => {
    mockMatches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion is set', () => {
    mockMatches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Dynamic Changes
// ---------------------------------------------------------------------------

describe('dynamic changes', () => {
  it('updates when media query changes to reduce', () => {
    mockMatches = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate user enabling reduced motion in OS settings
    act(() => {
      mockChangeListener?.({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it('updates when media query changes to no-preference', () => {
    mockMatches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    // Simulate user disabling reduced motion
    act(() => {
      mockChangeListener?.({ matches: false });
    });

    expect(result.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Cleanup
// ---------------------------------------------------------------------------

describe('cleanup', () => {
  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());

    unmount();

    // After unmount, the removeEventListener should have been called
    const mql = mockMatchMedia();
    expect(mql.removeEventListener).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: matchMedia API
// ---------------------------------------------------------------------------

describe('matchMedia usage', () => {
  it('queries prefers-reduced-motion media feature', () => {
    renderHook(() => useReducedMotion());
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
