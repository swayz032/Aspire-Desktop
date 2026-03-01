/**
 * RedAuthorityModal.test.tsx -- Unit tests for RED tier authority modal
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { RedAuthorityModal } from '../RedAuthorityModal';
import {
  submitAction,
  resetActionBus,
  setFetchFn,
  generateActionId,
  type CanvasAction,
} from '@/lib/canvasActionBus';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/canvasTelemetry', () => ({
  emitCanvasEvent: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default = {
    ...Reanimated.default,
    View: require('react-native').View,
  };
  return Reanimated;
});

jest.mock('@/components/icons/ui/ShieldAlertIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    ShieldAlertIcon: (props: { size: number; color: string }) =>
      R.createElement(RN.View, {
        testID: 'shield-alert-icon',
        accessibilityLabel: `shield-alert-${props.size}-${props.color}`,
      }),
  };
});

jest.mock('@/components/icons/ui/CloseIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    CloseIcon: (props: { size: number; color: string }) =>
      R.createElement(RN.View, { testID: 'close-icon' }),
  };
});

jest.mock('@/components/icons/ui/LockIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    LockIcon: (props: { size: number; color: string }) =>
      R.createElement(RN.View, { testID: 'lock-icon' }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRedAction(overrides: Partial<CanvasAction> = {}): CanvasAction {
  return {
    id: generateActionId(),
    type: 'payment.send',
    widgetId: 'payment-widget',
    riskTier: 'RED',
    payload: { amount: 500000, currency: 'USD', recipient: 'vendor@example.com' },
    suiteId: 'suite-123',
    officeId: 'office-456',
    actorId: 'user-789',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockFetch(
  data: Record<string, unknown> = { receipt_id: 'rcp-red-001' },
  status = 200,
): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedAuthorityModal', () => {
  beforeEach(() => {
    resetActionBus();
    setFetchFn(createMockFetch());
  });

  afterEach(() => {
    resetActionBus();
  });

  it('renders nothing when no action is pending', () => {
    const { toJSON } = render(<RedAuthorityModal />);
    expect(toJSON()).toBeNull();
  });

  it('renders modal when RED action is submitted', async () => {
    const { getByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      expect(getByText('Authority Required')).toBeTruthy();
    });
  });

  it('displays warning banner', async () => {
    const { getByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      expect(getByText(/WARNING.*irreversible/i)).toBeTruthy();
    });
  });

  it('displays RED risk chip', async () => {
    const { getByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      expect(getByText('RED')).toBeTruthy();
    });
  });

  it('displays action type label', async () => {
    const { getByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction({ type: 'payment.send' }));
    });

    await waitFor(() => {
      expect(getByText('Send Payment')).toBeTruthy();
    });
  });

  it('displays authorization input', async () => {
    const { getByLabelText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      expect(
        getByLabelText('Type I APPROVE to authorize this action'),
      ).toBeTruthy();
    });
  });

  it('authorize button is disabled by default', async () => {
    const { getByLabelText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      const button = getByLabelText('Authorize action');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  it('authorize button becomes enabled when I APPROVE is typed', async () => {
    const { getByLabelText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      const input = getByLabelText(
        'Type I APPROVE to authorize this action',
      );
      fireEvent.changeText(input, 'I APPROVE');
    });

    await waitFor(() => {
      const button = getByLabelText('Authorize action');
      // When text is valid, disabled should be falsy
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it('displays immutable receipt note', async () => {
    const { getByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(createRedAction());
    });

    await waitFor(() => {
      expect(
        getByText('An immutable receipt will be generated for audit.'),
      ).toBeTruthy();
    });
  });

  it('redacts sensitive payload fields', async () => {
    const { queryByText } = render(<RedAuthorityModal />);

    act(() => {
      submitAction(
        createRedAction({
          payload: {
            amount: 500000,
            card_number: '4111-1111-1111-1111',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(queryByText(/4111-1111/)).toBeNull();
    });
  });
});
