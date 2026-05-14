/**
 * Front Desk Setup — type contracts for the redesigned setup page (plan §10
 * + Pass 19 §3.1 reframe).
 *
 * Pass 19 reframe (2026-04-30):
 *   The legacy `'ASPIRE_NUMBER' | 'KEEP_CURRENT_NUMBER'` binary is misleading.
 *   In 2026 there are three honest paths to public-number coverage:
 *
 *     - ASPIRE_NEW_NUMBER   — Aspire purchases a new local 10DLC or toll-free
 *                              number via Twilio. Sarah answers it via EL
 *                              native Twilio integration. SMS handled by Aspire
 *                              backend. Best for new businesses.
 *
 *     - FORWARD_EXISTING    — User keeps existing carrier; Aspire generates
 *                              carrier-specific conditional-forwarding codes
 *                              (AT&T `**21*`/`**61*`, Verizon `*72`/`*71`,
 *                              T-Mobile `**21*`/`**61*`). Calls forward to a
 *                              small Aspire-issued forward-target number.
 *                              SMS to the existing carrier number STAYS on
 *                              the existing carrier (Aspire never sees those
 *                              messages); BUT — per §3.8 — Aspire still
 *                              provisions a companion Aspire number for SMS +
 *                              Ava reminders.
 *
 *     - PORT_IN (V1.1)      — Twilio takes over the number entirely (LOA +
 *                              utility bill). Aspire owns voice + SMS. 7–14
 *                              day port window. Risk of port rejection.
 *
 * Migration `105_public_number_mode_remap.sql` (Lane B) remaps existing rows:
 *   `KEEP_CURRENT_NUMBER` → `FORWARD_EXISTING`
 *   `ASPIRE_NUMBER`       → `ASPIRE_NEW_NUMBER`
 */

// ---------------------------------------------------------------------------
// Public Number
// ---------------------------------------------------------------------------

export type PublicNumberMode =
  | 'ASPIRE_NEW_NUMBER'
  | 'FORWARD_EXISTING'
  | 'PORT_IN';

/**
 * Type of number for purchase via the picker sheet (§3.3).
 * Local = geographic 10DLC; Toll-free = 8XX prefix (non-geographic).
 */
export type NumberType = 'LOCAL' | 'TOLL_FREE';

export interface AvailableNumber {
  id: string;
  /** E.164 or display format like "(212) 555-0198" */
  number: string;
  inboundReady: boolean;
  outboundAvailable: boolean;
}

export interface PublicNumberConfig {
  mode: PublicNumberMode;
  /** Selected Aspire number (when mode === 'ASPIRE_NEW_NUMBER' or after companion-SMS purchase in 'FORWARD_EXISTING') */
  selectedNumberId?: string;
  /** Selected Aspire number E.164 for display in the setup UI. */
  selectedNumberPhone?: string;
  /** Area code search filter (legacy — sheet now owns this; kept for hydration compat) */
  areaCode?: string;
  /** Vanity contains filter (legacy — sheet now owns this) */
  containsFilter?: string;
  /** The owner's existing-carrier number (when mode === 'FORWARD_EXISTING') */
  forwardedNumber?: string;
}

// ---------------------------------------------------------------------------
// Forwarding instructions — carrier-specific conditional-forwarding codes
// (§3.1 + new ForwardingInstructionsCard)
// ---------------------------------------------------------------------------

/**
 * Carriers Twilio Lookup v2 returns + a fallback. Display-only — backend
 * `forwarding_instructions.py` returns the codes already mapped, this is
 * just the label we render.
 */
export type CarrierName =
  | 'AT&T'
  | 'Verizon'
  | 'T-Mobile'
  | 'US Cellular'
  | 'Spectrum Mobile'
  | 'Boost Mobile'
  | 'Cricket Wireless'
  | 'Mint Mobile'
  | 'Other';

export interface ForwardingCodeSet {
  /** Forward all inbound calls (e.g. AT&T `**21*` ... `#`) */
  always: string;
  /** Forward when busy (e.g. AT&T `**67*`) */
  busy: string;
  /** Forward when no answer (e.g. AT&T `**61*`) */
  noAnswer: string;
  /** Forward when unreachable (e.g. AT&T `**62*`) */
  unreachable: string;
}

export interface ForwardingInstructionsResponse {
  carrierName: CarrierName;
  /** Codes pre-formatted with the Aspire forward-target inserted. */
  codes: ForwardingCodeSet;
  /** The Aspire-issued small forward-target number the codes route to. */
  aspireForwardTarget: string;
  /** Optional helper for owners on niche carriers. */
  helpUrl?: string;
}

// ---------------------------------------------------------------------------
// Catch Mode (how human catches routed calls)
// ---------------------------------------------------------------------------

export type CatchMode = 'APP_ONLY' | 'PHONE_ONLY' | 'APP_AND_PHONE_SIMUL_RING';

export interface CatchConfig {
  mode: CatchMode;
}

/**
 * Result of validating Catch Mode against the active Public Number mode
 * (§3.2 interlock matrix). Returned by `validateCatchInterlock()` so the
 * page can disable Save when invalid.
 */
export type CatchInterlockSeverity = 'ok' | 'warn' | 'invalid';

export interface CatchInterlockResult {
  severity: CatchInterlockSeverity;
  /** User-facing explanation. Empty string when severity === 'ok'. */
  message: string;
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
  /** IANA timezone (e.g., "America/Los_Angeles"). Drives is_open_now eval. */
  timezone?: string;
  /** Dedicated voicemail destination — falls back to owner email when blank. */
  voicemailEmail?: string;
}

// ---------------------------------------------------------------------------
// Routing Contacts (non-seat destinations)
// ---------------------------------------------------------------------------

export type RoutingContactRole =
  | 'owner'
  | 'sales'
  | 'support'
  | 'billing'
  | 'scheduling'
  | 'custom';

export type RoutingFallbackMode = 'TRANSFER_ALLOWED' | 'MESSAGE_ONLY';

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
// Forwarding verification (only for FORWARD_EXISTING mode)
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

/**
 * Receptionist persona slug — the chosen AI voice that answers inbound
 * calls. Persisted on `front_desk_configs.receptionist_persona` (migration
 * 109). UI display name + headshot + preview MP3 come from
 * `lib/api/frontDesk.ts:fetchReceptionistPersonas` (the static registry).
 */
export type ReceptionistPersonaSlug = 'sarah' | 'tiffany';

export interface FrontDeskConfig {
  publicNumber: PublicNumberConfig;
  catch: CatchConfig;
  businessHours: BusinessHoursConfig;
  routingContacts: RoutingContact[];
  busy: BusyConfig;
  forwarding?: ForwardingVerification;
  /** Tenant's chosen receptionist persona slug. Defaults to 'sarah'. */
  receptionistPersona: ReceptionistPersonaSlug;
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

// ---------------------------------------------------------------------------
// §3.2 Interlock matrix — pure validation (no React)
// ---------------------------------------------------------------------------

/**
 * Validates the §3.2 Catch Calls × Public Number matrix. Pure function so the
 * page, the section, and tests can all share one source of truth.
 *
 * Matrix:
 *   ASPIRE_NEW_NUMBER + APP_ONLY                     → ok
 *   ASPIRE_NEW_NUMBER + PHONE_ONLY                   → ok
 *   ASPIRE_NEW_NUMBER + APP_AND_PHONE_SIMUL_RING     → ok (default)
 *   FORWARD_EXISTING  + APP_ONLY                     → invalid
 *   FORWARD_EXISTING  + PHONE_ONLY                   → ok
 *   FORWARD_EXISTING  + APP_AND_PHONE_SIMUL_RING     → warn
 *   PORT_IN           + *                            → ok
 */
export function validateCatchInterlock(
  publicMode: PublicNumberMode,
  catchMode: CatchMode,
): CatchInterlockResult {
  if (publicMode === 'FORWARD_EXISTING') {
    if (catchMode === 'APP_ONLY') {
      return {
        severity: 'invalid',
        message:
          "Calls go to your carrier voicemail in this combo — Sarah never sees them. Pick 'Ring my phone' or 'Ring both' instead.",
      };
    }
    if (catchMode === 'APP_AND_PHONE_SIMUL_RING') {
      return {
        severity: 'warn',
        message:
          'Depends on your carrier supporting simultaneous-ring. Verify with a test call after saving.',
      };
    }
  }
  return { severity: 'ok', message: '' };
}
