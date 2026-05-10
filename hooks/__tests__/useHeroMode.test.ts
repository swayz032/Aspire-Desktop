/**
 * @jest-environment jsdom
 *
 * useHeroMode tests — Service Hub Phase 3, Pass 3.2.
 *
 * Covers:
 *   - Default mode is 'streetview'
 *   - setMode transitions to a valid mode
 *   - reset() returns to default
 *   - URL query param sync (web only — jsdom env)
 *   - ESC key resets to default
 *   - Hydrates from URL on mount
 */
import { renderHook, act } from '@testing-library/react-native';
import { useHeroMode } from '../useHeroMode';

describe('useHeroMode', () => {
  beforeEach(() => {
    // Reset URL between tests.
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  });

  it('defaults to streetview', () => {
    const { result } = renderHook(() => useHeroMode());
    expect(result.current.mode).toBe('streetview');
  });

  it('respects initialMode override', () => {
    const { result } = renderHook(() => useHeroMode('aerial'));
    expect(result.current.mode).toBe('aerial');
  });

  it('setMode transitions to valid mode', () => {
    const { result } = renderHook(() => useHeroMode());
    act(() => result.current.setMode('interior'));
    expect(result.current.mode).toBe('interior');
  });

  it('setMode ignores invalid values', () => {
    const { result } = renderHook(() => useHeroMode());
    act(() => result.current.setMode('not-a-mode' as any));
    expect(result.current.mode).toBe('streetview');
  });

  it('reset() returns to streetview default', () => {
    const { result } = renderHook(() => useHeroMode('roof'));
    expect(result.current.mode).toBe('roof');
    act(() => result.current.reset());
    expect(result.current.mode).toBe('streetview');
  });

  it('writes mode to URL query param on change', () => {
    if (typeof window === 'undefined') return;
    const { result } = renderHook(() => useHeroMode());
    act(() => result.current.setMode('exterior'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('hero')).toBe('exterior');
  });

  it('removes URL param when mode returns to default', () => {
    if (typeof window === 'undefined') return;
    const { result } = renderHook(() => useHeroMode());
    act(() => result.current.setMode('exterior'));
    act(() => result.current.reset());
    const params = new URLSearchParams(window.location.search);
    expect(params.get('hero')).toBeNull();
  });

  it('hydrates from URL on mount', () => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', '/?hero=interior');
    const { result } = renderHook(() => useHeroMode());
    expect(result.current.mode).toBe('interior');
  });

  it('ignores invalid URL param value on hydrate', () => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', '/?hero=bogus');
    const { result } = renderHook(() => useHeroMode());
    expect(result.current.mode).toBe('streetview');
  });

  it('ESC key resets to default', () => {
    if (typeof window === 'undefined') return;
    const { result } = renderHook(() => useHeroMode('roof'));
    expect(result.current.mode).toBe('roof');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.mode).toBe('streetview');
  });

  it('ESC is no-op when already at default', () => {
    if (typeof window === 'undefined') return;
    const { result } = renderHook(() => useHeroMode());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.mode).toBe('streetview');
  });
});
