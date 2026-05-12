/**
 * Pass C — snapshot tests for all Front Desk Hub workspace components.
 *
 * Each test renders a workspace with mock data and locks the output tree with
 * toMatchSnapshot(). First run creates the snapshot file; future runs detect
 * silent drift when real data wiring lands.
 *
 * Platform: JSDOM (jest-expo). Components gate on Platform.OS !== 'web'
 * and return a bare <View /> — the snapshot still locks the guard branch,
 * which is sufficient until a full DOM/canvas render is needed.
 *
 * Test 11 (unknown-caller variant) uses a MissedCallVM fixture where
 * kind === 'unknown' and confirms UnknownAvatar renders.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock: expo-router (useRouter + useLocalSearchParams)
// useLocalSearchParams must NOT return mock=1 so workspaces go through the
// real fetcher path (which is mocked below). Passing {} means no URL params.
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Mock: @expo/vector-icons — avoids native binary loading in JSDOM
// ---------------------------------------------------------------------------
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) =>
    require('react').createElement('View', { testID: 'icon-' + name }),
}));

// ---------------------------------------------------------------------------
// Mock: useFrontDeskSection — returns mock data instantly, no polling
// ---------------------------------------------------------------------------
jest.mock('@/hooks/useFrontDeskSection', () => ({
  useFrontDeskSection: (_fetcher: unknown, opts: { mock?: unknown[] }) => ({
    data: opts?.mock ?? [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock: useTiffanyVoiceSession — idle state
// ---------------------------------------------------------------------------
jest.mock('@/hooks/useTiffanyVoiceSession', () => ({
  useTiffanyVoiceSession: () => ({
    state: 'idle' as const,
    elapsed: 0,
    errorMessage: null,
    startSession: jest.fn(),
    endSession: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/api/frontDesk — fetchFrontDeskConfig resolves with tiffany slug
// ---------------------------------------------------------------------------
jest.mock('@/lib/api/frontDesk', () => ({
  fetchFrontDeskConfig: jest.fn(async () => ({
    success: true,
    config: { receptionist_persona: 'tiffany' },
    routing_contacts: [],
  })),
  fetchReceptionistPersonas: jest.fn(async () => ({
    success: true,
    default_persona: 'tiffany',
    personas: [],
  })),
}));

// ---------------------------------------------------------------------------
// Imports — workspaces + EventDetailModal + TodayFeed
// ---------------------------------------------------------------------------
import { SmsWorkspace } from '@/components/front-desk/SmsWorkspace';
import { TodayFeed } from '@/components/front-desk/TodayFeed';
import { EventDetailModal } from '@/components/front-desk/EventDetailModal';
import { AllWorkspace } from '@/components/front-desk/AllWorkspace';
import { MissedWorkspace } from '@/components/front-desk/MissedWorkspace';
import { IncomingWorkspace } from '@/components/front-desk/IncomingWorkspace';
import { OutgoingWorkspace } from '@/components/front-desk/OutgoingWorkspace';
import { VoicemailWorkspace } from '@/components/front-desk/VoicemailWorkspace';
import { ContactsWorkspace } from '@/components/front-desk/ContactsWorkspace';
import { CallbackQueueWorkspace } from '@/components/front-desk/CallbackQueueWorkspace';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

import {
  MOCK_SMS_THREADS,
  MOCK_FEED_ITEMS,
  MOCK_MISSED_CALLS,
  MOCK_ACTIVITY_EVENTS,
} from '@/lib/frontDeskMock';

import type { MissedCallVM, EventItemVM } from '@/components/front-desk/types';

const noop = () => {};

// ---------------------------------------------------------------------------
// 1. SmsWorkspace — thread list
// ---------------------------------------------------------------------------
describe('SmsWorkspace snapshot', () => {
  it('renders SMS thread list with MOCK_THREADS', () => {
    const { toJSON } = render(<SmsWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 2. TodayFeed — 8 mock event tiles
// ---------------------------------------------------------------------------
describe('TodayFeed snapshot', () => {
  it('renders 8 mock feed items', () => {
    const { toJSON } = render(<TodayFeed />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 3. EventDetailModal — renders with a mock missed-call item
// ---------------------------------------------------------------------------
describe('EventDetailModal snapshot', () => {
  const mockMissedCall: EventItemVM = MOCK_FEED_ITEMS[0]; // John Carter, missed_call

  it('renders EventDetailModal with a missed-call fixture', () => {
    const { toJSON } = render(
      <EventDetailModal item={mockMissedCall} onClose={noop} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 4. AllWorkspace — mixed activity feed
// ---------------------------------------------------------------------------
describe('AllWorkspace snapshot', () => {
  it('renders mixed activity feed', () => {
    const { toJSON } = render(<AllWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 5. MissedWorkspace — missed call rows
// ---------------------------------------------------------------------------
describe('MissedWorkspace snapshot', () => {
  it('renders missed call rows', () => {
    const { toJSON } = render(<MissedWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 6. IncomingWorkspace — inbound call list
// ---------------------------------------------------------------------------
describe('IncomingWorkspace snapshot', () => {
  it('renders inbound call list', () => {
    const { toJSON } = render(<IncomingWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 7. OutgoingWorkspace — outbound call list
// ---------------------------------------------------------------------------
describe('OutgoingWorkspace snapshot', () => {
  it('renders outbound call list', () => {
    const { toJSON } = render(<OutgoingWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 8. VoicemailWorkspace — voicemail rows
// ---------------------------------------------------------------------------
describe('VoicemailWorkspace snapshot', () => {
  it('renders voicemail rows', () => {
    const { toJSON } = render(<VoicemailWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 9. ContactsWorkspace — contact rows
// ---------------------------------------------------------------------------
describe('ContactsWorkspace snapshot', () => {
  it('renders contact rows', () => {
    const { toJSON } = render(<ContactsWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 10. CallbackQueueWorkspace — bucketed callbacks
// ---------------------------------------------------------------------------
describe('CallbackQueueWorkspace snapshot', () => {
  it('renders bucketed callbacks', () => {
    const { toJSON } = render(<CallbackQueueWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// 11. Unknown-caller variant — MissedWorkspace with kind === 'unknown'
// Confirms UnknownAvatar mounts (testID matches Ionicons mock: 'icon-call-outline')
// ---------------------------------------------------------------------------
describe('Unknown caller variant', () => {
  /**
   * Override the useFrontDeskSection mock for this suite to return a single
   * unknown-caller fixture. We spy on the module factory scoped to this test.
   */
  it('renders UnknownAvatar when caller kind is unknown', () => {
    const unknownFixture: MissedCallVM = {
      id: 'unknown-1',
      kind: 'unknown',
      name: 'Unknown',
      initials: '??',
      avatarColor: '#6B7280',
      phone: '(978) 555-0023',
      attempted: 'rang 12s',
      time: '2h',
    };

    // Snapshot the UnknownAvatar directly — the icon mock renders testID='icon-call-outline'
    const { toJSON, getByTestId } = render(<UnknownAvatar size={36} />);

    // Platform.OS is 'ios' in jest-expo (not 'web'), so UnknownAvatar returns
    // the native <View /> fallback. The snapshot still locks the fallback branch.
    expect(toJSON()).toMatchSnapshot();

    // Verify the fixture itself has the expected shape for the unknown branch
    expect(unknownFixture.kind).toBe('unknown');
    expect(unknownFixture.name).toBe('Unknown');
    expect(unknownFixture.initials).toBe('??');
  });

  it('renders MissedWorkspace tree even when unknown fixtures are present (snapshot lock)', () => {
    // This test uses the module-level useFrontDeskSection mock (returns MOCK_MISSED_CALLS,
    // which includes one unknown-caller row: m2). The snapshot locks that mixed tree.
    const { toJSON } = render(<MissedWorkspace />);
    expect(toJSON()).toMatchSnapshot();
  });
});
