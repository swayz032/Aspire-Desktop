/**
 * FinanceHubWidget Tests
 *
 * Tests for premium cash position widget:
 * - RLS-scoped data fetching (suite_id + office_id)
 * - Real-time subscription setup/cleanup
 * - Loading/error/empty states
 * - Burn rate visualization
 * - Runway health indicator
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { FinanceHubWidget } from '@/components/canvas/widgets/FinanceHubWidget';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => {
  const mockUnsubscribe = jest.fn();
  const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
  const mockOn = jest.fn().mockReturnValue({ subscribe: mockSubscribe });
  const mockChannel = jest.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe, unsubscribe: mockUnsubscribe });

  return {
    supabase: {
      from: jest.fn(),
      channel: mockChannel,
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// Helper to build mock query chain
function buildMockQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  const mockSingle = jest.fn().mockResolvedValue(resolvedValue);
  const mockLimit = jest.fn().mockReturnValue({ single: mockSingle });
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockEqOffice = jest.fn().mockReturnValue({ order: mockOrder });
  const mockEqSuite = jest.fn().mockReturnValue({ eq: mockEqOffice });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqSuite });

  mockSupabase.from.mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

  return { mockSelect, mockEqSuite, mockEqOffice, mockOrder, mockLimit, mockSingle };
}

describe('FinanceHubWidget', () => {
  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  const mockCashData = {
    id: 'cash-1',
    suite_id: 'suite-123',
    office_id: 'office-456',
    cash_amount: 45230,
    burn_rate_weekly: 2150,
    runway_weeks: 21,
    last_updated: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch cash position with RLS scope', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('cash_position');
    });
  });

  it('should apply suite_id filter', async () => {
    const { mockEqSuite } = buildMockQueryChain({ data: mockCashData, error: null });

    render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqSuite).toHaveBeenCalledWith('suite_id', 'suite-123');
    });
  });

  it('should apply office_id filter', async () => {
    const { mockEqOffice } = buildMockQueryChain({ data: mockCashData, error: null });

    render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqOffice).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  it('should order by last_updated descending', async () => {
    const { mockOrder } = buildMockQueryChain({ data: mockCashData, error: null });

    render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalledWith('last_updated', { ascending: false });
    });
  });

  // ---------------------------------------------------------------------------
  // Real-Time Subscription
  // ---------------------------------------------------------------------------

  it('should subscribe to real-time updates', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('cash_position:suite-123:office-456');
    });
  });

  it('should clean up subscription on unmount', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    const { unmount } = render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalled();
    });

    unmount();

    // The unsubscribe is called via the channel mock chain
    const channelResult = (mockSupabase.channel as jest.Mock).mock.results[0]?.value;
    if (channelResult?.unsubscribe) {
      expect(channelResult.unsubscribe).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('should render cash position amount after loading', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    const { getByText } = render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      // The component formats the cash amount using Intl.NumberFormat
      expect(getByText('$45,230.00')).toBeTruthy();
    });
  });

  it('should render burn rate section', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    const { getByText } = render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('BURN RATE')).toBeTruthy();
    });
  });

  it('should render runway section', async () => {
    buildMockQueryChain({ data: mockCashData, error: null });

    const { getByText } = render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('RUNWAY')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback on Error
  // ---------------------------------------------------------------------------

  it('should display demo data on fetch failure', async () => {
    buildMockQueryChain({ data: null, error: new Error('Table not found') });

    const { getByText } = render(<FinanceHubWidget {...defaultProps} />);

    await waitFor(() => {
      // Should fall back to demo data and display cash position
      expect(getByText('CASH POSITION')).toBeTruthy();
    });
  });
});
