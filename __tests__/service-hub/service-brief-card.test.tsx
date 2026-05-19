/**
 * ServiceBriefCard — Wave 5.1b RTL tests.
 *
 * Validates the visible UX of the Service Memory brief card on the Tim Rail
 * Context tab:
 *   - Loading state renders skeleton
 *   - Error state shows Retry; Retry triggers another fetch
 *   - Loaded state renders all 5 service counters with correct values
 *   - "View all →" link calls router.push('/service-hub/memory')
 *   - useServiceBrief is called with the officeId prop
 *   - Last-updated time is formatted from last_built_at
 *
 * Network is mocked at the `useAuthFetch` boundary so the tests are
 * deterministic and never touch the proxy.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// --- Mocks (must come before component import) ---

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// Stable mock for authenticatedFetch so React effects don't re-run on every render.
const mockFetch = jest.fn();
jest.mock('@/lib/authenticatedFetch', () => {
  const _stable = { authenticatedFetch: (...args: any[]) => mockFetch(...args) };
  return { useAuthFetch: () => _stable };
});

// useTenant isn't used by ServiceBriefCard directly, but @/providers may be
// loaded transitively. Stub it cheaply.
jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office_test' }),
  useSupabase: () => ({}),
}));

import { ServiceBriefCard } from '@/components/service-hub/ServiceBriefCard';
import { _resetServiceBriefCache } from '@/hooks/useServiceBrief';

const fixtureBrief = {
  recent_picks_count: 7,
  recent_overrides_count: 3,
  open_pending_intents_count: 2,
  recent_handoffs_count: 5,
  active_threads_count: 4,
  due_now_count: 1,
  overdue_count: 0,
  pending_approval_count: 2,
  recent_receipts_count: 12,
  brief_text: null,
  // 30 minutes ago → "30m ago"
  last_built_at: new Date(Date.now() - 30 * 60_000).toISOString(),
};

function mockFetchOk(body: any) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchError(status: number, code = 'INTERNAL_ERROR') {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ code, error: code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockRouterPush.mockReset();
  _resetServiceBriefCache();
});

describe('ServiceBriefCard — Wave 5.1b', () => {
  it('renders the loading skeleton on initial mount', () => {
    // Hold the fetch open so we stay in loading.
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);
    expect(getByTestId('service-brief-card')).toBeTruthy();
    expect(getByTestId('service-brief-card-loading')).toBeTruthy();
  });

  it('renders the 5 service counters with values from the brief', async () => {
    mockFetchOk(fixtureBrief);
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);

    await waitFor(() => {
      expect(getByTestId('service-brief-card-loaded')).toBeTruthy();
    });

    expect(getByTestId('service-brief-counter-picks')).toBeTruthy();
    expect(getByTestId('service-brief-counter-overrides')).toBeTruthy();
    expect(getByTestId('service-brief-counter-pending')).toBeTruthy();
    expect(getByTestId('service-brief-counter-handoffs')).toBeTruthy();
    expect(getByTestId('service-brief-counter-threads')).toBeTruthy();

    // Verify rendered counts (regex tolerates surrounding icon + label text).
    expect(getByTestId('service-brief-counter-picks')).toHaveTextContent(/7Picks/);
    expect(getByTestId('service-brief-counter-overrides')).toHaveTextContent(/3Overrides/);
    expect(getByTestId('service-brief-counter-pending')).toHaveTextContent(/2Pending/);
    expect(getByTestId('service-brief-counter-handoffs')).toHaveTextContent(/5Handoffs/);
    expect(getByTestId('service-brief-counter-threads')).toHaveTextContent(/4Active threads/);
  });

  it('formats last_built_at as a relative time in the footer', async () => {
    mockFetchOk(fixtureBrief);
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);
    await waitFor(() => {
      expect(getByTestId('service-brief-footer')).toBeTruthy();
    });
    expect(getByTestId('service-brief-footer')).toHaveTextContent(/Updated.*ago/);
  });

  it('shows a Retry link when the fetch fails', async () => {
    mockFetchError(500, 'INTERNAL_ERROR');
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);

    await waitFor(() => {
      expect(getByTestId('service-brief-card-error')).toBeTruthy();
    });
    expect(getByTestId('service-brief-retry')).toBeTruthy();
  });

  it('Retry link triggers a second fetch', async () => {
    mockFetchError(500, 'INTERNAL_ERROR');
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);
    await waitFor(() => {
      expect(getByTestId('service-brief-retry')).toBeTruthy();
    });

    // Second call → success
    mockFetchOk(fixtureBrief);
    await act(async () => {
      fireEvent.press(getByTestId('service-brief-retry'));
    });
    await waitFor(() => {
      expect(getByTestId('service-brief-card-loaded')).toBeTruthy();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('"View all" link navigates to /service-hub/memory', async () => {
    mockFetchOk(fixtureBrief);
    const { getByTestId } = render(<ServiceBriefCard officeId="office_test" />);
    await waitFor(() => {
      expect(getByTestId('service-brief-card-loaded')).toBeTruthy();
    });

    fireEvent.press(getByTestId('service-brief-view-all'));
    expect(mockRouterPush).toHaveBeenCalledWith('/service-hub/memory');
  });

  it('calls authenticatedFetch with the correct officeId in the body', async () => {
    mockFetchOk(fixtureBrief);
    render(<ServiceBriefCard officeId="office_test_42" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/service-memory\/get-memory-brief$/);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.office_id).toBe('office_test_42');
  });

  it('calls onViewAllPress override instead of router when provided', async () => {
    mockFetchOk(fixtureBrief);
    const onViewAllPress = jest.fn();
    const { getByTestId } = render(
      <ServiceBriefCard officeId="office_test" onViewAllPress={onViewAllPress} />,
    );
    await waitFor(() => {
      expect(getByTestId('service-brief-card-loaded')).toBeTruthy();
    });
    fireEvent.press(getByTestId('service-brief-view-all'));
    expect(onViewAllPress).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
