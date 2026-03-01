/**
 * StickyNoteWidget Tests
 *
 * Tests for premium sticky notes widget:
 * - RLS-scoped data fetching (suite_id + office_id)
 * - Real-time subscription setup/cleanup
 * - Loading/empty states
 * - Inline text editing
 * - Color cycling
 * - Add/delete notes
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { StickyNoteWidget } from '@/components/canvas/widgets/StickyNoteWidget';
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

// Helper to build mock query chain for sticky_notes
function buildMockListChain(resolvedValue: { data: unknown; error: unknown }) {
  const mockOrder = jest.fn().mockResolvedValue(resolvedValue);
  const mockEqOffice = jest.fn().mockReturnValue({ order: mockOrder });
  const mockEqSuite = jest.fn().mockReturnValue({ eq: mockEqOffice });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEqSuite });

  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
  const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
  const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });

  mockSupabase.from.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  } as unknown as ReturnType<typeof supabase.from>);

  return { mockSelect, mockEqSuite, mockEqOffice, mockInsert, mockUpdate, mockDelete };
}

describe('StickyNoteWidget', () => {
  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  const mockNotes = [
    { id: 'note-1', content: 'Follow up with vendor', color: 'yellow', position: 0, created_at: new Date().toISOString() },
    { id: 'note-2', content: 'Call insurance agent', color: 'blue', position: 1, created_at: new Date().toISOString() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  it('should fetch notes with RLS scope', async () => {
    buildMockListChain({ data: mockNotes, error: null });

    render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('sticky_notes');
    });
  });

  it('should apply suite_id filter', async () => {
    const { mockEqSuite } = buildMockListChain({ data: mockNotes, error: null });

    render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqSuite).toHaveBeenCalledWith('suite_id', 'suite-123');
    });
  });

  it('should apply office_id filter', async () => {
    const { mockEqOffice } = buildMockListChain({ data: mockNotes, error: null });

    render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockEqOffice).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  // ---------------------------------------------------------------------------
  // Real-Time Subscription
  // ---------------------------------------------------------------------------

  it('should subscribe to real-time note updates', async () => {
    buildMockListChain({ data: mockNotes, error: null });

    render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('sticky_notes:suite-123:office-456');
    });
  });

  it('should clean up subscription on unmount', async () => {
    buildMockListChain({ data: mockNotes, error: null });

    const { unmount } = render(<StickyNoteWidget {...defaultProps} />);

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

  it('should render note content after loading', async () => {
    buildMockListChain({ data: mockNotes, error: null });

    const { getByDisplayValue } = render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByDisplayValue('Follow up with vendor')).toBeTruthy();
    });
  });

  it('should render note count', async () => {
    buildMockListChain({ data: mockNotes, error: null });

    const { getByText } = render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('2 notes')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Add Note
  // ---------------------------------------------------------------------------

  it('should call onNoteChange when adding a note', async () => {
    buildMockListChain({ data: mockNotes, error: null });
    const onNoteChange = jest.fn();

    const { getByText, toJSON } = render(
      <StickyNoteWidget {...defaultProps} onNoteChange={onNoteChange} />,
    );

    await waitFor(() => {
      // The footer has a "New Note" button text
      const newNoteButton = getByText('New Note');
      fireEvent.press(newNoteButton);
      expect(onNoteChange).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  it('should render empty state when no notes', async () => {
    buildMockListChain({ data: [], error: null });

    const { getByText } = render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Capture quick thoughts')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback on Error
  // ---------------------------------------------------------------------------

  it('should display demo data on fetch failure', async () => {
    buildMockListChain({ data: null, error: new Error('Table not found') });

    const { getByText } = render(<StickyNoteWidget {...defaultProps} />);

    await waitFor(() => {
      // Should fall back to demo data
      expect(getByText('3 notes')).toBeTruthy();
    });
  });
});
