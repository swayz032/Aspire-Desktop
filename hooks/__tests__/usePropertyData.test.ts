/**
 * usePropertyData tests — Service Hub Phase 3, Pass 3.2.
 *
 * Mocks `services/serviceHub/propertyDataApi.fetchPropertyData` to verify
 * the state-machine transitions for each response kind.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@/services/serviceHub/propertyDataApi', () => ({
  fetchPropertyData: jest.fn(),
}));

import { usePropertyData } from '../usePropertyData';
import { fetchPropertyData } from '@/services/serviceHub/propertyDataApi';

const fetchMock = fetchPropertyData as jest.MockedFunction<typeof fetchPropertyData>;

const sampleData = {
  address: { formatted: '1234 Industrial Way, Austin, TX 78701' },
  coords: { lat: 30.2672, lng: -97.7431 },
  hero: {},
  facts: { sqft: 2400 },
  photos: {
    interior: { count: 0, photos: [] },
    exterior: { count: 0, photos: [] },
    roof: { count: 0, photos: [] },
    streetView: { count: 0, photos: [] },
  },
  signals: { materials: [] },
  costBand: { low: 100_000, high: 200_000, currency: 'USD' as const },
  evidenceGaps: [],
  fetchedAt: '2026-05-10T00:00:00Z',
  sources: [
    { name: 'adam' as const, fetchedAt: '2026-05-10T00:00:00Z', status: 'ok' as const },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe('usePropertyData', () => {
  it('starts in idle when address is empty', () => {
    const { result } = renderHook(() => usePropertyData(''));
    expect(result.current.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts in idle when address is undefined', () => {
    const { result } = renderHook(() => usePropertyData(undefined));
    expect(result.current.status).toBe('idle');
  });

  it('transitions idle → loading → success on ok response', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', data: sampleData });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way'));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toEqual(sampleData);
    expect(fetchMock).toHaveBeenCalledWith(
      { address: '1234 Industrial Way', forceRefresh: false },
      expect.any(Object),
    );
  });

  it('flags partial when any source has non-ok status', async () => {
    fetchMock.mockResolvedValue({
      kind: 'ok',
      data: {
        ...sampleData,
        sources: [
          { name: 'adam', fetchedAt: '2026-05-10T00:00:00Z', status: 'partial' },
        ],
      },
    });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way'));
    await waitFor(() => expect(result.current.status).toBe('partial'));
  });

  it('handles needs_correction', async () => {
    fetchMock.mockResolvedValue({
      kind: 'needs_correction',
      suggestedAddress: '1234 Industrial Way, Austin, TX 78701-1234',
      propertyData: null,
    });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way Austin'));
    await waitFor(() => expect(result.current.status).toBe('needs_correction'));
    expect(result.current.suggestedAddress).toContain('78701-1234');
    expect(result.current.data).toBeUndefined();
  });

  it('handles invalid', async () => {
    fetchMock.mockResolvedValue({
      kind: 'invalid',
      verdict: { status: 'invalid', fetchedAt: '2026-05-10T00:00:00Z' },
      message: 'Address could not be validated',
    });
    const { result } = renderHook(() => usePropertyData('asdf'));
    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(result.current.error).toBe('Address could not be validated');
  });

  it('handles error', async () => {
    fetchMock.mockResolvedValue({
      kind: 'error',
      status: 500,
      message: 'upstream failed',
    });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('upstream failed');
  });

  it('forceRefresh re-fetches with forceRefresh=true', async () => {
    fetchMock.mockResolvedValue({ kind: 'ok', data: sampleData });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    fetchMock.mockClear();
    await act(async () => {
      result.current.forceRefresh();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      { address: '1234 Industrial Way', forceRefresh: true },
      expect.any(Object),
    );
  });

  it('retry re-fetches without forceRefresh', async () => {
    fetchMock.mockResolvedValue({ kind: 'error', status: 500, message: 'oops' });
    const { result } = renderHook(() => usePropertyData('1234 Industrial Way'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ kind: 'ok', data: sampleData });
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(fetchMock).toHaveBeenCalledWith(
      { address: '1234 Industrial Way', forceRefresh: false },
      expect.any(Object),
    );
  });

  it('aborts in-flight request on unmount', async () => {
    let captured: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_args, init) => {
      captured = init?.signal;
      // Hang so we can unmount mid-flight.
      return new Promise(() => {}) as any;
    });
    const { unmount } = renderHook(() => usePropertyData('1234 Industrial Way'));
    await waitFor(() => expect(captured).toBeDefined());
    unmount();
    expect(captured?.aborted).toBe(true);
  });
});
