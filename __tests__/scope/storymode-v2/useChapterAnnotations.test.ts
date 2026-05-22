import { act, renderHook } from '@testing-library/react-native';
import { useChapterAnnotations } from '@/components/service-hub/estimate-studio/scope/useChapterAnnotations';

describe('useChapterAnnotations', () => {
  it('starts with both keys null', () => {
    const { result } = renderHook(() => useChapterAnnotations());
    expect(result.current.hoverBulletKey).toBeNull();
    expect(result.current.hoverRegionKey).toBeNull();
  });

  it('setHoverBulletKey updates the bullet key only', () => {
    const { result } = renderHook(() => useChapterAnnotations());
    act(() => result.current.setHoverBulletKey('task-1'));
    expect(result.current.hoverBulletKey).toBe('task-1');
    expect(result.current.hoverRegionKey).toBeNull();
  });

  it('setHoverRegionKey updates the region key only', () => {
    const { result } = renderHook(() => useChapterAnnotations());
    act(() => result.current.setHoverRegionKey('mothers-room'));
    expect(result.current.hoverRegionKey).toBe('mothers-room');
    expect(result.current.hoverBulletKey).toBeNull();
  });

  it('both setters accept null to clear', () => {
    const { result } = renderHook(() => useChapterAnnotations());
    act(() => {
      result.current.setHoverBulletKey('x');
      result.current.setHoverRegionKey('y');
    });
    act(() => {
      result.current.setHoverBulletKey(null);
      result.current.setHoverRegionKey(null);
    });
    expect(result.current.hoverBulletKey).toBeNull();
    expect(result.current.hoverRegionKey).toBeNull();
  });

  it('setters are stable across renders (referentially equal)', () => {
    const { result, rerender } = renderHook(() => useChapterAnnotations());
    const set1 = result.current.setHoverBulletKey;
    const set2 = result.current.setHoverRegionKey;
    rerender({});
    expect(result.current.setHoverBulletKey).toBe(set1);
    expect(result.current.setHoverRegionKey).toBe(set2);
  });
});
