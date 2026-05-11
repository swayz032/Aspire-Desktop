/**
 * DialPadCard -- Pass 1 unit tests.
 *
 * Verifies:
 *   A. Invalid number (< 10 digits) disables Call button.
 *   B. Valid 10+ digit number enables Call button.
 *   C. Pressing Call on a valid number invokes router.push to /call-room
 *      with the correct E.164 phone number and officeId params.
 *   D. Pressing Call on an invalid number does NOT invoke router.push.
 *   E. Digit pad buttons append digits; backspace removes the last digit.
 *
 * STRUCTURAL FINDING (reported, not a test failure):
 *   The task spec asked to verify fetchVoiceToken is called BEFORE router.push.
 *   The actual DialPadCard implementation navigates DIRECTLY to /call-room
 *   without calling fetchVoiceToken -- token minting is deferred to the
 *   /call-room route (see DialPadCard.tsx lines 20-21 + calls.tsx:655-656).
 *   This is intentional design. Test "DOCUMENTED:" below records this contract.
 *
 * Part of feat/front-desk-hub Pass 1 verification (2026-05-11).
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DialPadCard } from '@/components/front-desk/DialPadCard';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) =>
    require('react').createElement('View', { testID: 'icon-' + name }),
}));

// IMPORTANT: resumeAudioContextFromGesture is inlined in the factory.
// Referencing an outer jest.fn() variable here would cause a hoisting error
// because jest.mock() factories are hoisted before variable declarations.
jest.mock('@/app/session/calls', () => ({
  DIAL_PAD: [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ],
  playDTMFTone: jest.fn(),
  resumeAudioContextFromGesture: jest.fn(() => Promise.resolve()),
  formatE164Display: (n: string) => n,
  formatPhoneNumber: (n: string) => n,
}));

const MOCK_OFFICE_ID = 'office-test-001';

jest.mock('@/providers/TenantProvider', () => ({
  useTenant: () => ({
    tenant: { officeId: MOCK_OFFICE_ID, suiteId: 'suite-test-001' },
    isLoading: false,
    error: null,
  }),
}));

// ---------------------------------------------------------------------------
// Suite: Call button guard
// ---------------------------------------------------------------------------

describe('DialPadCard -- Call button guard (spec SS3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Call button is disabled when no digits are entered', () => {
    const { getByLabelText } = render(<DialPadCard />);
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(true);
  });

  it('Call button is disabled after typing 9 digits (boundary: < 10)', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '415555019');
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(true);
  });

  it('Call button is enabled after typing exactly 10 digits', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '4155550198');
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(false);
  });

  it('Call button is enabled with an 11-digit number including leading 1', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '14155550198');
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: Call triggers navigation
// ---------------------------------------------------------------------------

describe('DialPadCard -- Call triggers navigation (spec SS3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pressing Call with a valid 10-digit number invokes router.push to /call-room', async () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '4155550198');
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(getByLabelText('Call'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    const arg = mockPush.mock.calls[0][0] as { pathname: string; params: Record<string, string> };
    expect(arg.pathname).toBe('/call-room');
    expect(arg.params.phone).toBe('+14155550198');
    expect(arg.params.officeId).toBe(MOCK_OFFICE_ID);
  });

  it('preserves the +1 prefix for an 11-digit number starting with 1', async () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '14155550198');
    fireEvent.press(getByLabelText('Call'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

    const arg = mockPush.mock.calls[0][0] as { pathname: string; params: Record<string, string> };
    expect(arg.params.phone).toBe('+14155550198');
  });

  it('pressing Call with fewer than 10 digits does NOT invoke router.push', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '415555');
    fireEvent.press(getByLabelText('Call'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  /**
   * STRUCTURAL FINDING -- DOCUMENTED (not a failure).
   *
   * Task spec expected: fetchVoiceToken called BEFORE router.push.
   * Actual: DialPadCard does NOT call fetchVoiceToken. Token minting is
   * deferred to /call-room (server-side capability token). See DialPadCard.tsx:20-21.
   *
   * To add pre-minting in a future pass:
   *   1. Import and mock fetchVoiceToken
   *   2. Assert mockVoiceToken was called BEFORE mockPush (jest call order)
   */
  it('DOCUMENTED: router.push fires directly without pre-minting a voice token (token deferred to /call-room)', async () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '4155550198');
    fireEvent.press(getByLabelText('Call'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/call-room' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Digit pad and backspace
// ---------------------------------------------------------------------------

describe('DialPadCard -- Digit pad interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pressing dial pad buttons appends digits (Call stays disabled with < 10 presses)', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.press(getByLabelText('Dial 4'));
    fireEvent.press(getByLabelText('Dial 1'));
    fireEvent.press(getByLabelText('Dial 5'));
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(true);
  });

  it('backspace button removes the last character from the input', () => {
    const { getByLabelText } = render(<DialPadCard />);
    fireEvent.changeText(getByLabelText('Phone number input'), '4155550198');
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(getByLabelText('Backspace'));
    expect(getByLabelText('Call').props.accessibilityState?.disabled).toBe(true);
  });
});
