/**
 * Messages page fixtures (plan §3.9 + Lane E7).
 *
 * Used by:
 *   1. `components/messages/*.demo.tsx`        (visual + Framer-fidelity review)
 *   2. `app/demo/messages.tsx` 5-state cycle   (Lane E7)
 *
 * Shape mirrors `GET /v1/messages/threads` payload from Lane E1 plan §3.9.9
 * exactly so swapping fixtures for live data is a one-line change. The
 * `app/session/messages.tsx` page reads through `useMessageThreads`
 * (lib/messages) at runtime — these fixtures are only consumed offline.
 *
 * Five threads cover the realistic V1 surface:
 *   1. Unread, routing-contact (owner)         — primary demo case, Ava-glow
 *   2. Read, recent SMS contact (Acme)          — common state, no role
 *   3. Pinned, routing-contact (scheduling)     — pin badge, role pill
 *   4. Archived, old thread                     — muted, archive state
 *   5. Manual E.164, no name resolution         — fallback formatting case
 */
import type { ThreadMessage } from './MessagesThreadView';
import type { ContactSearchResult } from './ContactAutocomplete';
import type { MessageSuggestion } from './MessagesSuggestedActions';
import type { MessageTemplate } from './MessageTemplatePicker';
import type {
  ContactsSidePanelData,
  SidePanelContact,
} from './ContactsSidePanel';

// ---------------------------------------------------------------------------
// Types — kept here (not in `types/`) so this file is self-contained and
// can be removed verbatim once Lane E6 lands real types.
// ---------------------------------------------------------------------------

/** Routing role from `front_desk_routing_contacts.role` enum (plan §3.9.6). */
export type RoutingRole =
  | 'owner'
  | 'sales'
  | 'support'
  | 'billing'
  | 'scheduling';

/** Last sender of the latest message in the thread (plan §3.9.3). */
export type LastDrafter = 'owner' | 'sarah' | 'ava' | 'contact';

/** Thread row shape returned by `GET /v1/messages/threads`. */
export interface MessageThreadSummary {
  thread_id: string;
  contact_name: string;
  contact_phone: string;
  /** First-line preview, single line, server-truncated to ~80 chars. */
  last_message_preview: string;
  /** ISO 8601 timestamp of the most-recent message. */
  last_activity_at: string;
  unread_count: number;
  is_pinned: boolean;
  is_archived: boolean;
  last_drafter: LastDrafter;
  /** Optional — only set when the contact is in `routing_contacts`. */
  routing_role?: RoutingRole;
}

// ---------------------------------------------------------------------------
// Time helpers — keep fixtures relative to "now" so demos always feel fresh
// rather than drifting into "8 months ago" once a fixture file ages.
// ---------------------------------------------------------------------------

/** ISO timestamp `n` seconds ago. */
function secondsAgo(n: number): string {
  return new Date(Date.now() - n * 1000).toISOString();
}

/** ISO timestamp `n` minutes ago. */
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

/** ISO timestamp `n` hours ago. */
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

/** ISO timestamp `n` days ago. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// MOCK_THREADS_5 — 5 threads covering V1 thread states + drafters
// ---------------------------------------------------------------------------

export const MOCK_THREADS_5: MessageThreadSummary[] = [
  // 1. Unread routing-contact (owner). Recent — green online dot in row.
  //    Last drafter is contact (they messaged us, we haven't replied).
  {
    thread_id: 'thr_01HQX5K7N0PTONIO',
    contact_name: 'Tonio Scott',
    contact_phone: '+14045550182',
    last_message_preview:
      "Hey — saw your update on the Maya project. Quick Q on timing?",
    last_activity_at: secondsAgo(45),
    unread_count: 2,
    is_pinned: false,
    is_archived: false,
    last_drafter: 'contact',
    routing_role: 'owner',
  },
  // 2. Read SMS contact (no routing role). Last drafter is Sarah (auto-reply).
  {
    thread_id: 'thr_01HQX5K7N1ACMEPA',
    contact_name: 'Acme Painters',
    contact_phone: '+14045551204',
    last_message_preview:
      "Thanks for the quote — we'll get back to you by Friday.",
    last_activity_at: minutesAgo(23),
    unread_count: 0,
    is_pinned: false,
    is_archived: false,
    last_drafter: 'sarah',
  },
  // 3. Pinned routing-contact (scheduling role). Last drafter is owner.
  {
    thread_id: 'thr_01HQX5K7N2MAYALANE',
    contact_name: 'Maya Lane',
    contact_phone: '+14155550911',
    last_message_preview:
      'Confirmed — Tuesday 2pm at the loft. Bringing the swatches.',
    last_activity_at: hoursAgo(3),
    unread_count: 0,
    is_pinned: true,
    is_archived: false,
    last_drafter: 'owner',
    routing_role: 'scheduling',
  },
  // 4. Archived old thread. Last drafter Ava (faint Ava-glow indicator).
  {
    thread_id: 'thr_01HQX5K7N3OLDLEAD',
    contact_name: 'Jordan Reyes',
    contact_phone: '+12125559834',
    last_message_preview:
      'Followed up on the proposal — circling back when budget reopens in Q3.',
    last_activity_at: daysAgo(34),
    unread_count: 0,
    is_pinned: false,
    is_archived: true,
    last_drafter: 'ava',
  },
  // 5. Manual E.164 — no name resolved. Falls back to formatted phone.
  //    Used to prove the row renders cleanly without a contact_name.
  {
    thread_id: 'thr_01HQX5K7N4UNKNOWN',
    contact_name: '',
    contact_phone: '+15125550066',
    last_message_preview: 'Hi — is this the right number for kitchen quotes?',
    last_activity_at: minutesAgo(8),
    unread_count: 1,
    is_pinned: false,
    is_archived: false,
    last_drafter: 'contact',
  },
];

// ---------------------------------------------------------------------------
// Counts derived for filter tabs (plan §3.9.2 — counts dynamically reflect
// the unfiltered universe, NOT the currently-filtered slice).
// ---------------------------------------------------------------------------

/** Compute filter-tab counts from a threads array (active = non-archived). */
export function computeFilterCounts(
  threads: MessageThreadSummary[],
): { all: number; unread: number; pinned: number; archived: number } {
  return {
    all: threads.filter((t) => !t.is_archived).length,
    unread: threads.filter((t) => !t.is_archived && t.unread_count > 0).length,
    pinned: threads.filter((t) => !t.is_archived && t.is_pinned).length,
    archived: threads.filter((t) => t.is_archived).length,
  };
}

/** Filter threads by active tab (plan §3.9.2). */
export function filterThreadsByTab(
  threads: MessageThreadSummary[],
  tab: 'all' | 'unread' | 'pinned' | 'archived',
): MessageThreadSummary[] {
  switch (tab) {
    case 'unread':
      return threads.filter((t) => !t.is_archived && t.unread_count > 0);
    case 'pinned':
      return threads.filter((t) => !t.is_archived && t.is_pinned);
    case 'archived':
      return threads.filter((t) => t.is_archived);
    case 'all':
    default:
      return threads.filter((t) => !t.is_archived);
  }
}

// ---------------------------------------------------------------------------
// MOCK_MESSAGES_8 — eight chat-bubble messages for the thread-view demo
// state (Lane E7, demo state c). Spans inbound/outbound, sarah/ava authors,
// every delivery_status, and a multi-segment outbound message.
// ---------------------------------------------------------------------------

export const MOCK_MESSAGES_8: ThreadMessage[] = [
  {
    message_id: 'm_demo_01',
    thread_id: 'thr_demo',
    direction: 'inbound',
    body: "Hey — saw your update on the Maya project. Quick Q on timing?",
    sent_at: minutesAgo(45),
    delivery_status: 'delivered',
  },
  {
    message_id: 'm_demo_02',
    thread_id: 'thr_demo',
    direction: 'outbound',
    author: 'sarah',
    body: "Hi Tonio — Sarah here. Tonio is in a meeting until 3pm but I can pull up the timeline. What did you need clarified?",
    sent_at: minutesAgo(43),
    delivery_status: 'delivered',
    num_segments: 2,
  },
  {
    message_id: 'm_demo_03',
    thread_id: 'thr_demo',
    direction: 'inbound',
    body: "Whether the renderings will be ready by Tuesday or if we should push to Friday.",
    sent_at: minutesAgo(40),
    delivery_status: 'delivered',
  },
  {
    message_id: 'm_demo_04',
    thread_id: 'thr_demo',
    direction: 'outbound',
    author: 'ava',
    body: "Drafted: Tuesday 2pm works. I'll bring the swatches and the renderings should be 90% ready by then. Want to confirm?",
    sent_at: minutesAgo(38),
    delivery_status: 'delivered',
    num_segments: 2,
  },
  {
    message_id: 'm_demo_05',
    thread_id: 'thr_demo',
    direction: 'inbound',
    body: "Tuesday works. Confirmed.",
    sent_at: minutesAgo(34),
    delivery_status: 'delivered',
  },
  {
    message_id: 'm_demo_06',
    thread_id: 'thr_demo',
    direction: 'outbound',
    author: 'owner',
    body: "Perfect — see you then.",
    sent_at: minutesAgo(32),
    delivery_status: 'delivered',
    num_segments: 1,
  },
  {
    message_id: 'm_demo_07',
    thread_id: 'thr_demo',
    direction: 'outbound',
    author: 'owner',
    body: "Bringing the swatches and the rev-3 renderings. Anything else you want me to prep?",
    sent_at: secondsAgo(120),
    delivery_status: 'sent',
    num_segments: 1,
  },
  {
    message_id: 'm_demo_08',
    thread_id: 'thr_demo',
    direction: 'outbound',
    author: 'owner',
    body: "Also — quick heads up the kitchen vendor pushed back their delivery to Wednesday. Doesn't affect the Tuesday plan but wanted you in the loop.",
    sent_at: secondsAgo(45),
    delivery_status: 'sending',
    num_segments: 2,
  },
];

// ---------------------------------------------------------------------------
// MOCK_CONTACTS_8 — eight contacts spanning all 4 sources (Lane E7).
// 3 routing / 2 recent_sms / 2 recent_call / 1 manual.
// ---------------------------------------------------------------------------

export const MOCK_CONTACTS_8: ContactSearchResult[] = [
  // 3 routing
  {
    id: 'ct_demo_routing_owner',
    source: 'routing',
    name: 'Tonio Scott',
    phone: '+14045550182',
    routing_role: 'owner',
  },
  {
    id: 'ct_demo_routing_scheduling',
    source: 'routing',
    name: 'Maya Lane',
    phone: '+14155550911',
    routing_role: 'scheduling',
  },
  {
    id: 'ct_demo_routing_billing',
    source: 'routing',
    name: 'Priya Shah',
    phone: '+13105557120',
    routing_role: 'billing',
  },
  // 2 recent_sms
  {
    id: 'ct_demo_sms_acme',
    source: 'recent_sms',
    name: 'Acme Painters',
    phone: '+14045551204',
    last_interaction_at: minutesAgo(23),
  },
  {
    id: 'ct_demo_sms_kitchen',
    source: 'recent_sms',
    name: 'Kitchen Quotes Inc.',
    phone: '+15125550066',
    last_interaction_at: minutesAgo(8),
  },
  // 2 recent_call
  {
    id: 'ct_demo_call_devon',
    source: 'recent_call',
    name: 'Devon Park',
    phone: '+17035554123',
    last_interaction_at: daysAgo(2),
  },
  {
    id: 'ct_demo_call_riley',
    source: 'recent_call',
    name: 'Riley Chen',
    phone: '+16175552901',
    last_interaction_at: daysAgo(9),
  },
  // 1 manual
  {
    id: 'manual_+15555550199',
    source: 'manual',
    name: '',
    phone: '+15555550199',
  },
];

// ---------------------------------------------------------------------------
// MOCK_SUGGESTIONS_3 — three Ava follow-ups (Lane E7, demo state b).
// ---------------------------------------------------------------------------

export const MOCK_SUGGESTIONS_3: MessageSuggestion[] = [
  {
    suggestion_id: 'sg_demo_01',
    contact_name: 'Maya Lane',
    contact_phone: '+14155550911',
    draft_body:
      "Hi Maya — confirming Tuesday at 2pm at the loft. Want me to bring extra swatches?",
    reason: "Maya hasn't replied to your Tuesday quote — send a check-in?",
    routing_role: 'scheduling',
  },
  {
    suggestion_id: 'sg_demo_02',
    contact_name: 'Tonio Scott',
    contact_phone: '+14045550182',
    draft_body:
      "Hey Tonio — quick follow-up on the Maya project timing question. Have a moment to chat?",
    reason: 'Tonio messaged 45s ago — reply still pending.',
    routing_role: 'owner',
  },
  {
    suggestion_id: 'sg_demo_03',
    contact_name: 'Acme Painters',
    contact_phone: '+14045551204',
    draft_body:
      "Hi — heads up the proposal expires Friday. Happy to extend if you need more time.",
    reason: "Acme's quote expires in 3 days — nudge them.",
  },
];

// ---------------------------------------------------------------------------
// MOCK_TEMPLATES_5 — duplicates the 5 V1 templates (plan §3.9.7) for offline
// demo. Same shape as the network response from `/api/messages/templates`.
// ---------------------------------------------------------------------------

export const MOCK_TEMPLATES_5: MessageTemplate[] = [
  {
    id: 'tpl_appt_confirm',
    label: 'Appointment confirmation',
    body: 'Confirming our appointment for {{date}} at {{time}}. Reply YES to confirm or call us at {{business_phone}}.',
    tokens: ['date', 'time', 'business_phone'],
  },
  {
    id: 'tpl_quote_followup',
    label: 'Quote follow-up',
    body: "Hi {{first_name}} — quick follow-up on the quote we sent {{relative_time}}. Any questions?",
    tokens: ['first_name', 'relative_time'],
  },
  {
    id: 'tpl_inquiry_response',
    label: 'Inquiry response',
    body: "Thanks for your inquiry. We'll get back to you within {{response_window}}.",
    tokens: ['response_window'],
  },
  {
    id: 'tpl_invoice_reminder',
    label: 'Invoice reminder',
    body: 'Reminder: your invoice #{{invoice_number}} for {{amount}} is due {{due_date}}.',
    tokens: ['invoice_number', 'amount', 'due_date'],
  },
  {
    id: 'tpl_sarah_backstop',
    label: 'Sarah backstop',
    body: 'We received your message. Sarah will follow up shortly.',
    tokens: [],
  },
];

// ---------------------------------------------------------------------------
// MOCK_CONTACTS_PANEL — 5 routing / 4 recent SMS / 3 recent call (Lane E7,
// demo state e). All `last_interaction_at` values are relative to "now" so
// the panel feels fresh on every load.
// ---------------------------------------------------------------------------

export const MOCK_CONTACTS_PANEL: ContactsSidePanelData = {
  routing: [
    {
      id: 'csp_demo_routing_owner',
      name: 'Tonio Scott',
      phone: '+14045550182',
      routing_role: 'owner',
    },
    {
      id: 'csp_demo_routing_sales',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      routing_role: 'sales',
    },
    {
      id: 'csp_demo_routing_support',
      name: 'Sam Park',
      phone: '+14155558810',
      routing_role: 'support',
    },
    {
      id: 'csp_demo_routing_billing',
      name: 'Priya Shah',
      phone: '+13105557120',
      routing_role: 'billing',
    },
    {
      id: 'csp_demo_routing_scheduling',
      name: 'Maya Lane',
      phone: '+14155550911',
      routing_role: 'scheduling',
    },
  ],
  recentSms: [
    {
      id: 'csp_demo_sms_acme',
      name: 'Acme Painters',
      phone: '+14045551204',
      last_interaction_at: minutesAgo(23),
      last_message_preview: "Thanks for the quote — we'll get back to you by Friday.",
    },
    {
      id: 'csp_demo_sms_kitchen',
      name: 'Kitchen Quotes Inc.',
      phone: '+15125550066',
      last_interaction_at: minutesAgo(8),
      last_message_preview: 'Hi — is this the right number for kitchen quotes?',
    },
    {
      id: 'csp_demo_sms_jordan',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      last_interaction_at: hoursAgo(6),
      last_message_preview: 'Followed up on the proposal — circling back when budget reopens.',
    },
    {
      id: 'csp_demo_sms_devon',
      name: 'Devon Park',
      phone: '+17035554123',
      last_interaction_at: daysAgo(2),
      last_message_preview: "Got the spec — I'll review tonight and get back tomorrow.",
    },
  ],
  recentCalls: [
    {
      id: 'csp_demo_call_riley',
      name: 'Riley Chen',
      phone: '+16175552901',
      last_interaction_at: daysAgo(2),
    },
    {
      id: 'csp_demo_call_maria',
      name: 'Maria Lopez',
      phone: '+13235558807',
      last_interaction_at: daysAgo(7),
    },
    {
      id: 'csp_demo_call_alex',
      name: 'Alex Sahota',
      phone: '+15555551234',
      last_interaction_at: daysAgo(14),
    },
  ],
};

// Re-export `SidePanelContact` so demo callers don't need to import from
// `ContactsSidePanel` directly when they're just rendering fixtures.
export type { SidePanelContact };
