// components/call-room/fixtures/callRoomFixtures.ts
import type { CallState, ClientContext } from '../types';

const baseHost = {
  id: 'agent_sarah',
  name: 'Sarah',
  photoUrl: null,
};

const ts = (secondsAgo: number) => Date.now() - secondsAgo * 1000;

const makeFixture = (
  label: string,
  client: ClientContext,
  overrides: Partial<CallState> = {},
): { label: string; state: CallState } => ({
  label,
  state: {
    status: 'connected',
    startedAt: ts(138), // 02:18 to match mockup
    hostAgent: baseHost,
    client,
    isMuted: false,
    isOnHold: false,
    ...overrides,
  },
});

export const callRoomFixtures = [
  makeFixture('Marcus Johnson (mockup, photo)', {
    id: 'c_marcus',
    name: 'Marcus Johnson',
    phoneE164: '+15558675309',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=440&h=440&fit=crop',
    avatarMode: 'photo',
    service: 'Roof Leak Inquiry',
    urgency: 'high',
    note: 'Concerned about ceiling damage. Wants fast response.',
  }),
  makeFixture('No-photo · 3D default male', {
    id: 'c_carl',
    name: 'Carl Diaz',
    phoneE164: '+13105550101',
    photoUrl: null,
    avatarMode: 'default_male',
    service: 'Painting Quote',
    urgency: 'medium',
    note: 'Wants exterior repaint quote for ranch home.',
  }),
  makeFixture('No-photo · 3D default female', {
    id: 'c_anita',
    name: 'Anita Lawson',
    phoneE164: '+19495550199',
    photoUrl: null,
    avatarMode: 'default_female',
    service: 'Drywall Repair',
    urgency: 'low',
    note: 'Two patches in dining room ceiling.',
  }),
  makeFixture('Initials only', {
    id: 'c_b',
    name: 'Bryan Tate',
    phoneE164: '+12015550150',
    photoUrl: null,
    avatarMode: 'initials',
    service: 'New Build Inquiry',
    urgency: 'medium',
    note: 'Needs early-Q3 timeline.',
  }),
  makeFixture('Unknown caller (spam-likely)', {
    id: 'c_unknown',
    name: null,
    phoneE164: '+18505551234',
    photoUrl: null,
    avatarMode: 'default_male',
    service: null,
    urgency: null,
    note: null,
  }),
];
