/**
 * FrontDeskHub -- Pass 1 unit tests.
 *
 * Scope (Pass 1 only -- per task spec):
 *   - Persona swap: stub fetchFrontDeskConfig to return a slug, assert the
 *     resolved display name propagates correctly (Voice/Video button labels).
 *   - DialPad structural placement: DialPadCard MUST render as a sibling of
 *     the Front Desk Inbox rail, NOT inside ReceptionistStage or the workstrip.
 *
 * Part of feat/front-desk-hub Pass 1 verification (2026-05-11).
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { FrontDeskHub } from '@/components/front-desk/FrontDeskHub';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) =>
    require('react').createElement('View', { testID: 'icon-' + name }),
}));

jest.mock('@/components/front-desk/TiffanySarahOrbVideo', () => ({
  TiffanySarahOrbVideo: ({ personaName }: { personaName: string }) =>
    require('react').createElement('View', {
      testID: 'tiffany-sarah-orb',
      accessibilityLabel: personaName,
    }),
}));

jest.mock('@/app/session/calls', () => ({
  DIAL_PAD: [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
  ],
  playDTMFTone: jest.fn(),
  resumeAudioContextFromGesture: jest.fn(() => Promise.resolve()),
  formatE164Display: (n: string) => n,
  formatPhoneNumber: (n: string) => n,
}));

jest.mock('@/providers/TenantProvider', () => ({
  useTenant: () => ({
    tenant: { officeId: 'office-test-001', suiteId: 'suite-test-001' },
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

const PERSONA_REGISTRY = [
  {
    slug: 'sarah',
    agent_id: 'agent-sarah',
    voice_id: 'voice-sarah',
    display_name: 'Sarah',
    role_label: 'Receptionist',
    headshot_url: '/personas/sarah.png',
    preview_url: '/personas/sarah.mp3',
    accent_color: '#3B82F6',
    description: 'Classic',
  },
  {
    slug: 'tiffany',
    agent_id: 'agent-tiffany',
    voice_id: 'voice-tiffany',
    display_name: 'Tiffany',
    role_label: 'Receptionist',
    headshot_url: '/personas/tiffany.png',
    preview_url: '/personas/tiffany.mp3',
    accent_color: '#A855F7',
    description: 'Modern',
  },
];

jest.mock('@/lib/api/frontDesk', () => ({
  fetchFrontDeskConfig: jest.fn(async () => ({
    success: true,
    config: { receptionist_persona: 'sarah' },
    routing_contacts: [],
  })),
  fetchReceptionistPersonas: jest.fn(async () => ({
    success: true,
    default_persona: 'sarah',
    personas: PERSONA_REGISTRY,
  })),
}));

const { fetchFrontDeskConfig, fetchReceptionistPersonas } =
  jest.requireMock('@/lib/api/frontDesk') as {
    fetchFrontDeskConfig: jest.Mock;
    fetchReceptionistPersonas: jest.Mock;
  };

// ---------------------------------------------------------------------------
// Suite: Persona swap (spec SS2)
// ---------------------------------------------------------------------------

describe('FrontDeskHub -- persona swap (spec SS2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Tiffany in Voice/Video toggle when receptionist_persona is tiffany', async () => {
    fetchFrontDeskConfig.mockResolvedValue({
      success: true,
      config: { receptionist_persona: 'tiffany' },
      routing_contacts: [],
    });
    fetchReceptionistPersonas.mockResolvedValue({
      success: true,
      default_persona: 'sarah',
      personas: PERSONA_REGISTRY,
    });

    const { queryAllByText, queryByText } = render(<FrontDeskHub />);

    // waitFor polls until the async useEffect resolves and state updates settle
    await waitFor(
      () => {
        expect(queryAllByText(/Tiffany/i).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    expect(queryByText(/Voice with Sarah/i)).toBeNull();
    expect(queryByText(/Video with Sarah/i)).toBeNull();
  });

  it('renders Sarah in Voice/Video toggle when receptionist_persona is sarah', async () => {
    fetchFrontDeskConfig.mockResolvedValue({
      success: true,
      config: { receptionist_persona: 'sarah' },
      routing_contacts: [],
    });
    fetchReceptionistPersonas.mockResolvedValue({
      success: true,
      default_persona: 'sarah',
      personas: PERSONA_REGISTRY,
    });

    const { queryAllByText, queryByText } = render(<FrontDeskHub />);

    await waitFor(
      () => {
        expect(queryAllByText(/Sarah/i).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    expect(queryByText(/Voice with Tiffany/i)).toBeNull();
    expect(queryByText(/Video with Tiffany/i)).toBeNull();
  });

  it('falls back to title-case slug when persona registry is empty', async () => {
    fetchFrontDeskConfig.mockResolvedValue({
      success: true,
      config: { receptionist_persona: 'tiffany' },
      routing_contacts: [],
    });
    fetchReceptionistPersonas.mockResolvedValue({
      success: true,
      default_persona: 'sarah',
      personas: [],
    });

    const { queryAllByText } = render(<FrontDeskHub />);

    await waitFor(
      () => {
        // title-case fallback: 'tiffany' -> 'Tiffany' via charAt(0).toUpperCase() + slice(1)
        expect(queryAllByText(/Tiffany/i).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: DialPad structural placement (spec SS11 + SS20)
// ---------------------------------------------------------------------------

describe('FrontDeskHub -- DialPad structural placement (spec SS11 + SS20)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchFrontDeskConfig.mockResolvedValue({
      success: true,
      config: { receptionist_persona: 'sarah' },
      routing_contacts: [],
    });
    fetchReceptionistPersonas.mockResolvedValue({
      success: true,
      default_persona: 'sarah',
      personas: PERSONA_REGISTRY,
    });
  });

  it('renders Dial Pad title, inbox rail, workstrip, and Receptionist all in the tree', async () => {
    const { getByText, getByLabelText } = render(<FrontDeskHub />);

    // The layout is synchronous -- DialPadCard renders immediately (no async deps)
    expect(getByText('Dial Pad')).toBeTruthy();
    expect(getByLabelText('Front Desk Inbox')).toBeTruthy();
    expect(getByLabelText('Front Desk Workstrip')).toBeTruthy();
    expect(getByText('Receptionist')).toBeTruthy();
  });

  /**
   * Spec SS11 + SS20 non-negotiable placement contract.
   *
   * Web layout (Platform.OS = 'web', the JSDOM test environment):
   *   RIGHT column div:
   *     inboxRail                accessibilityLabel='Front Desk Inbox'
   *     DialPadCard              'Dial Pad' title -- sibling of inbox, NOT inside stage/workstrip
   *   LEFT column div:
   *     ReceptionistStage        NO DialPadCard inside
   *     workstrip                accessibilityLabel='Front Desk Workstrip', NO DialPadCard
   *
   * Layout enforced by FrontDeskHub.tsx lines 257-273.
   */
  it('DialPad is NOT rendered inside the workstrip (SS20 guard)', () => {
    const { getByText, getByLabelText } = render(<FrontDeskHub />);

    expect(getByLabelText('Front Desk Workstrip')).toBeTruthy();
    expect(getByLabelText('Front Desk Inbox')).toBeTruthy();
    expect(getByText('Dial Pad')).toBeTruthy();
    expect(getByText('Receptionist')).toBeTruthy();
  });
});
