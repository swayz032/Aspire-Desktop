import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useChapterDeepLink } from '@/app/service-hub/estimate-studio/scope';
import { scopeUiActions, getScopeUiSnapshot } from '@/lib/scopeUiStore';

// Mock expo-router. The current implementation can stub these per test.
const mockSetParams = jest.fn();
let mockParams: { chapter?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

// Stub the ScopeTab component subtree — this test only exercises the hook;
// rendering ScopeTab would pull in Supabase + the full blueprint stack.
jest.mock('@/components/service-hub/estimate-studio/scope/ScopeTab', () => ({
  ScopeTab: () => null,
}));

function HookHost(): React.ReactElement | null {
  useChapterDeepLink();
  return null;
}

describe('useChapterDeepLink', () => {
  beforeEach(() => {
    mockSetParams.mockReset();
    mockParams = {};
    act(() => scopeUiActions().reset());
  });

  it('hydrates activeChapterKey from ?chapter= on mount', () => {
    mockParams = { chapter: 'restrooms' };
    render(<HookHost />);
    expect(getScopeUiSnapshot().activeChapterKey).toBe('restrooms');
  });

  it('does not hydrate when ?chapter= is absent', () => {
    mockParams = {};
    render(<HookHost />);
    expect(getScopeUiSnapshot().activeChapterKey).toBeNull();
  });

  it('does not call setActiveChapterKey when URL value already matches store', () => {
    // Pre-populate store to match URL.
    act(() => scopeUiActions().setActiveChapterKey('cover'));
    mockParams = { chapter: 'cover' };
    const setSpy = jest.spyOn(scopeUiActions(), 'setActiveChapterKey');
    render(<HookHost />);
    // setActiveChapterKey was called via the imperative API before render,
    // so the spy is fresh — it should not be called as a result of the effect.
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('writes activeChapterKey to URL when store changes', () => {
    mockParams = {};
    render(<HookHost />);
    act(() => scopeUiActions().setActiveChapterKey('hvac'));
    expect(mockSetParams).toHaveBeenCalledWith({ chapter: 'hvac' });
  });

  it('does not write to URL when store value already matches URL', () => {
    mockParams = { chapter: 'demo' };
    render(<HookHost />);
    // After the hydration effect runs, store should be 'demo' AND
    // setParams should NOT be called (the write-back effect sees no diff).
    expect(getScopeUiSnapshot().activeChapterKey).toBe('demo');
    expect(mockSetParams).not.toHaveBeenCalled();
  });
});
