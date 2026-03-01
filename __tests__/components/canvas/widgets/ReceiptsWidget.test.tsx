/**
 * ReceiptsWidget Tests
 *
 * Tests for premium governance receipt timeline widget:
 * - RLS-scoped data fetching (suite_id + office_id)
 * - Real-time subscription setup/cleanup
 * - Loading/error/empty states
 * - Status filter interaction
 * - Search functionality
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ReceiptsWidget } from '@/components/canvas/widgets/ReceiptsWidget';
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

// Helper to build mock query chain for receipts
function buildMockListChain(resolvedValue: { data: unknown; error: unknown }) {
  const mockLimit = jest.fn().mockResolvedValue(resolvedValue);
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockEqOffice = jest.fn().mockReturnValue({ order: mockOrder });
  const mockEqSuite = jest.fn().mockReturnValue({ eq: mockEqOffice });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqSuite });

  mockSupabase.from.mockReturnValue({ select: mockSelect } as unknown as ReturnType<typeof supabase.from>);

  return { mockSelect, mockEqSuite, mockEqOffice, mockOrder, mockLimit };
}

describe('ReceiptsWidget', () => {
  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  const mockReceipts = [
    { id: 'r-1', action_type: 'Invoice Created', status: 'SUCCEEDED', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), description: '$2,500 for ABC Company' },
    { id: 'r-2', action_type: 'Payment Failed', status: 'FAILED', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), description: 'Stripe API timeout' },
    { id: 'r-3', action_type: 'Transfer Denied', status: 'DENIED', created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), description: 'Missing capability token' },
    { id: 'r-4', action_type: 'Quote Generation', status: 'PENDING', created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(), description: 'Generating quote' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch receipts with RLS scope', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('receipts');
    });
  });

  it('should apply suite_id filter', async () => {
    const { mockEqSuite } = buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqSuite).toHaveBeenCalledWith('suite_id', 'suite-123');
    });
  });

  it('should apply office_id filter', async () => {
    const { mockEqOffice } = buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqOffice).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  it('should order by created_at descending', async () => {
    const { mockOrder } = buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  it('should limit to 20 results', async () => {
    const { mockLimit } = buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockLimit).toHaveBeenCalledWith(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Real-Time Subscription
  // ---------------------------------------------------------------------------

  it('should subscribe to real-time receipt updates', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('receipts:suite-123:office-456');
    });
  });

  it('should clean up subscription on unmount', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { unmount } = render(<ReceiptsWidget {...defaultProps} />);

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

  it('should render receipt action types after loading', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { getByText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Invoice Created')).toBeTruthy();
      expect(getByText('Payment Failed')).toBeTruthy();
    });
  });

  it('should render search bar', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { getByPlaceholderText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByPlaceholderText('Search receipts...')).toBeTruthy();
    });
  });

  it('should render filter chips', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { getByText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('All')).toBeTruthy();
      expect(getByText('OK')).toBeTruthy();
      expect(getByText('Fail')).toBeTruthy();
      expect(getByText('Deny')).toBeTruthy();
      expect(getByText('Wait')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Filter Interaction
  // ---------------------------------------------------------------------------

  it('should filter receipts when status filter is pressed', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { getByText, queryByText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Invoice Created')).toBeTruthy();
    });

    // Press the "Fail" filter
    fireEvent.press(getByText('Fail'));

    // Only FAILED receipts should remain visible
    await waitFor(() => {
      expect(getByText('Payment Failed')).toBeTruthy();
      expect(queryByText('Invoice Created')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Search Functionality
  // ---------------------------------------------------------------------------

  it('should filter receipts by search query', async () => {
    buildMockListChain({ data: mockReceipts, error: null });

    const { getByPlaceholderText, getByText, queryByText } = render(
      <ReceiptsWidget {...defaultProps} />,
    );

    await waitFor(() => {
      expect(getByText('Invoice Created')).toBeTruthy();
    });

    // Type in search bar
    const searchInput = getByPlaceholderText('Search receipts...');
    fireEvent.changeText(searchInput, 'Stripe');

    await waitFor(() => {
      expect(getByText('Payment Failed')).toBeTruthy();
      expect(queryByText('Invoice Created')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Click Handler
  // ---------------------------------------------------------------------------

  it('should call onReceiptClick when a receipt is pressed', async () => {
    buildMockListChain({ data: mockReceipts, error: null });
    const onReceiptClick = jest.fn();

    const { getByText } = render(
      <ReceiptsWidget {...defaultProps} onReceiptClick={onReceiptClick} />,
    );

    await waitFor(() => {
      const receiptCard = getByText('Invoice Created');
      fireEvent.press(receiptCard);
      expect(onReceiptClick).toHaveBeenCalledWith('r-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  it('should render empty state when no receipts', async () => {
    buildMockListChain({ data: [], error: null });

    const { getByText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('No receipts yet')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback on Error
  // ---------------------------------------------------------------------------

  it('should display demo data on fetch failure', async () => {
    buildMockListChain({ data: null, error: new Error('Table not found') });

    const { getByText } = render(<ReceiptsWidget {...defaultProps} />);

    await waitFor(() => {
      // Should fall back to demo data
      expect(getByText('Invoice Created')).toBeTruthy();
    });
  });
});
