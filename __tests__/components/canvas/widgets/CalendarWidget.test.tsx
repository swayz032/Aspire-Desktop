import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CalendarWidget } from '@/components/canvas/widgets/CalendarWidget';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('CalendarWidget', () => {
  const defaultProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  const mockEvents = [
    {
      id: 'event-1',
      title: 'Team Standup',
      start_time: '2024-01-15T09:00:00',
      end_time: '2024-01-15T09:30:00',
      agent_id: 'nora',
      location: 'Conference Room A',
      link: null,
    },
  ];

  const buildQueryMock = (data: any[]) => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
      }),
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const subscribedChannel = { id: 'channel' } as any;
    const channelBuilder = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue(subscribedChannel),
    };
    mockSupabase.channel.mockReturnValue(channelBuilder as any);
  });

  it('fetches with suite and office filters', async () => {
    const mockEq = jest.fn();
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: mockEq.mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any);

    render(<CalendarWidget {...defaultProps} date={new Date(2024, 0, 15, 12, 0, 0)} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('calendar_events');
      expect(mockEq).toHaveBeenCalledWith('suite_id', 'suite-123');
      expect(mockEq).toHaveBeenCalledWith('office_id', 'office-456');
    });
  });

  it('sets up and cleans up realtime subscription', async () => {
    const subscribedChannel = { id: 'channel' } as any;
    const channelBuilder = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue(subscribedChannel),
    };
    mockSupabase.channel.mockReturnValue(channelBuilder as any);
    mockSupabase.from.mockReturnValue(buildQueryMock([]) as any);

    const { unmount } = render(<CalendarWidget {...defaultProps} />);

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('calendar_events:suite-123:office-456');
      expect(channelBuilder.on).toHaveBeenCalled();
      expect(channelBuilder.subscribe).toHaveBeenCalled();
    });

    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(subscribedChannel);
  });

  it('renders calendar grid and weekday headers', async () => {
    mockSupabase.from.mockReturnValue(buildQueryMock([]) as any);
    const { getByText } = render(<CalendarWidget {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('MO')).toBeTruthy();
      expect(getByText('SU')).toBeTruthy();
    });
  });

  it('shows selected-day event details when date has events', async () => {
    mockSupabase.from.mockReturnValue(buildQueryMock(mockEvents) as any);
    const { getByText } = render(
      <CalendarWidget {...defaultProps} date={new Date(2024, 0, 15, 12, 0, 0)} />
    );

    await waitFor(() => {
      expect(getByText('Team Standup')).toBeTruthy();
      expect(getByText(/Conference Room A/i)).toBeTruthy();
    });
  });

  it('triggers onEventClick from detail card row', async () => {
    mockSupabase.from.mockReturnValue(buildQueryMock(mockEvents) as any);
    const onEventClick = jest.fn();
    const { getByText } = render(
      <CalendarWidget
        {...defaultProps}
        date={new Date(2024, 0, 15, 12, 0, 0)}
        onEventClick={onEventClick}
      />
    );

    await waitFor(() => {
      fireEvent.press(getByText('Team Standup'));
      expect(onEventClick).toHaveBeenCalledWith('event-1');
    });
  });

  it('calls onAddEventClick when add button is pressed', async () => {
    mockSupabase.from.mockReturnValue(buildQueryMock([]) as any);
    const onAddEventClick = jest.fn();
    const { getByLabelText } = render(
      <CalendarWidget {...defaultProps} onAddEventClick={onAddEventClick} />
    );

    await waitFor(() => {
      fireEvent.press(getByLabelText('Add event'));
      expect(onAddEventClick).toHaveBeenCalled();
    });
  });
});
