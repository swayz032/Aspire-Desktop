/**
 * QuoteWidget Tests
 *
 * Tests for Bloomberg Terminal-quality quote display widget:
 * - Data fetching with RLS scoping
 * - Line item rendering
 * - Total calculation display
 * - Send button conditional rendering
 * - Status badge rendering
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QuoteWidget } from '@/components/canvas/widgets/QuoteWidget';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('QuoteWidget', () => {
  const mockQuote = {
    id: 'quote-123',
    quote_number: 'Q-2024-001',
    client_name: 'Acme Corp',
    line_items: [
      {
        name: 'Web Development',
        description: 'Custom website build',
        quantity: 1,
        unit_price: 5000,
        total: 5000,
      },
      {
        name: 'SEO Services',
        description: 'Monthly optimization',
        quantity: 3,
        unit_price: 500,
        total: 1500,
      },
    ],
    total_amount: 6500,
    status: 'draft',
    created_at: '2024-01-15T10:00:00Z',
  };

  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
    quoteId: 'quote-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch quote with RLS scoping', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    } as any);

    render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('quotes');
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('quote_number')
      );
    });
  });

  it('should apply suite_id and office_id filters', async () => {
    const mockEq = jest.fn();
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('suite_id', 'suite-123');
      expect(mockEq).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('should render quote number and client name', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Q-2024-001')).toBeTruthy();
      expect(getByText('Acme Corp')).toBeTruthy();
    });
  });

  it('should render all line items', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Web Development')).toBeTruthy();
      expect(getByText('Custom website build')).toBeTruthy();
      expect(getByText('SEO Services')).toBeTruthy();
      expect(getByText('Monthly optimization')).toBeTruthy();
    });
  });

  it('should display formatted line item totals', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('$5,000.00')).toBeTruthy();
      expect(getByText('$1,500.00')).toBeTruthy();
    });
  });

  it('should display total amount', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('$6,500.00')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Send Button
  // ---------------------------------------------------------------------------

  it('should show send button for draft status', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const onSendClick = jest.fn();
    const { getByText } = render(
      <QuoteWidget {...defaultProps} onSendClick={onSendClick} />
    );

    await waitFor(() => {
      expect(getByText('Send Quote')).toBeTruthy();
    });
  });

  it('should hide send button for sent status', async () => {
    const sentQuote = { ...mockQuote, status: 'sent' };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: sentQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const onSendClick = jest.fn();
    const { queryByText } = render(
      <QuoteWidget {...defaultProps} onSendClick={onSendClick} />
    );

    await waitFor(() => {
      expect(queryByText('Send Quote')).toBeNull();
    });
  });

  it('should call onSendClick with quote ID', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const onSendClick = jest.fn();
    const { getByText } = render(
      <QuoteWidget {...defaultProps} onSendClick={onSendClick} />
    );

    await waitFor(() => {
      const sendButton = getByText('Send Quote');
      fireEvent.press(sendButton);
      expect(onSendClick).toHaveBeenCalledWith('quote-123');
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  it('should display error message on fetch failure', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Network error'),
            }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/Network error/i)).toBeTruthy();
    });
  });

  it('should show loading state initially', () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockQuote, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<QuoteWidget {...defaultProps} />);

    expect(getByText('Loading quote...')).toBeTruthy();
  });
});
