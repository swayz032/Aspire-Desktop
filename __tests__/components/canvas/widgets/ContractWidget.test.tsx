/**
 * ContractWidget Tests
 *
 * Tests for DocuSign-quality contract display widget:
 * - Data fetching with RLS scoping
 * - Parties row rendering (sender → client)
 * - Signature status indicators
 * - Deadline formatting
 * - Action buttons
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ContractWidget } from '@/components/canvas/widgets/ContractWidget';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('ContractWidget', () => {
  const mockContract = {
    id: 'contract-123',
    contract_number: 'C-2024-001',
    sender_name: 'John Doe',
    sender_email: 'john@example.com',
    client_name: 'Jane Smith',
    client_email: 'jane@acme.com',
    status: 'sent',
    signature_status: 'pending',
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    parties: [
      {
        name: 'John Doe',
        role: 'Sender',
        signed: true,
        signed_at: '2024-01-15T10:00:00Z',
      },
      {
        name: 'Jane Smith',
        role: 'Client',
        signed: false,
        signed_at: null,
      },
    ],
  };

  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
    contractId: 'contract-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch contract with RLS scoping', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    } as any);

    render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('contracts');
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('contract_number')
      );
    });
  });

  it('should apply suite_id filter', async () => {
    const mockEq = jest.fn();
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('suite_id', 'suite-123');
    });
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  it('should render contract number', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('C-2024-001')).toBeTruthy();
    });
  });

  it('should render sender and client names', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Jane Smith')).toBeTruthy();
    });
  });

  it('should render sender and client roles', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getAllByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getAllByText('Sender').length).toBeGreaterThan(0);
      expect(getAllByText('Client').length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Signature Status
  // ---------------------------------------------------------------------------

  it('should display signed status for signed party', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getAllByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getAllByText('Signed').length).toBeGreaterThan(0);
    });
  });

  it('should display unsigned status for unsigned party', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getAllByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getAllByText('Unsigned').length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Deadline Formatting
  // ---------------------------------------------------------------------------

  it('should format deadline correctly for future date', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/3 days left/i)).toBeTruthy();
    });
  });

  it('should show overdue status for past deadline', async () => {
    const overdueContract = {
      ...mockContract,
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: overdueContract, error: null }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/Overdue by 2d/i)).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Action Buttons
  // ---------------------------------------------------------------------------

  it('should render View Contract button', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const onViewClick = jest.fn();
    const { getByText } = render(
      <ContractWidget {...defaultProps} onViewClick={onViewClick} />
    );

    await waitFor(() => {
      expect(getByText('View Contract')).toBeTruthy();
    });
  });

  it('should call onViewClick with contract ID', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const onViewClick = jest.fn();
    const { getByText } = render(
      <ContractWidget {...defaultProps} onViewClick={onViewClick} />
    );

    await waitFor(() => {
      const viewButton = getByText('View Contract');
      fireEvent.press(viewButton);
      expect(onViewClick).toHaveBeenCalledWith('contract-123');
    });
  });

  it('should show Send Reminder button when not all signed', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockContract, error: null }),
          }),
        }),
      }),
    } as any);

    const onSendReminderClick = jest.fn();
    const { getByText } = render(
      <ContractWidget {...defaultProps} onSendReminderClick={onSendReminderClick} />
    );

    await waitFor(() => {
      expect(getByText('Send Reminder')).toBeTruthy();
    });
  });

  it('should hide Send Reminder button when all signed', async () => {
    const signedContract = {
      ...mockContract,
      parties: mockContract.parties.map((p) => ({ ...p, signed: true })),
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: signedContract, error: null }),
          }),
        }),
      }),
    } as any);

    const onSendReminderClick = jest.fn();
    const { queryByText } = render(
      <ContractWidget {...defaultProps} onSendReminderClick={onSendReminderClick} />
    );

    await waitFor(() => {
      expect(queryByText('Send Reminder')).toBeNull();
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
              error: new Error('Permission denied'),
            }),
          }),
        }),
      }),
    } as any);

    const { getByText } = render(<ContractWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/Permission denied/i)).toBeTruthy();
    });
  });
});
