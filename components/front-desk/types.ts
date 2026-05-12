/**
 * Canonical ViewModel types for the Front Desk Hub.
 *
 * Lifted from inline type definitions across:
 *   VoicemailWorkspace, MissedWorkspace, IncomingWorkspace, OutgoingWorkspace,
 *   SmsWorkspace, ContactsWorkspace, CallbackQueueWorkspace, AllWorkspace,
 *   TodayFeed, EventDetailModal, inboxShared.
 *
 * DESIGN DECISION — flat fields + kind discriminator vs. nested IdentityVM:
 *   We keep flat fields (name, initials, avatarColor, phone, entity) on each VM
 *   and add a top-level `kind: 'known' | 'unknown'` discriminator. Reason: all
 *   11 workspace files destructure these fields directly in JSX (e.g. `m.name`,
 *   `m.initials`, `m.avatarColor`). Nesting them under `identity.name` would
 *   touch every render site in Pass B. The discriminator alone satisfies the
 *   "unknown caller" branch in adapters and UnknownAvatar without refactoring
 *   workspace components.
 */

// We import Ionicons as a value (not type-only) because we need
// `typeof Ionicons.glyphMap` for the IoniconName convenience alias.
// This is the same pattern used throughout inboxShared.tsx.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * All 6 event types across the Front Desk Hub. Sourced from inboxShared.tsx.
 * Note: TodayFeed.tsx uses a 5-value subset (no outgoing_call) — EventItemVM
 * reflects that narrower union.
 */
export type EventType =
  | 'missed_call'
  | 'voicemail'
  | 'sms'
  | 'callback'
  | 'incoming_call'
  | 'outgoing_call';

/** Entity classification for contacts and callers. */
export type EntityType = 'Lead' | 'Client' | 'Vendor' | 'Unknown';

/** Urgency bucket for callback queue items. */
export type CallbackBucket = 'due_today' | 'overdue' | 'scheduled';

// ---------------------------------------------------------------------------
// Identity discriminated union
// ---------------------------------------------------------------------------

/**
 * Discriminated union for caller identity. Workspaces that surface known callers
 * use the `known` variant; unknown numbers fall through to `unknown`.
 *
 * Both variants carry `phone` so rendering code can always show the number
 * without narrowing. The `kind` field is the discriminant.
 */
export type IdentityVM =
  | {
      kind: 'known';
      name: string;
      initials: string;
      avatarColor: string;
      phone: string;
      entity: EntityType | null;
    }
  | {
      kind: 'unknown';
      phone: string;
      areaCode: string | null;
    };

// ---------------------------------------------------------------------------
// VoicemailVM
// ---------------------------------------------------------------------------

export interface VoicemailVM {
  id: string;
  /** Discriminates known vs unknown caller. Workspaces read flat fields below. */
  kind: 'known' | 'unknown';
  name: string;       // 'Unknown' when kind === 'unknown'
  initials: string;   // '??' when kind === 'unknown'
  avatarColor: string;
  phone: string;      // display-formatted, e.g. "(617) 555-0319"
  /** Human-readable duration, e.g. "0:46". Derived from duration_seconds. */
  duration: string;
  /** Relative time string, e.g. "21m", "3h", "Yesterday". */
  time: string;
  /** First line of transcript or AI-derived preview. */
  preview: string;
  transcript: string;
  unread: boolean;
}

// ---------------------------------------------------------------------------
// MissedCallVM
// ---------------------------------------------------------------------------

export interface MissedCallVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  /** e.g. "rang 28s" */
  attempted: string;
  time: string;
  /** AI capture text if Ava attempted voicemail interception. */
  transcript?: string;
}

// ---------------------------------------------------------------------------
// IncomingCallVM
// ---------------------------------------------------------------------------

export interface IncomingCallVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  duration: string;
  time: string;
  /** Bullet-point AI summary lines. */
  summary: string[];
  transcript: { side: 'them' | 'you'; text: string }[];
}

// ---------------------------------------------------------------------------
// OutgoingCallVM
// ---------------------------------------------------------------------------

export interface OutgoingCallVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  duration: string;
  time: string;
  transcript: { side: 'them' | 'you'; text: string }[];
}

// ---------------------------------------------------------------------------
// SmsThreadVM + SmsMessageVM
// ---------------------------------------------------------------------------

export interface SmsMessageVM {
  id: string;
  side: 'them' | 'you';
  text: string;
  /** Display timestamp string, e.g. "Today 9:27 AM". */
  time: string;
  read?: boolean;
}

export interface SmsThreadVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  bubbles: SmsMessageVM[];
}

// ---------------------------------------------------------------------------
// ContactVM
// ---------------------------------------------------------------------------

export interface ContactInteraction {
  type: 'call' | 'sms' | 'voicemail';
  preview: string;
  time: string;
}

export interface ContactVM {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  entity: EntityType;
  phone: string;
  email?: string;
  address?: string;
  lastInteractionSnippet: string;
  history: ContactInteraction[];
}

// ---------------------------------------------------------------------------
// CallbackVM
// ---------------------------------------------------------------------------

export interface CallbackVM {
  id: string;
  bucket: CallbackBucket;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  /** Human-readable scheduled time, e.g. "2:00 PM". */
  promiseTime: string;
  /** Urgency label, e.g. "Due in 1h", "Overdue 23h", "Tomorrow 9:00 AM". */
  dueLabel: string;
  context: string;
}

// ---------------------------------------------------------------------------
// FeedItemVM — TodayFeed horizontal scroller
// Uses 5-value EventType subset (no outgoing_call per TodayFeed.tsx)
// ---------------------------------------------------------------------------

export type FeedEventType =
  | 'missed_call'
  | 'voicemail'
  | 'sms'
  | 'callback'
  | 'incoming_call';

export interface FeedItemVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  entity: EntityType | null;
  type: FeedEventType;
  preview: string;
  time: string;
}

// ---------------------------------------------------------------------------
// EventItemVM — EventDetailModal (mirrors EventDetailModal.tsx:EventItem)
// ---------------------------------------------------------------------------

export interface EventItemVM {
  id: string;
  kind: 'known' | 'unknown';
  name: string;
  initials: string;
  avatarColor: string;
  entity: EntityType | null;
  type: FeedEventType;
  preview: string;
  time: string;
  /** E.164 or display-formatted phone — used by footer action buttons (Pass F). */
  phone?: string;
}

// ---------------------------------------------------------------------------
// ActivityEventVM — AllWorkspace mixed feed (full 6-value EventType)
// ---------------------------------------------------------------------------

export interface ActivityEventVM {
  id: string;
  kind: 'known' | 'unknown';
  type: EventType;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  entity?: string;
  preview: string;
  time: string;
  /** Type-specific metadata, e.g. "0:46" for voicemail, "rang 28s" for missed. */
  meta?: string;
}

// ---------------------------------------------------------------------------
// Ionicons glyph type re-export (convenience)
// ---------------------------------------------------------------------------

export type IoniconName = keyof typeof Ionicons.glyphMap;
