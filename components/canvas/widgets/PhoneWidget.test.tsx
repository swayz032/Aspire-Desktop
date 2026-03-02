import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PhoneWidget } from './PhoneWidget';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

let mockHookState: {
  calls: any[];
  loading: boolean;
  error: string | null;
} = {
  calls: [],
  loading: true,
  error: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/hooks/useFrontdeskCalls', () => ({
  useFrontdeskCalls: () => ({
    calls: mockHookState.calls,
    loading: mockHookState.loading,
    error: mockHookState.error,
    refresh: mockRefresh,
  }),
}));

describe('PhoneWidget', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockHookState = {
      calls: [],
      loading: true,
      error: null,
    };
  });

  it('renders loading state in Recent tab', () => {
    const { getByText } = render(<PhoneWidget suiteId="suite-1" officeId="office-1" />);
    fireEvent.press(getByText('Recent'));
    expect(getByText('Loading calls...')).toBeTruthy();
  });

  it('accepts keypad input', () => {
    mockHookState.loading = false;
    const { getByText, getByDisplayValue } = render(<PhoneWidget suiteId="suite-1" officeId="office-1" />);
    fireEvent.press(getByText('1'));
    expect(getByDisplayValue('1')).toBeTruthy();
  });

  it('navigates to calls page on expand', () => {
    mockHookState.loading = false;
    const { getByText } = render(<PhoneWidget suiteId="suite-1" officeId="office-1" />);
    fireEvent.press(getByText('Expand'));
    expect(mockPush).toHaveBeenCalledWith('/session/calls');
  });
});
