/**
 * Pure mapper functions: Backend wire types → Front Desk ViewModel types.
 *
 * Backend wire types are defined at the bottom of this file (prefixed Backend*).
 * They mirror the DB schemas in types/frontdesk.ts (CallSession, Voicemail,
 * SmsThread, SmsMessage) plus the extended shapes the backend may surface.
 *
 * These functions are deterministic and side-effect-free. They do not call APIs,
 * do not read React state, and do not throw — unknown/missing data is filled
 * with safe defaults.
 *
 * Formatters used: formatPhoneNumber, formatDuration, formatRelativeTime
 * (all from lib/formatters.ts).
 * Identity helpers: extractInitials, hashStringToColor, extractAreaCode
 * (added to lib/formatters.ts in Pass A).
 */

import {
  formatPhoneNumber,
  formatDuration,
  formatRelativeTime,
  extractInitials,
  hashStringToColor,
  extractAreaCode,
} from '@/lib/formatters';

import type {
  VoicemailVM,
  MissedCallVM,
  IncomingCallVM,
  OutgoingCallVM,
  SmsThreadVM,
  SmsMessageVM,
  ContactVM,
  ContactInteraction,
  CallbackVM,
  FeedItemVM,
  EventItemVM,
  ActivityEventVM,
  IdentityVM,
  EventType,
  FeedEventType,
  EntityType,
  CallbackBucket,
} from '@/components/front-desk/types';

// ---------------------------------------------------------------------------
// Backend wire types
// These mirror types/frontdesk.ts exactly — defined here so adapters have
// a single import point. When types/frontdesk.ts is the source of truth,
// import from there instead; the field names are identical.
// ---------------------------------------------------------------------------

export interface BackendVoicemail {
  voicemail_id: string;
  from_e164: string | null;
  to_e164: string | null;
  duration_seconds: number | null;
  transcript_text?: string;
  transcript_preview?: string;
  created_at: string;
  /** Joined from CRM — may be absent for unknown callers. */
  caller_name?: string | null;
  /** Populated by backend if transcript has been reviewed. */
  reviewed?: boolean;
}

export interface BackendCallSession {
  call_session_id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  from_number: string | null;
  to_number: string | null;
  caller_name: string | null;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
  /** AI-generated summary lines (array of strings). */
  ai_summary?: string[] | null;
  /** Full call transcript segments. */
  transcript?: { side: 'them' | 'you'; text: string }[] | null;
  /** AI capture text for missed calls with attempted voicemail interception. */
  ai_capture?: string | null;
  metadata: Record<string, unknown>;
}

export interface BackendSmsThread {
  thread_id: string;
  counterparty_e164: string;
  last_message_at: string | null;
  unread_count: number;
  /** Joined from CRM. */
  counterparty_name?: string | null;
  messages?: BackendSmsMessage[];
}

export interface BackendSmsMessage {
  sms_message_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  received_at: string | null;
  created_at: string;
  delivery_status?: string | null;
}

export interface BackendContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  entity_type?: string | null;
  last_interaction_snippet?: string;
  history?: { type: string; preview: string; time: string }[];
}

export interface BackendCallback {
  id: string;
  bucket: string;
  name?: string | null;
  phone: string;
  promise_time: string;
  due_label?: string;
  context?: string;
}

export interface BackendInboxItem {
  id: string;
  type: string;
  name?: string | null;
  phone: string;
  entity?: string | null;
  preview?: string;
  time?: string;
  created_at?: string;
  meta?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const KNOWN_EVENT_TYPES = new Set<EventType>([
  'missed_call',
  'voicemail',
  'sms',
  'callback',
  'incoming_call',
  'outgoing_call',
]);

const KNOWN_FEED_EVENT_TYPES = new Set<FeedEventType>([
  'missed_call',
  'voicemail',
  'sms',
  'callback',
  'incoming_call',
]);

function toEventType(raw: string): EventType {
  if (KNOWN_EVENT_TYPES.has(raw as EventType)) return raw as EventType;
  console.warn(`[frontDeskAdapters] Unknown EventType "${raw}", defaulting to "incoming_call"`);
  return 'incoming_call';
}

function toFeedEventType(raw: string): FeedEventType {
  if (KNOWN_FEED_EVENT_TYPES.has(raw as FeedEventType)) return raw as FeedEventType;
  console.warn(`[frontDeskAdapters] Unknown FeedEventType "${raw}", defaulting to "incoming_call"`);
  return 'incoming_call';
}

const KNOWN_ENTITY_TYPES = new Set<EntityType>(['Lead', 'Client', 'Vendor', 'Unknown']);

function toEntityType(raw: string | null | undefined): EntityType | null {
  if (!raw) return null;
  if (KNOWN_ENTITY_TYPES.has(raw as EntityType)) return raw as EntityType;
  return null;
}

const KNOWN_BUCKETS = new Set<CallbackBucket>(['due_today', 'overdue', 'scheduled']);

function toCallbackBucket(raw: string): CallbackBucket {
  if (KNOWN_BUCKETS.has(raw as CallbackBucket)) return raw as CallbackBucket;
  return 'scheduled';
}

/**
 * Resolve caller identity fields from name + phone.
 * Returns flat VM fields so workspaces can destructure without narrowing.
 */
function resolveIdentityFields(
  name: string | null | undefined,
  phone: string,
  entity?: EntityType | null,
): {
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  entity: EntityType | null;
} {
  const formatted = formatPhoneNumber(phone);
  if (!name || name === 'Unknown' || name.trim() === '') {
    return {
      kind: 'unknown',
      name: 'Unknown',
      initials: '??',
      avatarColor: '#6B7280',
      phone: formatted,
      entity: null,
    };
  }
  return {
    kind: 'known',
    name,
    initials: extractInitials(name),
    avatarColor: hashStringToColor(name),
    phone: formatted,
    entity: entity ?? null,
  };
}

// ---------------------------------------------------------------------------
// Exported mappers
// ---------------------------------------------------------------------------

/** Map backend voicemail row → VoicemailVM */
export function mapToVoicemail(b: BackendVoicemail): VoicemailVM {
  const phone = b.from_e164 ?? '';
  const identity = resolveIdentityFields(b.caller_name, phone);
  const durationStr = b.duration_seconds != null ? formatDuration(b.duration_seconds) : '0:00';
  const timeStr = formatRelativeTime(b.created_at);
  const transcript = b.transcript_text ?? '';
  const preview = b.transcript_preview ?? (transcript ? transcript.slice(0, 60) + (transcript.length > 60 ? '...' : '') : 'No transcript available');

  return {
    id: b.voicemail_id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    duration: durationStr,
    time: timeStr,
    preview,
    transcript,
    unread: !(b.reviewed ?? false),
  };
}

/** Map backend call_session (status: missed/no-answer) → MissedCallVM */
export function mapToMissedCall(b: BackendCallSession): MissedCallVM {
  const phone = b.from_number ?? b.to_number ?? '';
  const identity = resolveIdentityFields(b.caller_name, phone);
  const durationStr = b.duration_seconds != null ? formatDuration(b.duration_seconds) : '0s';
  const attemptedStr = `rang ${durationStr}`;
  const timeStr = formatRelativeTime(b.started_at);

  return {
    id: b.call_session_id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    attempted: attemptedStr,
    time: timeStr,
    transcript: b.ai_capture ?? undefined,
  };
}

/** Map backend call_session (direction: inbound, status: completed) → IncomingCallVM */
export function mapToIncoming(b: BackendCallSession): IncomingCallVM {
  const phone = b.from_number ?? '';
  const identity = resolveIdentityFields(b.caller_name, phone);
  const durationStr = b.duration_seconds != null ? formatDuration(b.duration_seconds) : '0:00';
  const timeStr = formatRelativeTime(b.started_at);
  const summary = b.ai_summary ?? [];
  const transcript = b.transcript ?? [];

  return {
    id: b.call_session_id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    duration: durationStr,
    time: timeStr,
    summary,
    transcript,
  };
}

/** Map backend call_session (direction: outbound, status: completed) → OutgoingCallVM */
export function mapToOutgoing(b: BackendCallSession): OutgoingCallVM {
  const phone = b.to_number ?? '';
  const identity = resolveIdentityFields(b.caller_name, phone);
  const durationStr = b.duration_seconds != null ? formatDuration(b.duration_seconds) : '0:00';
  const timeStr = formatRelativeTime(b.started_at);
  const transcript = b.transcript ?? [];

  return {
    id: b.call_session_id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    duration: durationStr,
    time: timeStr,
    transcript,
  };
}

/** Map backend SMS thread → SmsThreadVM */
export function mapToSmsThread(b: BackendSmsThread): SmsThreadVM {
  const phone = b.counterparty_e164;
  const identity = resolveIdentityFields(b.counterparty_name, phone);
  const timeStr = b.last_message_at ? formatRelativeTime(b.last_message_at) : '';
  const bubbles: SmsMessageVM[] = (b.messages ?? []).map(mapToSmsMessage);
  const lastBubble = bubbles[bubbles.length - 1];
  const preview = lastBubble?.text ?? '';

  return {
    id: b.thread_id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    preview,
    time: timeStr,
    unread: b.unread_count > 0,
    bubbles,
  };
}

/** Map backend SMS message → SmsMessageVM */
export function mapToSmsMessage(b: BackendSmsMessage): SmsMessageVM {
  const side: 'them' | 'you' = b.direction === 'outbound' ? 'you' : 'them';
  const timeStr = formatRelativeTime(b.received_at ?? b.created_at);
  const read = b.delivery_status === 'delivered' || b.delivery_status === 'read';

  return {
    id: b.sms_message_id,
    side,
    text: b.body,
    time: timeStr,
    read,
  };
}

/** Map backend contact record → ContactVM */
export function mapToContact(b: BackendContact): ContactVM {
  const entity = toEntityType(b.entity_type) ?? 'Unknown';
  const name = b.name || 'Unknown';
  const history: ContactInteraction[] = (b.history ?? []).map((h) => ({
    type: (h.type === 'sms' || h.type === 'voicemail' ? h.type : 'call') as ContactInteraction['type'],
    preview: h.preview,
    time: h.time,
  }));

  return {
    id: b.id,
    name,
    initials: extractInitials(name),
    avatarColor: hashStringToColor(name),
    entity,
    phone: formatPhoneNumber(b.phone),
    email: b.email,
    address: b.address,
    lastInteractionSnippet: b.last_interaction_snippet ?? '',
    history,
  };
}

/** Map backend callback record → CallbackVM */
export function mapToCallback(b: BackendCallback): CallbackVM {
  const phone = b.phone;
  const identity = resolveIdentityFields(b.name, phone);
  const bucket = toCallbackBucket(b.bucket);

  return {
    id: b.id,
    bucket,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    promiseTime: b.promise_time,
    dueLabel: b.due_label ?? b.promise_time,
    context: b.context ?? '',
  };
}

/** Map backend inbox item → FeedItemVM (TodayFeed horizontal scroller) */
export function mapToFeedItem(b: BackendInboxItem): FeedItemVM {
  const phone = b.phone;
  const identity = resolveIdentityFields(b.name, phone);
  const entity = toEntityType(b.entity);
  const eventType = toFeedEventType(b.type);
  const timeStr = b.time ?? (b.created_at ? formatRelativeTime(b.created_at) : '');

  return {
    id: b.id,
    kind: identity.kind,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    areaCode: extractAreaCode(phone ?? ''),
    entity,
    type: eventType,
    preview: b.preview ?? '',
    time: timeStr,
  };
}

/** Map backend inbox item → EventItemVM (EventDetailModal) */
export function mapToEventItem(b: BackendInboxItem): EventItemVM {
  // EventItemVM and FeedItemVM share the same shape — delegate to mapToFeedItem.
  return mapToFeedItem(b);
}

/**
 * Construct the unknown-caller IdentityVM variant from a raw phone string.
 * Use when the backend returns a number with no matched contact record.
 */
export function mapToUnknownIdentity(phone: string): IdentityVM {
  return {
    kind: 'unknown',
    phone: formatPhoneNumber(phone),
    areaCode: extractAreaCode(phone),
  };
}

/** Map backend inbox item → ActivityEventVM (AllWorkspace mixed feed) */
export function mapToActivityEvent(b: BackendInboxItem): ActivityEventVM {
  const phone = b.phone;
  const identity = resolveIdentityFields(b.name, phone);
  const eventType = toEventType(b.type);
  const timeStr = b.time ?? (b.created_at ? formatRelativeTime(b.created_at) : '');

  return {
    id: b.id,
    kind: identity.kind,
    type: eventType,
    name: identity.name,
    initials: identity.initials,
    avatarColor: identity.avatarColor,
    phone: identity.phone,
    entity: b.entity ?? undefined,
    preview: b.preview ?? '',
    time: timeStr,
    meta: b.meta,
  };
}
