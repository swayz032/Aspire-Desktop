/**
 * Front Desk Setup — type contracts for the redesigned setup page (plan §10).
 *
 * These types replace the V1 Receptionist Sarah handoff configuration model.
 * Removed: business name field, audio preview, "common reasons", team seats.
 * Added: Public Number mode, Catch Mode, Routing Contacts as first-class entities,
 *        Forwarding Status state machine.
 */

// ---------------------------------------------------------------------------
// Public Number
// ---------------------------------------------------------------------------

export type PublicNumberMode = 'ASPIRE_NUMBER' | 'KEEP_CURRENT_NUMBER';

export interface AvailableNumber {
  id: string;
  /** E.164 or display format like "(212) 555-0198" */
  number: string;
  inboundReady: boolean;
  outboundAvailable: boolean;
}

export interface PublicNumberConfig {
  mode: PublicNumberMode;
  /** Selected Aspire number (when mode === 'ASPIRE_NUMBER') */
  selectedNumberId?: string;
  /** Area code search filter */
  areaCode?: string;
  /** Vanity contains filter (e.g., "PAINT") */
  containsFilter?: string;
  /** Forwarded inbound number (when mode === 'KEEP_CURRENT_NUMBER') */
  forwardedNumber?: string;
}

// ---------------------------------------------------------------------------
// Catch Mode (how human catches routed calls)
// ---------------------------------------------------------------------------

export type CatchMode = 'APP_ONLY' | 'PHONE_ONLY' | 'APP_AND_PHONE_SIMUL_RING';

export interface CatchConfig {
  mode: CatchMode;
}

// ---------------------------------------------------------------------------
// Business Hours
// ---------------------------------------------------------------------------

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface BusinessHourDay {
  day: DayKey;
  /** False = closed all day */
  open: boolean;
  /** "HH:MM" 24-hour format */
  startTime?: string;
  endTime?: string;
}

export type AfterHoursMode =
  | 'TAKE_MESSAGE'
  | 'ASK_CALLBACK_WINDOW'
  | 'TRY_TRANSFER_THEN_MESSAGE';

export interface BusinessHoursConfig {
  days: BusinessHourDay[];
  afterHoursMode: AfterHoursMode;
  /** Optional pronunciation override for business name */
  pronunciationOverride?: string;
}

// ---------------------------------------------------------------------------
// Routing Contacts (non-seat destinations)
// ---------------------------------------------------------------------------

export type RoutingContactRole = 'owner' | 'sales' | 'support' | 'operations' | 'custom';

export type RoutingFallbackMode = 'TRANSFER_ALLOWED' | 'MESSAGE_FALLBACK';

export interface RoutingContact {
  id: string;
  role: RoutingContactRole;
  customRoleLabel?: string;
  name: string;
  phone: string;
  /** Optional avatar URL or initials fallback */
  avatarUrl?: string;
  initials?: string;
  fallbackMode: RoutingFallbackMode;
  transferAllowed: boolean;
  /** Display priority (lower = higher priority) */
  priority: number;
}

// ---------------------------------------------------------------------------
// Busy Mode
// ---------------------------------------------------------------------------

export type BusyMode = 'TAKE_MESSAGE' | 'ASK_CALLBACK_WINDOW' | 'TRY_TRANSFER_THEN_MESSAGE';

export interface BusyConfig {
  mode: BusyMode;
}

// ---------------------------------------------------------------------------
// Forwarding verification (only for KEEP_CURRENT_NUMBER mode)
// ---------------------------------------------------------------------------

export type ForwardingStatus =
  | 'NOT_CONFIGURED'
  | 'PENDING'
  | 'VERIFIED'
  | 'LAST_TEST_FAILED';

export interface ForwardingVerification {
  status: ForwardingStatus;
  lastTestAt?: string;
  lastTestErrorMessage?: string;
}

// ---------------------------------------------------------------------------
// Aggregate config — full Front Desk Setup state
// ---------------------------------------------------------------------------

export interface FrontDeskConfig {
  publicNumber: PublicNumberConfig;
  catch: CatchConfig;
  businessHours: BusinessHoursConfig;
  routingContacts: RoutingContact[];
  busy: BusyConfig;
  forwarding?: ForwardingVerification;
  /** Last persisted version — used for optimistic concurrency */
  version: number;
}

// ---------------------------------------------------------------------------
// Setup summary (right rail card)
// ---------------------------------------------------------------------------

export interface SetupSummaryItem {
  iconName: string; // Ionicons key
  label: string;
  value: string;
}

export interface SarahStatus {
  active: boolean;
  /** "AI Front Desk Agent" */
  roleLabel: string;
  /** "Sarah" */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Page-level UI state
// ---------------------------------------------------------------------------

export interface FrontDeskPageState {
  config: FrontDeskConfig;
  summary: SetupSummaryItem[];
  sarah: SarahStatus;
  isDirty: boolean;
  isSaving: boolean;
  isTesting: boolean;
  saveError?: string;
}
