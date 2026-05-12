/**
 * Front Desk Hub — consolidated mock fixtures.
 *
 * All mock data extracted from:
 *   VoicemailWorkspace, MissedWorkspace, IncomingWorkspace, OutgoingWorkspace,
 *   SmsWorkspace, ContactsWorkspace, CallbackQueueWorkspace, AllWorkspace,
 *   TodayFeed, EventDetailModal.
 *
 * Every fixture is typed against the canonical VM types in
 * components/front-desk/types.ts. Pass B will swap workspace imports to
 * reference these instead of local MOCK constants.
 */

import type {
  VoicemailVM,
  MissedCallVM,
  IncomingCallVM,
  OutgoingCallVM,
  SmsThreadVM,
  ContactVM,
  CallbackVM,
  FeedItemVM,
  EventItemVM,
  ActivityEventVM,
} from '@/components/front-desk/types';

// ---------------------------------------------------------------------------
// Voicemail mock fixtures (from VoicemailWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_VOICEMAILS: VoicemailVM[] = [
  {
    id: 'v1',
    kind: 'known',
    name: 'David Reed',
    initials: 'DR',
    avatarColor: '#A855F7',
    phone: '(617) 555-0319',
    duration: '0:46',
    time: '21m',
    preview: 'Hi this is David, calling about the porch...',
    transcript:
      'Hi this is David, calling about the porch we discussed last week. I had a quick question about the railing height — the city inspector wants 42 inches but I thought we spoke about 36. Can you give me a ring back when you get a chance? Thanks.',
    unread: true,
  },
  {
    id: 'v2',
    kind: 'known',
    name: 'Sarah Klein',
    initials: 'SK',
    avatarColor: '#10B981',
    phone: '(617) 555-0411',
    duration: '1:12',
    time: '3h',
    preview: 'Following up on the estimate you sent...',
    transcript:
      'Hey, following up on the estimate you sent over Friday. Everything looks great — we are ready to move forward. Can you send over the contract and let me know what kind of deposit you need? Talk soon.',
    unread: true,
  },
  {
    id: 'v3',
    kind: 'known',
    name: 'Carlos Rivera',
    initials: 'CR',
    avatarColor: '#EF4444',
    phone: '(617) 555-0334',
    duration: '0:33',
    time: 'Yesterday',
    preview: 'Hi, calling about the bathroom remodel quote...',
    transcript: 'Hi, calling about the bathroom remodel quote — please call me back when you can. Thanks.',
    unread: false,
  },
  {
    id: 'v4',
    kind: 'known',
    name: 'Margaret Wu',
    initials: 'MW',
    avatarColor: '#F59E0B',
    phone: '(617) 555-0744',
    duration: '2:08',
    time: '2 days',
    preview: 'Wanted to ask about scheduling for next month...',
    transcript:
      'Wanted to ask about scheduling for next month. We are looking to start the kitchen project the week of the 18th if possible. Also a question about the cabinet finish samples you mentioned. Give me a call when you get a chance.',
    unread: false,
  },
  {
    id: 'v5',
    kind: 'unknown',
    name: 'Unknown',
    initials: '??',
    avatarColor: '#6B7280',
    phone: '(978) 555-0501',
    duration: '0:18',
    time: '3 days',
    preview: 'Hi, I got your number from...',
    transcript: 'Hi, I got your number from a friend. Looking for a deck contractor. Please call me back.',
    unread: false,
  },
];

// ---------------------------------------------------------------------------
// Missed call mock fixtures (from MissedWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_MISSED_CALLS: MissedCallVM[] = [
  { id: 'm1', kind: 'known', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', attempted: 'rang 28s', time: '8m', transcript: 'No voicemail left. Caller may try again later.' },
  { id: 'm2', kind: 'unknown', name: 'Unknown', initials: '??', avatarColor: '#6B7280', phone: '(978) 555-0023', attempted: 'rang 12s', time: '2h' },
  { id: 'm3', kind: 'known', name: 'Carlos Rivera', initials: 'CR', avatarColor: '#EF4444', phone: '(617) 555-0334', attempted: 'rang 18s', time: '4h', transcript: 'Hi, calling about the bathroom remodel quote — please call back.' },
  { id: 'm4', kind: 'known', name: 'Jennifer Boyd', initials: 'JB', avatarColor: '#8B5CF6', phone: '(617) 555-0728', attempted: 'rang 32s', time: 'Yesterday' },
  { id: 'm5', kind: 'known', name: 'Steel Bros Supply', initials: 'SB', avatarColor: '#06B6D4', phone: '(617) 555-0901', attempted: 'rang 22s', time: 'Yesterday', transcript: 'Quick question about your purchase order #4421.' },
  { id: 'm6', kind: 'known', name: 'Diane Foster', initials: 'DF', avatarColor: '#EC4899', phone: '(617) 555-0612', attempted: 'rang 9s', time: '2 days' },
];

// ---------------------------------------------------------------------------
// Incoming call mock fixtures (from IncomingWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_INCOMING_CALLS: IncomingCallVM[] = [
  {
    id: 'i1',
    kind: 'known',
    name: 'John Carter',
    initials: 'JC',
    avatarColor: '#3B82F6',
    phone: '(617) 555-0721',
    duration: '4:23',
    time: '34m',
    summary: [
      'Caller is interested in a kitchen remodel quote for a 12x14 space.',
      'Budget range mentioned: $35-45k. Timeline: late summer.',
      'Asked to email project portfolio and a sample SOW.',
    ],
    transcript: [
      { side: 'them', text: 'Hi, I got your number from a neighbor — saw the work you did on their kitchen.' },
      { side: 'you', text: 'Thanks for reaching out! What kind of project are you thinking about?' },
      { side: 'them', text: 'Kitchen remodel, about 12 by 14. Looking to update everything.' },
      { side: 'you', text: 'Got it. Any sense of timeline or budget?' },
      { side: 'them', text: 'Late summer, somewhere in the 35 to 45 range.' },
    ],
  },
  {
    id: 'i2',
    kind: 'known',
    name: 'Peter Hwang',
    initials: 'PH',
    avatarColor: '#F97316',
    phone: '(617) 555-0299',
    duration: '6:08',
    time: '5h',
    summary: [
      'Existing client — calling about the deck project punch list.',
      'Reported a loose railing on the upper landing.',
      'Wants someone out by end of week.',
    ],
    transcript: [
      { side: 'them', text: 'Hey, quick punch list issue on the deck.' },
      { side: 'you', text: 'Sure, what is going on?' },
      { side: 'them', text: 'The railing on the top landing is a little loose.' },
    ],
  },
  {
    id: 'i3',
    kind: 'known',
    name: 'Linda Park',
    initials: 'LP',
    avatarColor: '#10B981',
    phone: '(617) 555-0517',
    duration: '2:54',
    time: 'Yesterday',
    summary: [
      'New lead from Yelp. Wants window replacement quote, 9 windows.',
      'Asked about energy-efficient options.',
      'Will text address for site visit.',
    ],
    transcript: [{ side: 'them', text: 'Hi, found you on Yelp. Need quotes on 9 windows.' }],
  },
  {
    id: 'i4',
    kind: 'known',
    name: 'Roy Atkins',
    initials: 'RA',
    avatarColor: '#A855F7',
    phone: '(617) 555-0388',
    duration: '1:12',
    time: 'Yesterday',
    summary: [
      'Asking about availability for a roof inspection.',
      'Insurance claim related — needs report by next Friday.',
    ],
    transcript: [{ side: 'them', text: 'Need a roof inspection report for an insurance claim.' }],
  },
  {
    id: 'i5',
    kind: 'known',
    name: 'Tara Singh',
    initials: 'TS',
    avatarColor: '#EC4899',
    phone: '(617) 555-0203',
    duration: '8:42',
    time: '2 days',
    summary: [
      'Long-time client — bathroom remodel follow-up.',
      'Approved the change order verbally; wants it emailed for signature.',
      'Mentioned a future basement finish project for next year.',
    ],
    transcript: [{ side: 'them', text: 'About that change order — looks good, send it over to sign.' }],
  },
];

// ---------------------------------------------------------------------------
// Outgoing call mock fixtures (from OutgoingWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_OUTGOING_CALLS: OutgoingCallVM[] = [
  {
    id: 'o1',
    kind: 'known',
    name: 'Coastal Roofing Supply',
    initials: 'CS',
    avatarColor: '#06B6D4',
    phone: '(617) 555-0455',
    duration: '2:11',
    time: '1h',
    transcript: [
      { side: 'you', text: 'Hey, checking on the asphalt shingle order — PO #4421.' },
      { side: 'them', text: 'Yep, ready for pickup tomorrow after 10.' },
      { side: 'you', text: 'Perfect, we will swing by around 11.' },
    ],
  },
  {
    id: 'o2',
    kind: 'known',
    name: 'Lisa Moreno',
    initials: 'LM',
    avatarColor: '#8B5CF6',
    phone: '(617) 555-0822',
    duration: '0:48',
    time: 'Yesterday',
    transcript: [
      { side: 'you', text: 'Hi Lisa, just confirming the walkthrough for tomorrow at 9.' },
      { side: 'them', text: 'Yes, see you then.' },
    ],
  },
  {
    id: 'o3',
    kind: 'known',
    name: 'Brighton Office Build',
    initials: 'BO',
    avatarColor: '#22C55E',
    phone: '(617) 555-0188',
    duration: '5:36',
    time: '2 days',
    transcript: [
      { side: 'you', text: 'Following up on the punch list — got a few questions on item 7.' },
      { side: 'them', text: 'Sure, what is up?' },
    ],
  },
  {
    id: 'o4',
    kind: 'known',
    name: 'Greg Patel',
    initials: 'GP',
    avatarColor: '#0EA5E9',
    phone: '(617) 555-0671',
    duration: '1:24',
    time: '3 days',
    transcript: [
      { side: 'you', text: 'Returning your call from earlier — what is the best time to come by?' },
      { side: 'them', text: 'Tomorrow morning works.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// SMS thread mock fixtures (from SmsWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_SMS_THREADS: SmsThreadVM[] = [
  {
    id: 't1',
    kind: 'known',
    name: 'Brighton Office Build',
    initials: 'BO',
    avatarColor: '#22C55E',
    phone: '(617) 555-0188',
    preview: "Thanks! We'll be there at 10am.",
    time: '2 min',
    unread: true,
    bubbles: [
      { id: 'b1', side: 'them', text: "Hi, can you confirm what time you'll be onsite tomorrow?", time: 'Yesterday 9:15 AM' },
      { id: 'b2', side: 'you', text: 'Hi! Yes, our team will arrive around 10am.', time: '9:16 AM', read: true },
      { id: 'b3', side: 'them', text: 'Perfect, thanks!', time: '9:17 AM' },
      { id: 'b4', side: 'them', text: 'Also, can you send over the final invoice when you have a moment?', time: 'Today 9:24 AM' },
      { id: 'b5', side: 'you', text: "Absolutely. I'll send that over right after we wrap up.", time: '9:27 AM', read: true },
      { id: 'b6', side: 'them', text: "Thanks! We'll be there at 10am.", time: '9:28 AM' },
    ],
  },
  {
    id: 't2',
    kind: 'known',
    name: 'Maria Lewis',
    initials: 'ML',
    avatarColor: '#F59E0B',
    phone: '(617) 555-0142',
    preview: 'Can you send over the access code for tomorrow morning?',
    time: '15 min',
    unread: true,
    bubbles: [
      { id: 'b1', side: 'them', text: 'Can you send over the access code for tomorrow morning?', time: '15 min ago' },
    ],
  },
  {
    id: 't3',
    kind: 'known',
    name: 'David Reed',
    initials: 'DR',
    avatarColor: '#8B5CF6',
    phone: '(617) 555-0319',
    preview: "We'll need to reschedule tomorrow's appointment.",
    time: '1 hr',
    unread: false,
    bubbles: [
      { id: 'b1', side: 'them', text: "We'll need to reschedule tomorrow's appointment.", time: '1 hr ago' },
    ],
  },
  {
    id: 't4',
    kind: 'known',
    name: 'John Carter',
    initials: 'JC',
    avatarColor: '#3B82F6',
    phone: '(617) 555-0721',
    preview: 'Perfect, thank you!',
    time: '1 hr',
    unread: false,
    bubbles: [{ id: 'b1', side: 'them', text: 'Perfect, thank you!', time: '1 hr ago' }],
  },
  {
    id: 't5',
    kind: 'known',
    name: 'Coastal Roofing Supply',
    initials: 'CS',
    avatarColor: '#06B6D4',
    phone: '(617) 555-0455',
    preview: 'When will the materials be ready for pickup?',
    time: 'Yesterday',
    unread: false,
    bubbles: [{ id: 'b1', side: 'them', text: 'When will the materials be ready for pickup?', time: 'Yesterday' }],
  },
  {
    id: 't6',
    kind: 'known',
    name: 'Amanda Hill',
    initials: 'AH',
    avatarColor: '#EC4899',
    phone: '(617) 555-0892',
    preview: 'Thanks again!',
    time: '2 days',
    unread: false,
    bubbles: [{ id: 'b1', side: 'them', text: 'Thanks again!', time: '2 days ago' }],
  },
  {
    id: 't7',
    kind: 'known',
    name: 'Michael Tan',
    initials: 'MT',
    avatarColor: '#EF4444',
    phone: '(617) 555-0608',
    preview: 'Invoice received, thank you.',
    time: '2 days',
    unread: false,
    bubbles: [{ id: 'b1', side: 'them', text: 'Invoice received, thank you.', time: '2 days ago' }],
  },
];

// ---------------------------------------------------------------------------
// Contact mock fixtures (from ContactsWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_CONTACTS: ContactVM[] = [
  { id: 'c1', name: 'Brighton Office Build', initials: 'BO', avatarColor: '#22C55E', entity: 'Client', phone: '(617) 555-0188', email: 'pm@brightonoffice.com', address: '120 Federal St, Boston, MA', lastInteractionSnippet: 'SMS · "Thanks! We will be there at 10am."', history: [{ type: 'sms', preview: 'Thanks! We will be there at 10am.', time: '2m' }, { type: 'call', preview: 'Outbound · 5:36', time: '2d' }] },
  { id: 'c2', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', entity: 'Lead', phone: '(617) 555-0142', email: 'maria.lewis@email.com', lastInteractionSnippet: 'Missed call · rang 28s', history: [{ type: 'call', preview: 'Missed · rang 28s', time: '8m' }] },
  { id: 'c3', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', entity: 'Client', phone: '(617) 555-0319', email: 'd.reed@email.com', address: '88 Oak Ave, Cambridge, MA', lastInteractionSnippet: 'Voicemail · 0:46', history: [{ type: 'voicemail', preview: 'Calling about the porch...', time: '21m' }] },
  { id: 'c4', name: 'John Carter', initials: 'JC', avatarColor: '#3B82F6', entity: 'Lead', phone: '(617) 555-0721', lastInteractionSnippet: 'Inbound · 4:23', history: [{ type: 'call', preview: 'Inbound · 4:23', time: '34m' }] },
  { id: 'c5', name: 'Amanda Hill', initials: 'AH', avatarColor: '#EC4899', entity: 'Client', phone: '(617) 555-0892', email: 'amanda@hillco.com', address: '14 Beacon St, Boston, MA', lastInteractionSnippet: 'SMS · "Thanks again!"', history: [{ type: 'sms', preview: 'Thanks again!', time: '2d' }] },
  { id: 'c6', name: 'Coastal Roofing Supply', initials: 'CS', avatarColor: '#06B6D4', entity: 'Vendor', phone: '(617) 555-0455', email: 'orders@coastalroofing.com', lastInteractionSnippet: 'Outbound · 2:11', history: [{ type: 'call', preview: 'Outbound · 2:11', time: '1h' }] },
  { id: 'c7', name: 'Michael Tan', initials: 'MT', avatarColor: '#EF4444', entity: 'Lead', phone: '(617) 555-0608', email: 'mtan@email.com', lastInteractionSnippet: 'SMS · "Invoice received, thank you."', history: [{ type: 'sms', preview: 'Invoice received, thank you.', time: '1h' }] },
  { id: 'c8', name: 'Unknown', initials: '??', avatarColor: '#6B7280', entity: 'Unknown', phone: '(978) 555-0023', lastInteractionSnippet: 'Missed call · rang 12s', history: [{ type: 'call', preview: 'Missed · rang 12s', time: '2h' }] },
  { id: 'c9', name: 'Steel Bros Supply', initials: 'SB', avatarColor: '#0EA5E9', entity: 'Vendor', phone: '(617) 555-0901', email: 'sales@steelbros.com', lastInteractionSnippet: 'Missed call · rang 22s', history: [{ type: 'call', preview: 'Missed · rang 22s', time: '1d' }] },
  { id: 'c10', name: 'Lisa Moreno', initials: 'LM', avatarColor: '#8B5CF6', entity: 'Client', phone: '(617) 555-0822', email: 'lisa.m@email.com', address: '32 Maple Dr, Somerville, MA', lastInteractionSnippet: 'Outbound · 0:48', history: [{ type: 'call', preview: 'Outbound · 0:48', time: '1d' }] },
  { id: 'c11', name: 'Greg Patel', initials: 'GP', avatarColor: '#10B981', entity: 'Lead', phone: '(617) 555-0671', lastInteractionSnippet: 'Callback scheduled', history: [{ type: 'call', preview: 'Outbound · 1:24', time: '3d' }] },
  { id: 'c12', name: 'Westwood Lumber Co', initials: 'WL', avatarColor: '#F97316', entity: 'Vendor', phone: '(617) 555-0510', email: 'pickup@westwoodlumber.com', lastInteractionSnippet: 'SMS · "Order ready for pickup."', history: [{ type: 'sms', preview: 'Order ready for pickup.', time: '5d' }] },
];

// ---------------------------------------------------------------------------
// Callback queue mock fixtures (from CallbackQueueWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_CALLBACKS: CallbackVM[] = [
  { id: 'q1', bucket: 'due_today', kind: 'known', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', promiseTime: '2:00 PM', dueLabel: 'Due in 1h', context: 'Wanted update on the kitchen quote.' },
  { id: 'q2', bucket: 'due_today', kind: 'known', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', phone: '(617) 555-0319', promiseTime: '4:30 PM', dueLabel: 'Due in 3h', context: 'Question about porch railing height.' },
  { id: 'q3', bucket: 'due_today', kind: 'known', name: 'Sarah Klein', initials: 'SK', avatarColor: '#10B981', phone: '(617) 555-0411', promiseTime: '5:00 PM', dueLabel: 'Due in 4h', context: 'Ready to sign the contract.' },
  { id: 'q4', bucket: 'overdue', kind: 'known', name: 'Carlos Rivera', initials: 'CR', avatarColor: '#EF4444', phone: '(617) 555-0334', promiseTime: 'Yesterday 3:00 PM', dueLabel: 'Overdue 23h', context: 'Bathroom remodel quote follow-up.' },
  { id: 'q5', bucket: 'overdue', kind: 'known', name: 'Margaret Wu', initials: 'MW', avatarColor: '#F97316', phone: '(617) 555-0744', promiseTime: 'Yesterday 11:00 AM', dueLabel: 'Overdue 1d 3h', context: 'Scheduling for next month kitchen project.' },
  { id: 'q6', bucket: 'scheduled', kind: 'known', name: 'Greg Patel', initials: 'GP', avatarColor: '#0EA5E9', phone: '(617) 555-0671', promiseTime: 'Tomorrow 9:00 AM', dueLabel: 'Tomorrow 9:00 AM', context: 'Site visit confirmation.' },
  { id: 'q7', bucket: 'scheduled', kind: 'known', name: 'Linda Park', initials: 'LP', avatarColor: '#10B981', phone: '(617) 555-0517', promiseTime: 'Thu 2:00 PM', dueLabel: 'Thu 2:00 PM', context: 'Window replacement quote review.' },
  { id: 'q8', bucket: 'scheduled', kind: 'known', name: 'Roy Atkins', initials: 'RA', avatarColor: '#A855F7', phone: '(617) 555-0388', promiseTime: 'Fri 10:00 AM', dueLabel: 'Fri 10:00 AM', context: 'Roof inspection report walk-through.' },
  { id: 'q9', bucket: 'scheduled', kind: 'known', name: 'Tara Singh', initials: 'TS', avatarColor: '#EC4899', phone: '(617) 555-0203', promiseTime: 'Mon 11:00 AM', dueLabel: 'Mon 11:00 AM', context: 'Basement finish kickoff discussion.' },
];

// ---------------------------------------------------------------------------
// Activity event mock fixtures (from AllWorkspace.tsx)
// ---------------------------------------------------------------------------

export const MOCK_ACTIVITY_EVENTS: ActivityEventVM[] = [
  { id: 'e1', kind: 'known', type: 'sms', name: 'Brighton Office Build', initials: 'BO', avatarColor: '#22C55E', phone: '(617) 555-0188', entity: 'Client', preview: "Thanks! We'll be there at 10am.", time: '2m' },
  { id: 'e2', kind: 'known', type: 'missed_call', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', entity: 'Lead', preview: 'Rang 28s, no voicemail', time: '8m', meta: 'rang 28s' },
  { id: 'e3', kind: 'known', type: 'voicemail', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', phone: '(617) 555-0319', entity: 'Client', preview: 'Hi this is David, calling about the porch...', time: '21m', meta: '0:46' },
  { id: 'e4', kind: 'known', type: 'incoming_call', name: 'John Carter', initials: 'JC', avatarColor: '#3B82F6', phone: '(617) 555-0721', entity: 'Lead', preview: 'Inbound · 4:23', time: '34m' },
  { id: 'e5', kind: 'known', type: 'callback', name: 'Amanda Hill', initials: 'AH', avatarColor: '#EC4899', phone: '(617) 555-0892', entity: 'Client', preview: 'Callback promised at 2:00 PM', time: '47m' },
  { id: 'e6', kind: 'known', type: 'outgoing_call', name: 'Coastal Roofing Supply', initials: 'CS', avatarColor: '#06B6D4', phone: '(617) 555-0455', entity: 'Vendor', preview: 'Outbound · 2:11', time: '1h' },
  { id: 'e7', kind: 'known', type: 'sms', name: 'Michael Tan', initials: 'MT', avatarColor: '#EF4444', phone: '(617) 555-0608', entity: 'Lead', preview: 'Invoice received, thank you.', time: '1h' },
  { id: 'e8', kind: 'unknown', type: 'missed_call', name: 'Unknown', initials: '??', avatarColor: '#6B7280', phone: '(978) 555-0023', entity: 'Unknown', preview: 'Rang 12s, no voicemail', time: '2h', meta: 'rang 12s' },
  { id: 'e9', kind: 'known', type: 'voicemail', name: 'Sarah Klein', initials: 'SK', avatarColor: '#10B981', phone: '(617) 555-0411', entity: 'Client', preview: 'Following up on the estimate you sent...', time: '3h', meta: '1:12' },
  { id: 'e10', kind: 'known', type: 'incoming_call', name: 'Peter Hwang', initials: 'PH', avatarColor: '#F97316', phone: '(617) 555-0299', entity: 'Lead', preview: 'Inbound · 6:08', time: '5h' },
  { id: 'e11', kind: 'known', type: 'outgoing_call', name: 'Lisa Moreno', initials: 'LM', avatarColor: '#8B5CF6', phone: '(617) 555-0822', entity: 'Client', preview: 'Outbound · 0:48', time: 'Yesterday' },
  { id: 'e12', kind: 'known', type: 'callback', name: 'Greg Patel', initials: 'GP', avatarColor: '#0EA5E9', phone: '(617) 555-0671', entity: 'Lead', preview: 'Callback scheduled for tomorrow 9 AM', time: 'Yesterday' },
];

// ---------------------------------------------------------------------------
// Today feed mock fixtures (from TodayFeed.tsx)
// ---------------------------------------------------------------------------

export const MOCK_FEED_ITEMS: FeedItemVM[] = [
  { id: '1', kind: 'known', name: 'John Carter', initials: 'JC', avatarColor: '#3B82F6', entity: 'Lead', type: 'missed_call', preview: 'Needs exterior quote', time: '10 min ago' },
  { id: '2', kind: 'known', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', entity: 'Client', type: 'voicemail', preview: "Hi, I'd like to get an estimate for interior painting.", time: '15 min ago' },
  { id: '3', kind: 'known', name: 'Brighton Office Build', initials: 'BO', avatarColor: '#22C55E', entity: 'Client', type: 'sms', preview: "Thanks! We'll be there at 10am.", time: '2 min ago' },
  { id: '4', kind: 'known', name: 'David Reed', initials: 'DR', avatarColor: '#8B5CF6', entity: null, type: 'callback', preview: 'Promised by 2:00 PM', time: 'Due today' },
  { id: '5', kind: 'known', name: 'Amanda Hill', initials: 'AH', avatarColor: '#EC4899', entity: 'Client', type: 'incoming_call', preview: 'Spoke for 4:23', time: '45 min ago' },
  { id: '6', kind: 'known', name: 'Michael Tan', initials: 'MT', avatarColor: '#EF4444', entity: 'Vendor', type: 'sms', preview: 'Invoice received, thank you.', time: '1 hr ago' },
  { id: '7', kind: 'known', name: 'Coastal Roofing', initials: 'CR', avatarColor: '#06B6D4', entity: 'Vendor', type: 'voicemail', preview: 'Materials ready for pickup Friday morning.', time: '2 hr ago' },
  { id: '8', kind: 'known', name: 'Sarah Mitchell', initials: 'SM', avatarColor: '#10B981', entity: 'Lead', type: 'missed_call', preview: 'Kitchen remodel inquiry', time: '3 hr ago' },
];

// ---------------------------------------------------------------------------
// EventDetailModal mock fixtures (from EventDetailModal.tsx + TodayFeed.tsx)
// EventItemVM is structurally identical to FeedItemVM — share the array.
// ---------------------------------------------------------------------------

export const MOCK_EVENT_ITEMS: EventItemVM[] = MOCK_FEED_ITEMS;
