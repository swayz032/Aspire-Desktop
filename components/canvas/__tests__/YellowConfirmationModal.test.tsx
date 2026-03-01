/**
 * YellowConfirmationModal.test.tsx -- Unit tests for YELLOW tier modal
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { YellowConfirmationModal } from '../YellowConfirmationModal';
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

jest.mock('@/components/icons/ui/WarningTriangleIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    WarningTriangleIcon: (props: { size: number; color: string }) =>
      R.createElement(RN.View, {
        testID: 'warning-triangle-icon',
        accessibilityLabel: `warning-icon-${props.size}-${props.color}`,
      }),
  };
});

jest.mock('@/components/icons/ui/CloseIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    CloseIcon: (props: { size: number; color: string }) =>
      R.createElement(RN.View, {
        testID: 'close-icon',
      }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestAction(overrides: Partial<CanvasAction> = {}): CanvasAction {
  return {
    id: generateActionId(),
    type: 'email.send',
    widgetId: 'email-widget',
    riskTier: 'YELLOW',
    payload: { to: 'test@example.com', subject: 'Test Email' },
    suiteId: 'suite-123',
    officeId: 'office-456',
    actorId: 'user-789',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createMockFetch(
  data: Record<string, unknown> = { receipt_id: 'rcp-001' },
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

describe('YellowConfirmationModal', () => {
  beforeEach(() => {
    resetActionBus();
    setFetchFn(createMockFetch());
  });

  afterEach(() => {
    resetActionBus();
  });

  it('renders nothing when no action is pending', () => {
    const { toJSON } = render(<YellowConfirmationModal />);
    expect(toJSON()).toBeNull();
  });

  it('renders modal when YELLOW action is submitted', async () => {
    const { getByText, queryByText } = render(<YellowConfirmationModal />);

    // Initially empty
    expect(queryByText('Confirmation Required')).toBeNull();

    // Submit YELLOW action (don't await -- it waits for user approval)
    const action = createTestAction();
    act(() => {
      submitAction(action);
    });

    await waitFor(() => {
      expect(getByText('Confirmation Required')).toBeTruthy();
    });
  });

  it('displays action type label', async () => {
    const { getByText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(createTestAction({ type: 'email.send' }));
    });

    await waitFor(() => {
      expect(getByText('Send Email')).toBeTruthy();
    });
  });

  it('displays YELLOW risk chip', async () => {
    const { getByText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(createTestAction());
    });

    await waitFor(() => {
      expect(getByText('YELLOW')).toBeTruthy();
    });
  });

  it('displays receipt generation note', async () => {
    const { getByText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(createTestAction());
    });

    await waitFor(() => {
      expect(getByText('A receipt will be generated upon completion.')).toBeTruthy();
    });
  });

  it('has accessible approve button', async () => {
    const { getByLabelText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(createTestAction());
    });

    await waitFor(() => {
      expect(getByLabelText('Approve action')).toBeTruthy();
    });
  });

  it('has accessible cancel button', async () => {
    const { getByLabelText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(createTestAction());
    });

    await waitFor(() => {
      expect(getByLabelText('Cancel action')).toBeTruthy();
    });
  });

  it('redacts sensitive payload fields', async () => {
    const { queryByText } = render(<YellowConfirmationModal />);

    act(() => {
      submitAction(
        createTestAction({
          payload: {
            to: 'test@example.com',
            api_token: 'secret-value',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(queryByText(/secret-value/)).toBeNull();
    });
  });
});
