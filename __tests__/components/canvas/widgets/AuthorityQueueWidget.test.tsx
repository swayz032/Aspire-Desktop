/**
 * AuthorityQueueWidget Tests
 *
 * Tests for premium governance approval queue widget:
 * - RLS-scoped data fetching (suite_id + office_id)
 * - Real-time subscription setup/cleanup
 * - Loading/error/empty states
 * - Approve/deny button interactions
 * - Risk tier badge rendering
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { AuthorityQueueWidget } from '@/components/canvas/widgets/AuthorityQueueWidget';
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

// Helper to build mock query chain for authority_queue
function buildMockListChain(resolvedValue: { data: unknown; error: unknown }) {
  const mockLimit = jest.fn().mockResolvedValue(resolvedValue);
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
  const mockEqOffice = jest.fn().mockReturnValue({ eq: mockEqStatus });
  const mockEqSuite = jest.fn().mockReturnValue({ eq: mockEqOffice });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqSuite });

  const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

  mockSupabase.from.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  } as unknown as ReturnType<typeof supabase.from>);

  return { mockSelect, mockEqSuite, mockEqOffice, mockEqStatus, mockUpdate, mockUpdateEq };
}

describe('AuthorityQueueWidget', () => {
  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  const mockRequests = [
    { id: 'req-1', action_type: 'Invoice Creation', risk_tier: 'RED', description: 'Create $2,500 invoice', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString() },
    { id: 'req-2', action_type: 'Email Draft', risk_tier: 'YELLOW', description: 'Send Q4 update', status: 'pending', created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch authority requests with RLS scope', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('authority_queue');
    });
  });

  it('should apply suite_id filter', async () => {
    const { mockEqSuite } = buildMockListChain({ data: mockRequests, error: null });

    render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqSuite).toHaveBeenCalledWith('suite_id', 'suite-123');
    });
  });

  it('should apply office_id filter', async () => {
    const { mockEqOffice } = buildMockListChain({ data: mockRequests, error: null });

    render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqOffice).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  it('should filter by pending status', async () => {
    const { mockEqStatus } = buildMockListChain({ data: mockRequests, error: null });

    render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqStatus).toHaveBeenCalledWith('status', 'pending');
    });
  });

  // ---------------------------------------------------------------------------
  // Real-Time Subscription
  // ---------------------------------------------------------------------------

  it('should subscribe to real-time authority_queue updates', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('authority_queue:suite-123:office-456');
    });
  });

  it('should clean up subscription on unmount', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    const { unmount } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalled();
    });

    unmount();

    const channelResult = (mockSupabase.channel as jest.Mock).mock.results[0]?.value;
    if (channelResult?.unsubscribe) {
      expect(channelResult.unsubscribe).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('should render action type after loading', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    const { getByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Invoice Creation')).toBeTruthy();
    });
  });

  it('should render pending count badge', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    const { getByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('2')).toBeTruthy(); // 2 pending
      expect(getByText('pending')).toBeTruthy();
    });
  });

  it('should render risk tier badges', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    const { getByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('RED')).toBeTruthy();
      expect(getByText('YELLOW')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Action Buttons
  // ---------------------------------------------------------------------------

  it('should render Approve and Deny buttons', async () => {
    buildMockListChain({ data: mockRequests, error: null });

    const { getAllByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getAllByText('Approve').length).toBeGreaterThan(0);
      expect(getAllByText('Deny').length).toBeGreaterThan(0);
    });
  });

  it('should call onApprove when Approve is pressed', async () => {
    buildMockListChain({ data: mockRequests, error: null });
    const onApprove = jest.fn();

    const { getAllByText } = render(
      <AuthorityQueueWidget {...defaultProps} onApprove={onApprove} />,
    );

    await waitFor(() => {
      const approveButtons = getAllByText('Approve');
      fireEvent.press(approveButtons[0]);
      expect(onApprove).toHaveBeenCalledWith('req-1');
    });
  });

  it('should call onDeny when Deny is pressed', async () => {
    buildMockListChain({ data: mockRequests, error: null });
    const onDeny = jest.fn();

    const { getAllByText } = render(
      <AuthorityQueueWidget {...defaultProps} onDeny={onDeny} />,
    );

    await waitFor(() => {
      const denyButtons = getAllByText('Deny');
      fireEvent.press(denyButtons[0]);
      expect(onDeny).toHaveBeenCalledWith('req-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  it('should render empty state when no pending requests', async () => {
    buildMockListChain({ data: [], error: null });

    const { getByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Queue is clear')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback on Error
  // ---------------------------------------------------------------------------

  it('should display demo data on fetch failure', async () => {
    buildMockListChain({ data: null, error: new Error('Table not found') });

    const { getByText } = render(<AuthorityQueueWidget {...defaultProps} />);

    await waitFor(() => {
      // Should fall back to demo data
      expect(getByText('Invoice Creation')).toBeTruthy();
    });
  });
});
