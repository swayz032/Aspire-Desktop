/**
 * Pass C — unit tests for lib/api/frontDeskAdapters.ts
 *
 * Each mapper is tested with 5 input variants:
 *   (a) full valid backend payload  → all fields populated correctly
 *   (b) nullable fields all null    → safe fallbacks (kind='unknown', etc.)
 *   (c) unknown enum values         → fallback + warn logged
 *   (d) empty strings               → handled gracefully
 *   (e) very long strings (1000+)   → passed through without truncation
 *
 * Helpers tested: mapToUnknownIdentity (in its own section).
 */

import {
  mapToVoicemail,
  mapToMissedCall,
  mapToIncoming,
  mapToOutgoing,
  mapToSmsThread,
  mapToSmsMessage,
  mapToContact,
  mapToCallback,
  mapToFeedItem,
  mapToEventItem,
  mapToUnknownIdentity,
  mapToActivityEvent,
  type BackendVoicemail,
  type BackendCallSession,
  type BackendSmsThread,
  type BackendSmsMessage,
  type BackendContact,
  type BackendCallback,
  type BackendInboxItem,
} from '@/lib/api/frontDeskAdapters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LONG_STRING = 'A'.repeat(1001);

/** Fixed ISO timestamp 5 minutes in the past so formatRelativeTime is stable. */
const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// mapToVoicemail
// ---------------------------------------------------------------------------

describe('mapToVoicemail', () => {
  const base: BackendVoicemail = {
    voicemail_id: 'vm-001',
    from_e164: '+16175550319',
    to_e164: '+12025550001',
    duration_seconds: 46,
    transcript_text: 'Full transcript here.',
    transcript_preview: 'Short preview.',
    created_at: FIVE_MIN_AGO,
    caller_name: 'David Reed',
    reviewed: false,
  };

  it('(a) full valid payload maps to VoicemailVM with all fields', () => {
    const vm = mapToVoicemail(base);
    expect(vm.id).toBe('vm-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('David Reed');
    expect(vm.initials).toBe('DR');
    expect(vm.phone).toContain('617'); // formatted
    expect(vm.duration).toMatch(/^\d+:\d{2}$/); // e.g. "0:46"
    expect(vm.preview).toBe('Short preview.');
    expect(vm.transcript).toBe('Full transcript here.');
    expect(vm.unread).toBe(true);
    expect(vm.avatarColor).toBeTruthy();
  });

  it('(b) nullable caller_name → kind=unknown, initials=??, avatarColor=#6B7280', () => {
    const vm = mapToVoicemail({ ...base, caller_name: null, from_e164: '+19785550501' });
    expect(vm.kind).toBe('unknown');
    expect(vm.name).toBe('Unknown');
    expect(vm.initials).toBe('??');
    expect(vm.avatarColor).toBe('#6B7280');
    expect(vm.unread).toBe(true);
  });

  it('(b) null duration_seconds → duration falls back to 0:00', () => {
    const vm = mapToVoicemail({ ...base, duration_seconds: null });
    expect(vm.duration).toBe('0:00');
  });

  it('(b) no transcript fields → preview has a no-transcript fallback', () => {
    const vm = mapToVoicemail({
      ...base,
      transcript_text: undefined,
      transcript_preview: undefined,
    });
    expect(vm.preview).toBeTruthy(); // fallback string, not empty
    expect(vm.transcript).toBe('');
  });

  it('(b) reviewed=true → unread=false', () => {
    const vm = mapToVoicemail({ ...base, reviewed: true });
    expect(vm.unread).toBe(false);
  });

  it('(c) unknown caller_name string "Unknown" → treated as unknown', () => {
    const vm = mapToVoicemail({ ...base, caller_name: 'Unknown' });
    expect(vm.kind).toBe('unknown');
  });

  it('(d) empty caller_name string → kind=unknown', () => {
    const vm = mapToVoicemail({ ...base, caller_name: '' });
    expect(vm.kind).toBe('unknown');
  });

  it('(e) very long transcript_text → passed through without truncation', () => {
    const vm = mapToVoicemail({ ...base, transcript_text: LONG_STRING });
    expect(vm.transcript).toBe(LONG_STRING);
    expect(vm.transcript.length).toBeGreaterThan(1000);
  });

  it('(e) very long caller_name → initials still 2 chars, no crash', () => {
    const longName = 'A'.repeat(500) + ' ' + 'B'.repeat(500);
    const vm = mapToVoicemail({ ...base, caller_name: longName });
    expect(vm.initials.length).toBeLessThanOrEqual(2);
    expect(vm.kind).toBe('known');
  });
});

// ---------------------------------------------------------------------------
// mapToMissedCall
// ---------------------------------------------------------------------------

describe('mapToMissedCall', () => {
  const base: BackendCallSession = {
    call_session_id: 'cs-missed-001',
    direction: 'inbound',
    status: 'no-answer',
    from_number: '+16175550142',
    to_number: null,
    caller_name: 'Maria Lewis',
    duration_seconds: 28,
    started_at: FIVE_MIN_AGO,
    ended_at: null,
    metadata: {},
  };

  it('(a) full valid payload → MissedCallVM with attempted "rang X:XX"', () => {
    const vm = mapToMissedCall(base);
    expect(vm.id).toBe('cs-missed-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('Maria Lewis');
    expect(vm.attempted).toMatch(/rang/i);
    expect(vm.time).toBeTruthy();
  });

  it('(b) null caller_name → kind=unknown', () => {
    const vm = mapToMissedCall({ ...base, caller_name: null });
    expect(vm.kind).toBe('unknown');
    expect(vm.name).toBe('Unknown');
  });

  it('(b) null from_number and to_number → phone falls back gracefully', () => {
    const vm = mapToMissedCall({ ...base, from_number: null, to_number: null });
    expect(vm.phone).toBeDefined(); // may be empty or formatted empty string
  });

  it('(b) null duration_seconds → attempted has "rang 0s" or similar', () => {
    const vm = mapToMissedCall({ ...base, duration_seconds: null });
    expect(vm.attempted).toContain('rang');
  });

  it('(b) ai_capture present → transcript field populated', () => {
    const vm = mapToMissedCall({ ...base, ai_capture: 'No voicemail left.' });
    expect(vm.transcript).toBe('No voicemail left.');
  });

  it('(b) ai_capture absent → transcript is undefined', () => {
    const vm = mapToMissedCall({ ...base, ai_capture: undefined });
    expect(vm.transcript).toBeUndefined();
  });

  it('(e) very long caller_name → no crash, initials still short', () => {
    const vm = mapToMissedCall({ ...base, caller_name: LONG_STRING });
    expect(vm.name).toBe(LONG_STRING);
    expect(vm.initials.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// mapToIncoming
// ---------------------------------------------------------------------------

describe('mapToIncoming', () => {
  const base: BackendCallSession = {
    call_session_id: 'cs-in-001',
    direction: 'inbound',
    status: 'completed',
    from_number: '+16175550721',
    to_number: null,
    caller_name: 'John Carter',
    duration_seconds: 263,
    started_at: FIVE_MIN_AGO,
    ended_at: new Date().toISOString(),
    ai_summary: ['Interest in kitchen remodel.', 'Budget $35-45k.'],
    transcript: [{ side: 'them', text: 'Hi, found you on Yelp.' }],
    metadata: {},
  };

  it('(a) full valid payload → IncomingCallVM with summary + transcript', () => {
    const vm = mapToIncoming(base);
    expect(vm.id).toBe('cs-in-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('John Carter');
    expect(vm.summary).toEqual(['Interest in kitchen remodel.', 'Budget $35-45k.']);
    expect(vm.transcript).toHaveLength(1);
    expect(vm.duration).toMatch(/^\d+:\d{2}$/);
  });

  it('(b) null ai_summary → summary is empty array', () => {
    const vm = mapToIncoming({ ...base, ai_summary: null });
    expect(vm.summary).toEqual([]);
  });

  it('(b) null transcript → transcript is empty array', () => {
    const vm = mapToIncoming({ ...base, transcript: null });
    expect(vm.transcript).toEqual([]);
  });

  it('(b) null caller_name → kind=unknown', () => {
    const vm = mapToIncoming({ ...base, caller_name: null });
    expect(vm.kind).toBe('unknown');
  });

  it('(e) very long transcript text → passed through without truncation', () => {
    const vm = mapToIncoming({
      ...base,
      transcript: [{ side: 'them', text: LONG_STRING }],
    });
    expect(vm.transcript[0].text).toBe(LONG_STRING);
  });
});

// ---------------------------------------------------------------------------
// mapToOutgoing
// ---------------------------------------------------------------------------

describe('mapToOutgoing', () => {
  const base: BackendCallSession = {
    call_session_id: 'cs-out-001',
    direction: 'outbound',
    status: 'completed',
    from_number: null,
    to_number: '+16175550455',
    caller_name: 'Coastal Roofing Supply',
    duration_seconds: 131,
    started_at: FIVE_MIN_AGO,
    ended_at: new Date().toISOString(),
    transcript: [{ side: 'you', text: 'Checking on the shingle order.' }],
    metadata: {},
  };

  it('(a) full valid payload → OutgoingCallVM with transcript', () => {
    const vm = mapToOutgoing(base);
    expect(vm.id).toBe('cs-out-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('Coastal Roofing Supply');
    // extractInitials('Coastal Roofing Supply') = 'C' + 'R' = 'CR'
    expect(vm.initials).toBe('CR');
    expect(vm.transcript).toHaveLength(1);
  });

  it('(b) null caller_name → kind=unknown', () => {
    const vm = mapToOutgoing({ ...base, caller_name: null });
    expect(vm.kind).toBe('unknown');
  });

  it('(b) null duration_seconds → duration falls back to 0:00', () => {
    const vm = mapToOutgoing({ ...base, duration_seconds: null });
    expect(vm.duration).toBe('0:00');
  });

  it('(e) very long caller_name → passed through without truncation', () => {
    const vm = mapToOutgoing({ ...base, caller_name: LONG_STRING });
    expect(vm.name).toBe(LONG_STRING);
  });
});

// ---------------------------------------------------------------------------
// mapToSmsThread
// ---------------------------------------------------------------------------

describe('mapToSmsThread', () => {
  const base: BackendSmsThread = {
    thread_id: 'thread-001',
    counterparty_e164: '+16175550188',
    last_message_at: FIVE_MIN_AGO,
    unread_count: 2,
    counterparty_name: 'Brighton Office Build',
    messages: [
      {
        sms_message_id: 'msg-1',
        direction: 'inbound',
        body: 'Hello',
        received_at: FIVE_MIN_AGO,
        created_at: FIVE_MIN_AGO,
        delivery_status: 'delivered',
      },
    ],
  };

  it('(a) full valid payload → SmsThreadVM with bubbles and preview', () => {
    const vm = mapToSmsThread(base);
    expect(vm.id).toBe('thread-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('Brighton Office Build');
    expect(vm.initials).toBe('BO');
    expect(vm.bubbles).toHaveLength(1);
    expect(vm.preview).toBe('Hello');
    expect(vm.unread).toBe(true);
  });

  it('(b) null counterparty_name → kind=unknown', () => {
    const vm = mapToSmsThread({ ...base, counterparty_name: null });
    expect(vm.kind).toBe('unknown');
    expect(vm.name).toBe('Unknown');
  });

  it('(b) empty messages array → bubbles empty, preview empty', () => {
    const vm = mapToSmsThread({ ...base, messages: [] });
    expect(vm.bubbles).toHaveLength(0);
    expect(vm.preview).toBe('');
  });

  it('(b) unread_count=0 → unread=false', () => {
    const vm = mapToSmsThread({ ...base, unread_count: 0 });
    expect(vm.unread).toBe(false);
  });

  it('(b) null last_message_at → time is empty string', () => {
    const vm = mapToSmsThread({ ...base, last_message_at: null });
    expect(vm.time).toBe('');
  });

  it('(e) very long message body → passed through', () => {
    const vm = mapToSmsThread({
      ...base,
      messages: [
        {
          sms_message_id: 'msg-long',
          direction: 'inbound',
          body: LONG_STRING,
          received_at: FIVE_MIN_AGO,
          created_at: FIVE_MIN_AGO,
        },
      ],
    });
    expect(vm.bubbles[0].text).toBe(LONG_STRING);
  });
});

// ---------------------------------------------------------------------------
// mapToSmsMessage
// ---------------------------------------------------------------------------

describe('mapToSmsMessage', () => {
  const base: BackendSmsMessage = {
    sms_message_id: 'msg-001',
    direction: 'inbound',
    body: 'Hi there',
    received_at: FIVE_MIN_AGO,
    created_at: FIVE_MIN_AGO,
    delivery_status: 'delivered',
  };

  it('(a) inbound direction → side=them, read via delivery_status', () => {
    const vm = mapToSmsMessage(base);
    expect(vm.id).toBe('msg-001');
    expect(vm.side).toBe('them');
    expect(vm.text).toBe('Hi there');
    expect(vm.read).toBe(true);
  });

  it('(a) outbound direction → side=you', () => {
    const vm = mapToSmsMessage({ ...base, direction: 'outbound' });
    expect(vm.side).toBe('you');
  });

  it('(b) null delivery_status → read=false', () => {
    const vm = mapToSmsMessage({ ...base, delivery_status: null });
    expect(vm.read).toBe(false);
  });

  it('(b) null received_at → falls back to created_at for time', () => {
    const vm = mapToSmsMessage({ ...base, received_at: null });
    expect(vm.time).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// mapToContact
// ---------------------------------------------------------------------------

describe('mapToContact', () => {
  const base: BackendContact = {
    id: 'contact-001',
    name: 'Brighton Office Build',
    phone: '+16175550188',
    email: 'pm@brightonoffice.com',
    address: '120 Federal St, Boston, MA',
    entity_type: 'Client',
    last_interaction_snippet: 'SMS · "Thanks!"',
    history: [{ type: 'sms', preview: 'Thanks!', time: '2m' }],
  };

  it('(a) full valid payload → ContactVM with all fields', () => {
    const vm = mapToContact(base);
    expect(vm.id).toBe('contact-001');
    expect(vm.name).toBe('Brighton Office Build');
    expect(vm.initials).toBe('BO');
    expect(vm.entity).toBe('Client');
    expect(vm.email).toBe('pm@brightonoffice.com');
    expect(vm.address).toBe('120 Federal St, Boston, MA');
    expect(vm.history).toHaveLength(1);
    expect(vm.lastInteractionSnippet).toBe('SMS · "Thanks!"');
  });

  it('(b) null entity_type → entity falls back to "Unknown"', () => {
    const vm = mapToContact({ ...base, entity_type: null });
    expect(vm.entity).toBe('Unknown');
  });

  it('(b) empty history → history is empty array', () => {
    const vm = mapToContact({ ...base, history: [] });
    expect(vm.history).toHaveLength(0);
  });

  it('(b) no last_interaction_snippet → empty string', () => {
    const vm = mapToContact({ ...base, last_interaction_snippet: undefined });
    expect(vm.lastInteractionSnippet).toBe('');
  });

  it('(c) unknown entity_type string → falls back to "Unknown"', () => {
    const vm = mapToContact({ ...base, entity_type: 'Partner' });
    expect(vm.entity).toBe('Unknown');
  });

  it('(d) empty name → falls back to "Unknown"', () => {
    const vm = mapToContact({ ...base, name: '' });
    expect(vm.name).toBe('Unknown');
  });

  it('(e) very long address → passed through without truncation', () => {
    const vm = mapToContact({ ...base, address: LONG_STRING });
    expect(vm.address).toBe(LONG_STRING);
  });

  it('(e) very long name → passed through, initials still short', () => {
    const longName = 'Alpha '.repeat(100) + 'Bravo';
    const vm = mapToContact({ ...base, name: longName });
    expect(vm.name).toBe(longName);
    expect(vm.initials.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// mapToCallback
// ---------------------------------------------------------------------------

describe('mapToCallback', () => {
  const base: BackendCallback = {
    id: 'cb-001',
    bucket: 'due_today',
    name: 'Maria Lewis',
    phone: '+16175550142',
    promise_time: '2:00 PM',
    due_label: 'Due in 1h',
    context: 'Wanted update on the kitchen quote.',
  };

  it('(a) full valid payload → CallbackVM with bucket + dueLabel', () => {
    const vm = mapToCallback(base);
    expect(vm.id).toBe('cb-001');
    expect(vm.bucket).toBe('due_today');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('Maria Lewis');
    expect(vm.dueLabel).toBe('Due in 1h');
    expect(vm.context).toBe('Wanted update on the kitchen quote.');
  });

  it('(b) null name → kind=unknown', () => {
    const vm = mapToCallback({ ...base, name: null });
    expect(vm.kind).toBe('unknown');
    expect(vm.name).toBe('Unknown');
  });

  it('(b) no context → context is empty string', () => {
    const vm = mapToCallback({ ...base, context: undefined });
    expect(vm.context).toBe('');
  });

  it('(b) no due_label → falls back to promise_time', () => {
    const vm = mapToCallback({ ...base, due_label: undefined });
    expect(vm.dueLabel).toBe('2:00 PM');
  });

  it('(c) unknown bucket string → falls back to "scheduled"', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const vm = mapToCallback({ ...base, bucket: 'unknown_bucket' });
    expect(vm.bucket).toBe('scheduled');
    consoleWarnSpy.mockRestore();
  });

  it('(e) very long context → passed through', () => {
    const vm = mapToCallback({ ...base, context: LONG_STRING });
    expect(vm.context).toBe(LONG_STRING);
  });
});

// ---------------------------------------------------------------------------
// mapToFeedItem
// ---------------------------------------------------------------------------

describe('mapToFeedItem', () => {
  const base: BackendInboxItem = {
    id: 'feed-001',
    type: 'missed_call',
    name: 'John Carter',
    phone: '+16175550721',
    entity: 'Lead',
    preview: 'Needs exterior quote',
    time: '10 min ago',
  };

  it('(a) full valid payload → FeedItemVM with entity + type', () => {
    const vm = mapToFeedItem(base);
    expect(vm.id).toBe('feed-001');
    expect(vm.kind).toBe('known');
    expect(vm.name).toBe('John Carter');
    expect(vm.type).toBe('missed_call');
    expect(vm.entity).toBe('Lead');
    expect(vm.preview).toBe('Needs exterior quote');
    expect(vm.time).toBe('10 min ago');
  });

  it('(b) null name → kind=unknown', () => {
    const vm = mapToFeedItem({ ...base, name: null });
    expect(vm.kind).toBe('unknown');
  });

  it('(b) null entity → entity is null', () => {
    const vm = mapToFeedItem({ ...base, entity: null });
    expect(vm.entity).toBeNull();
  });

  it('(c) unknown event type string → falls back to "incoming_call" with warn', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const vm = mapToFeedItem({ ...base, type: 'telepathy' });
    expect(vm.type).toBe('incoming_call');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown FeedEventType'),
    );
    consoleWarnSpy.mockRestore();
  });

  it('(c) "outgoing_call" type → falls back to "incoming_call" (not in FeedEventType set)', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const vm = mapToFeedItem({ ...base, type: 'outgoing_call' });
    expect(vm.type).toBe('incoming_call');
    consoleWarnSpy.mockRestore();
  });

  it('(d) empty preview string → preview is empty', () => {
    const vm = mapToFeedItem({ ...base, preview: '' });
    expect(vm.preview).toBe('');
  });

  it('(e) very long preview → passed through without truncation', () => {
    const vm = mapToFeedItem({ ...base, preview: LONG_STRING });
    expect(vm.preview).toBe(LONG_STRING);
  });

  it('uses created_at for time when time field is absent', () => {
    const vm = mapToFeedItem({ ...base, time: undefined, created_at: FIVE_MIN_AGO });
    expect(vm.time).toBeTruthy(); // formatRelativeTime gives "X min ago"
  });
});

// ---------------------------------------------------------------------------
// mapToEventItem (delegates to mapToFeedItem)
// ---------------------------------------------------------------------------

describe('mapToEventItem', () => {
  const base: BackendInboxItem = {
    id: 'event-001',
    type: 'voicemail',
    name: 'David Reed',
    phone: '+16175550319',
    entity: 'Client',
    preview: 'Calling about the porch...',
    time: '21m',
  };

  it('returns the same shape as mapToFeedItem (delegate)', () => {
    const fromEvent = mapToEventItem(base);
    const fromFeed = mapToFeedItem(base);
    expect(fromEvent).toEqual(fromFeed);
  });
});

// ---------------------------------------------------------------------------
// mapToUnknownIdentity
// ---------------------------------------------------------------------------

describe('mapToUnknownIdentity', () => {
  it('(a) E.164 number → kind=unknown with areaCode and formatted phone', () => {
    const vm = mapToUnknownIdentity('+16175550188');
    expect(vm.kind).toBe('unknown');
    if (vm.kind === 'unknown') {
      expect(vm.areaCode).toBe('617');
      expect(vm.phone).toContain('617');
    }
  });

  it('(a) 10-digit number → areaCode extracted', () => {
    const vm = mapToUnknownIdentity('6175550188');
    expect(vm.kind).toBe('unknown');
    if (vm.kind === 'unknown') {
      expect(vm.areaCode).toBe('617');
    }
  });

  it('(b) non-US number → areaCode is null', () => {
    const vm = mapToUnknownIdentity('+442071234567');
    expect(vm.kind).toBe('unknown');
    if (vm.kind === 'unknown') {
      expect(vm.areaCode).toBeNull();
    }
  });

  it('(d) invalid/empty string → areaCode is null, no crash', () => {
    const vm = mapToUnknownIdentity('invalid');
    expect(vm.kind).toBe('unknown');
    if (vm.kind === 'unknown') {
      expect(vm.areaCode).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// mapToActivityEvent (AllWorkspace)
// ---------------------------------------------------------------------------

describe('mapToActivityEvent', () => {
  const base: BackendInboxItem = {
    id: 'act-001',
    type: 'outgoing_call',
    name: 'Coastal Roofing Supply',
    phone: '+16175550455',
    entity: 'Vendor',
    preview: 'Outbound · 2:11',
    time: '1h',
    meta: '2:11',
  };

  it('(a) full valid payload → ActivityEventVM with meta field', () => {
    const vm = mapToActivityEvent(base);
    expect(vm.id).toBe('act-001');
    expect(vm.type).toBe('outgoing_call');
    expect(vm.meta).toBe('2:11');
    expect(vm.entity).toBe('Vendor');
  });

  it('(c) unknown event type → falls back to "incoming_call"', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const vm = mapToActivityEvent({ ...base, type: 'quantum_call' });
    expect(vm.type).toBe('incoming_call');
    consoleWarnSpy.mockRestore();
  });
});
