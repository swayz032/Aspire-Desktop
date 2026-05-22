import { scopeUiActions, useScopeUi, getScopeUiSnapshot } from '@/lib/scopeUiStore';
import { act, renderHook } from '@testing-library/react-native';

describe('scopeUiStore — activeChapterKey', () => {
  beforeEach(() => {
    // Reset to known-clean state — the store is module-level.
    act(() => scopeUiActions().reset());
  });

  it('defaults to null', () => {
    const { result } = renderHook(() => useScopeUi());
    expect(result.current.activeChapterKey).toBeNull();
  });

  it('setActiveChapterKey updates the value', () => {
    const { result } = renderHook(() => useScopeUi());
    act(() => scopeUiActions().setActiveChapterKey('restrooms-mothers-room'));
    expect(result.current.activeChapterKey).toBe('restrooms-mothers-room');
  });

  it('setActiveChapterKey accepts null to clear', () => {
    act(() => scopeUiActions().setActiveChapterKey('x'));
    act(() => scopeUiActions().setActiveChapterKey(null));
    expect(getScopeUiSnapshot().activeChapterKey).toBeNull();
  });

  it('reset clears activeChapterKey back to null', () => {
    act(() => scopeUiActions().setActiveChapterKey('y'));
    act(() => scopeUiActions().reset());
    expect(getScopeUiSnapshot().activeChapterKey).toBeNull();
  });
});
