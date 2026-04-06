/**
 * useAvaPresents.test.ts -- Unit tests for the Ava Presents state hook.
 *
 * Covers: showCards, dismiss, nextCard, prevCard, goToCard, openDetail, closeDetail,
 * boundary guards (first/last card, detail mode blocks nav), empty records rejection.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAvaPresents, type ShowCardsPayload } from '../useAvaPresents';

const makeRecords = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Record ${i + 1}`, score: 5 + i }));

const PAYLOAD: ShowCardsPayload = {
  artifactType: 'HotelShortlist',
  records: makeRecords(5),
  summary: 'Top 5 hotels near downtown',
  confidence: { status: 'verified', score: 0.92 },
};

describe('useAvaPresents', () => {
  it('starts in hidden state', () => {
    const { result } = renderHook(() => useAvaPresents());
    expect(result.current.visible).toBe(false);
    expect(result.current.records).toEqual([]);
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.detailMode).toBe(false);
  });

  it('showCards populates state and sets visible', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));

    expect(result.current.visible).toBe(true);
    expect(result.current.artifactType).toBe('HotelShortlist');
    expect(result.current.records).toHaveLength(5);
    expect(result.current.summary).toBe('Top 5 hotels near downtown');
    expect(result.current.confidence?.score).toBe(0.92);
    expect(result.current.activeIndex).toBe(0);
  });

  it('rejects empty records (no-op)', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards({ ...PAYLOAD, records: [] }));
    expect(result.current.visible).toBe(false);
  });

  it('dismiss resets to initial state', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
    expect(result.current.records).toEqual([]);
  });

  it('nextCard increments activeIndex', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.nextCard());
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.nextCard());
    expect(result.current.activeIndex).toBe(2);
  });

  it('nextCard stops at last card', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    // Go to last
    for (let i = 0; i < 10; i++) act(() => result.current.nextCard());
    expect(result.current.activeIndex).toBe(4); // 5 records, 0-indexed
  });

  it('prevCard decrements activeIndex', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.nextCard());
    act(() => result.current.nextCard());
    act(() => result.current.prevCard());
    expect(result.current.activeIndex).toBe(1);
  });

  it('prevCard stops at first card', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.prevCard());
    expect(result.current.activeIndex).toBe(0);
  });

  it('goToCard clamps to valid range', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.goToCard(3));
    expect(result.current.activeIndex).toBe(3);
    act(() => result.current.goToCard(999));
    expect(result.current.activeIndex).toBe(4); // clamped
    act(() => result.current.goToCard(-5));
    expect(result.current.activeIndex).toBe(0); // clamped
  });

  it('openDetail enters detail mode', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    const record = PAYLOAD.records[2];
    act(() => result.current.openDetail(record));
    expect(result.current.detailMode).toBe(true);
    expect(result.current.detailRecord).toBe(record);
  });

  it('openDetail is no-op when not visible', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.openDetail({ id: 1 }));
    expect(result.current.detailMode).toBe(false);
  });

  it('closeDetail returns to Level 1', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.openDetail(PAYLOAD.records[0]));
    act(() => result.current.closeDetail());
    expect(result.current.detailMode).toBe(false);
    expect(result.current.detailRecord).toBeNull();
  });

  it('nextCard/prevCard are no-ops in detail mode', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.nextCard()); // index = 1
    act(() => result.current.openDetail(PAYLOAD.records[1]));
    act(() => result.current.nextCard()); // should be blocked
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.prevCard()); // should be blocked
    expect(result.current.activeIndex).toBe(1);
  });

  it('goToCard is no-op in detail mode', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.openDetail(PAYLOAD.records[0]));
    act(() => result.current.goToCard(3));
    expect(result.current.activeIndex).toBe(0);
  });

  it('showCards resets detail mode from prior session', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards(PAYLOAD));
    act(() => result.current.openDetail(PAYLOAD.records[0]));
    // New showCards should reset detail
    act(() => result.current.showCards({ ...PAYLOAD, summary: 'New search' }));
    expect(result.current.detailMode).toBe(false);
    expect(result.current.detailRecord).toBeNull();
    expect(result.current.activeIndex).toBe(0);
  });

  it('confidence defaults to null when not provided', () => {
    const { result } = renderHook(() => useAvaPresents());
    act(() => result.current.showCards({ artifactType: 'Test', records: makeRecords(1), summary: 'x' }));
    expect(result.current.confidence).toBeNull();
  });
});
