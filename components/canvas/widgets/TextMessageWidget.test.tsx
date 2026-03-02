import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TextMessageWidget } from './TextMessageWidget';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

let mockThreadsState: {
  threads: any[];
  loading: boolean;
  error: string | null;
} = {
  threads: [],
  loading: true,
  error: null,
};

let mockMessagesState: {
  messages: any[];
  loading: boolean;
  error: string | null;
} = {
  messages: [],
  loading: false,
  error: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, null, props.name),
  };
});

jest.mock('@/hooks/useSmsThreads', () => ({
  useSmsThreads: () => ({
    threads: mockThreadsState.threads,
    loading: mockThreadsState.loading,
    error: mockThreadsState.error,
  }),
  useSmsMessages: () => ({
    messages: mockMessagesState.messages,
    loading: mockMessagesState.loading,
    error: mockMessagesState.error,
    refresh: mockRefresh,
  }),
}));

describe('TextMessageWidget', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockThreadsState = { threads: [], loading: true, error: null };
    mockMessagesState = { messages: [], loading: false, error: null };
  });

  it('renders loading state when threads are loading', () => {
    const { getByText } = render(<TextMessageWidget suiteId="suite-1" officeId="office-1" />);
    expect(getByText('Loading threads...')).toBeTruthy();
  });

  it('opens a thread when selected', () => {
    mockThreadsState = {
      loading: false,
      error: null,
      threads: [
        {
          thread_id: 'thread-1',
          counterparty_e164: '+15551234567',
          last_message_at: new Date().toISOString(),
          unread_count: 2,
        },
      ],
    };
    mockMessagesState = {
      loading: false,
      error: null,
      messages: [
        {
          sms_message_id: 'msg-1',
          direction: 'inbound',
          body: 'Hello there',
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          delivery_status: null,
        },
      ],
    };

    const { getByText, queryByPlaceholderText, getByPlaceholderText } = render(<TextMessageWidget suiteId="suite-1" officeId="office-1" />);
    expect(queryByPlaceholderText('Type message')).toBeFalsy();
    fireEvent.press(getByText('+1 (555) 123-4567'));
    expect(getByPlaceholderText('Type message')).toBeTruthy();
    expect(getByText('Hello there')).toBeTruthy();
  });

  it('navigates to messages page on expand', () => {
    mockThreadsState.loading = false;
    const { getByText } = render(<TextMessageWidget suiteId="suite-1" officeId="office-1" />);
    fireEvent.press(getByText('Expand'));
    expect(mockPush).toHaveBeenCalledWith('/session/messages');
  });
});
