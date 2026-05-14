/**
 * Front Desk Setup API client — Pass 17 §17.C.
 *
 * Thin client wrappers around the Pass 16 backend routes:
 *   GET   /v1/front-desk/config                — read current versioned config
 *   PATCH /v1/front-desk/config                — versioned write (Yellow tier)
 *   POST  /v1/front-desk/config/test-call      — fire test inbound call (Yellow)
 *   POST  /v1/twilio/available-numbers         — search numbers (Green)
 *   POST  /v1/twilio/purchase-number           — purchase + EL attach (Yellow)
 *
 * All calls go through same-origin `/api/v1/...` so the Express server proxy
 * (mirroring server/routes.ts:7918 enrich-product) mints the capability token
 * + injects Gateway-trusted scope headers (`X-Tenant-Id`, `X-Suite-Id`,
 * `X-Office-Id`) before forwarding to the Python orchestrator. The frontend
 * never holds the signing key (Law #5).
 *
 * Auth headers (`Authorization: Bearer <jwt>`, `X-Suite-Id`) are added by the
 * caller-supplied `authenticatedFetch` (from `useAuthFetch()`), and we add
 * `X-Office-Id` per call.
 *
 * Backend response shapes match the verified contracts in
 * `backend/orchestrator/src/aspire_orchestrator/routes/front_desk.py` and
 * `routes/telephony.py`.
 */

import { API_BASE } from './officeMemory';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FrontDeskApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FrontDeskApiError';
  }
}

async function expectJson<T>(resp: Response, fallbackCode: string): Promise<T> {
  if (!resp.ok) {
    let code = fallbackCode;
    let message = `${fallbackCode} (${resp.status})`;
    try {
      const errBody = await resp.json();
      code = errBody?.detail?.error ?? errBody?.error ?? code;
      message = errBody?.detail?.message ?? errBody?.message ?? message;
    } catch {
      // fall through
    }
    throw new FrontDeskApiError(resp.status, code, message);
  }
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------------------
// Front Desk config types — mirror routes/front_desk.py response shape.
// ---------------------------------------------------------------------------

/**
 * Pass 19 §3.1 — 3-mode honest model. Migration 105 (Lane B) remaps legacy
 * `ASPIRE_NUMBER`→`ASPIRE_NEW_NUMBER` and `KEEP_CURRENT_NUMBER`→`FORWARD_EXISTING`
 * server-side; the wire format the gateway returns matches this enum.
 */
export type PublicNumberMode =
  | 'ASPIRE_NEW_NUMBER'
  | 'FORWARD_EXISTING'
  | 'PORT_IN'
  | 'ASPIRE_NUMBER'
  | 'KEEP_CURRENT_NUMBER';
export type CatchMode = 'APP_ONLY' | 'PHONE_ONLY' | 'APP_AND_PHONE_SIMUL_RING';
export type AfterHoursMode =
  | 'take_message'
  | 'ask_callback_window'
  | 'callback_window'
  | 'try_transfer_then_message';
export type BusyMode =
  | 'take_message'
  | 'ask_callback_window'
  | 'callback_window'
  | 'try_transfer_then_message';
export type ForwardingStatus = 'NOT_CONFIGURED' | 'PENDING' | 'VERIFIED' | 'LAST_TEST_FAILED';

/**
 * Receptionist persona slug. Drives EL agent attachment + UI display name on
 * the Front Desk Setup page. Migration 109 adds the column with a CHECK
 * constraint mirroring this union; expand both together when adding personas.
 */
export type ReceptionistPersonaSlug = 'sarah' | 'tiffany';

export interface FrontDeskConfigRow {
  id: string;
  tenant_id: string;
  suite_id: string;
  office_id: string;
  version_no: number;
  is_current: boolean;
  public_number_mode: PublicNumberMode;
  catch_mode: CatchMode;
  after_hours_mode: AfterHoursMode;
  busy_mode: BusyMode;
  greeting_name_override: string;
  pronunciation_override: string;
  /** JSONB column — present on rows saved through Pass 19+ Hours-tab path. */
  business_hours?: BusinessHoursWire | null;
  /** IANA tz, e.g. "America/Los_Angeles". Drives is_open_now eval. */
  timezone?: string | null;
  /** Receptionist persona slug — added by migration 109. */
  receptionist_persona?: ReceptionistPersonaSlug | null;
  forwarding_status?: ForwardingStatus | null;
  last_forwarding_test_at?: string | null;
  last_forwarding_test_result?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface RoutingContactRow {
  id: string;
  tenant_id: string;
  suite_id: string;
  office_id: string;
  role: string;
  /** Live DB column is `name`. Older payloads may surface this as `label`
   * — both are read defensively in the frontend mapper. */
  name?: string;
  label?: string;
  phone: string;
  sip_uri?: string;
  email?: string;
  transfer_allowed?: boolean;
  fallback_mode?: string;
  sort_order?: number;
  created_at: string;
  updated_at?: string | null;
}

export interface FrontDeskConfigResponse {
  success: boolean;
  config: FrontDeskConfigRow | Record<string, never>;
  routing_contacts: RoutingContactRow[];
  /** Tenant-level voicemail destination (suite_profiles.voicemail_email). */
  voicemail_email?: string;
  /**
   * Office's purchased Aspire phone number, joined from tenant_phone_numbers.
   * `null` when no number has been bought yet — the FE should render an
   * "Aspire number not set up" CTA in that case.
   */
  aspire_number?: AspireNumberInfo | null;
}

/**
 * Office-level phone number record. Used by the AspireNumberPill component
 * on the Return Call page header, the Front Desk Setup Sarah Status Rail,
 * and the Call Room caller-id display.
 */
export interface AspireNumberInfo {
  /** E.164, e.g. "+14155550198". */
  e164: string;
  /** Pre-formatted for display, e.g. "+1 (415) 555-0198". */
  formatted: string;
  /** Twilio capability flags. */
  capabilities: { voice?: boolean; sms?: boolean; mms?: boolean };
  status: 'active' | 'released' | 'suspended';
  purchased_at?: string;
}

/**
 * Canonical business-hours wire shape — stored as JSONB on
 * `front_desk_configs.business_hours`. Seven keys (mon..sun), each with
 * `open` (bool) and `startTime`/`endTime` (HH:MM 24h strings). The
 * personalization webhook reads this column to compute `is_open_now` and
 * `is_after_hours` against the office's wall-clock time.
 */
export interface BusinessHoursWire {
  mon?: { open: boolean; startTime?: string; endTime?: string };
  tue?: { open: boolean; startTime?: string; endTime?: string };
  wed?: { open: boolean; startTime?: string; endTime?: string };
  thu?: { open: boolean; startTime?: string; endTime?: string };
  fri?: { open: boolean; startTime?: string; endTime?: string };
  sat?: { open: boolean; startTime?: string; endTime?: string };
  sun?: { open: boolean; startTime?: string; endTime?: string };
}

export interface FrontDeskConfigPatchPartial {
  public_number_mode?: PublicNumberMode;
  catch_mode?: CatchMode;
  after_hours_mode?: AfterHoursMode;
  busy_mode?: BusyMode;
  greeting_name_override?: string;
  pronunciation_override?: string;
  /** Hours tab — full 7-day shape. Server stores as-is on JSONB column. */
  business_hours?: BusinessHoursWire;
  /** IANA timezone (e.g. "America/Los_Angeles"). Controls is_open_now eval. */
  timezone?: string;
  /** Dedicated voicemail inbox — relayed by handler to suite_profiles. */
  voicemail_email?: string;
  /**
   * Switch the AI receptionist persona. When changed, the backend re-attaches
   * the office's EL phone number to the new persona's agent (Yellow tier —
   * server proxy mints `front_desk:config_save` capability token).
   */
  receptionist_persona?: ReceptionistPersonaSlug;
}

/**
 * Receptionist persona registry entry — mirrors `services.receptionist_personas`
 * on the backend. Keep field names aligned with the dataclass `to_dict()` output.
 */
export interface ReceptionistPersonaWire {
  slug: ReceptionistPersonaSlug;
  agent_id: string;
  voice_id: string;
  display_name: string;
  role_label: string;
  /** Static asset path served by Aspire-desktop, e.g. "/personas/sarah.png". */
  headshot_url: string;
  /** Static asset path served by Aspire-desktop, e.g. "/personas/sarah.mp3". */
  preview_url: string;
  accent_color: string;
  description: string;
}

export interface ReceptionistPersonasResponse {
  success: boolean;
  default_persona: ReceptionistPersonaSlug;
  personas: ReceptionistPersonaWire[];
}

export interface FrontDeskConfigPatchResponse {
  success: boolean;
  config: FrontDeskConfigRow;
  receipt_id: string;
}

export interface TestCallResponse {
  success: boolean;
  test_result: 'success' | 'failed';
  call_sid: string;
  receipt_id: string;
}

// ---------------------------------------------------------------------------
// Twilio number types — mirror routes/telephony.py response shape.
// ---------------------------------------------------------------------------

export interface AvailableNumber {
  phone_number: string;
  region?: string;
  monthly_cost_cents?: number;
  capabilities?: { voice?: boolean; sms?: boolean; mms?: boolean };
}

export interface AvailableNumbersResponse {
  success: boolean;
  numbers: AvailableNumber[];
  count: number;
}

export interface PurchasedNumber {
  phone_number: string;
  twilio_sid: string;
  elevenlabs_phone_number_id: string;
  attached_to_agent_id: string;
  receipt_id: string;
  purchased_at: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const PROXY_PREFIX = '/api/v1';

interface FetchOpts {
  authenticatedFetch: FetchFn;
  officeId: string;
  signal?: AbortSignal;
}

/**
 * Green tier — fetch the static receptionist persona registry. Cached by the
 * caller (it never changes within a session). Does not require auth — backend
 * GET /personas is read-only static data, but we route through the proxy for
 * consistency with the rest of the Front Desk API surface.
 */
export async function fetchReceptionistPersonas(
  opts: { authenticatedFetch: FetchFn; signal?: AbortSignal },
): Promise<ReceptionistPersonasResponse> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/personas`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    signal: opts.signal,
  });
  return expectJson<ReceptionistPersonasResponse>(
    resp,
    'FRONT_DESK_PERSONAS_FAILED',
  );
}

export async function fetchFrontDeskConfig(
  opts: FetchOpts,
): Promise<FrontDeskConfigResponse> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/config?office_id=${encodeURIComponent(opts.officeId)}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  return expectJson<FrontDeskConfigResponse>(resp, 'FRONT_DESK_CONFIG_GET_FAILED');
}

/**
 * Yellow tier write — server proxy mints the capability token (scope =
 * `front_desk:config_save`) before forwarding to the orchestrator.
 */
export async function patchFrontDeskConfig(
  opts: FetchOpts,
  partial: FrontDeskConfigPatchPartial,
): Promise<FrontDeskConfigPatchResponse> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/config`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify(partial),
    signal: opts.signal,
  });
  return expectJson<FrontDeskConfigPatchResponse>(resp, 'FRONT_DESK_CONFIG_PATCH_FAILED');
}

/**
 * Pass 19 §3.3 — `LOCAL` (default) hits Twilio AvailablePhoneNumbers/Local;
 * `TOLL_FREE` hits AvailablePhoneNumbers/TollFree (non-geographic, area-code
 * ignored backend-side).
 */
export type NumberTypeWire = 'LOCAL' | 'TOLL_FREE';

/**
 * Green tier — search Twilio available US numbers (local or toll-free).
 *
 * @param numberType `'LOCAL'` (default) or `'TOLL_FREE'`. When toll-free, the
 *                   `areaCode` argument is ignored backend-side (toll-free
 *                   numbers are non-geographic).
 */
export async function searchAvailableNumbers(
  opts: FetchOpts,
  areaCode: string,
  contains?: string,
  limit: number = 20,
  numberType: NumberTypeWire = 'LOCAL',
): Promise<AvailableNumber[]> {
  const url = `${API_BASE}${PROXY_PREFIX}/twilio/available-numbers`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({
      area_code: areaCode,
      contains,
      limit,
      number_type: numberType,
    }),
    signal: opts.signal,
  });
  const json = await expectJson<AvailableNumbersResponse>(resp, 'TWILIO_SEARCH_FAILED');
  return json.numbers ?? [];
}

// ---------------------------------------------------------------------------
// Forwarding instructions (§3.1 + ForwardingInstructionsCard) — Green tier.
// Lane B (`/v1/front-desk/forwarding-instructions`) returns carrier-specific
// conditional-forwarding codes pre-formatted with the Aspire forward-target.
// ---------------------------------------------------------------------------

export interface ForwardingCodeSetWire {
  always: string;
  busy: string;
  no_answer: string;
  unreachable: string;
}

export interface ForwardingInstructionsWire {
  success: boolean;
  carrier_name: string;
  codes: ForwardingCodeSetWire;
  aspire_forward_target: string;
  help_url?: string;
}

/**
 * Green tier — resolve the owner's existing-carrier number via Twilio Lookup
 * v2 and return the carrier-specific conditional-forwarding codes (e.g.
 * AT&T `**21*` / `**61*`, Verizon `*72` / `*71`), plus the Aspire
 * forward-target the codes route to.
 */
export async function fetchForwardingInstructions(
  opts: FetchOpts,
  phoneNumber: string,
): Promise<ForwardingInstructionsWire> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/forwarding-instructions?phone=${encodeURIComponent(phoneNumber)}&office_id=${encodeURIComponent(opts.officeId)}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  return expectJson<ForwardingInstructionsWire>(
    resp,
    'FORWARDING_INSTRUCTIONS_FAILED',
  );
}

/**
 * Yellow tier — purchase a Twilio number, import to ElevenLabs, attach to
 * Sarah Receptionist. Server proxy mints capability token (scope =
 * `telephony:purchase`) before forwarding.
 *
 * @param idempotencyKey caller-supplied key; required by backend (10-128 chars).
 */
export async function purchaseNumber(
  opts: FetchOpts,
  phoneNumber: string,
  idempotencyKey: string,
): Promise<PurchasedNumber> {
  const url = `${API_BASE}${PROXY_PREFIX}/twilio/purchase-number`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      idempotency_key: idempotencyKey,
    }),
    signal: opts.signal,
  });
  const json = await expectJson<PurchasedNumber & { success: boolean }>(resp, 'TWILIO_PURCHASE_FAILED');
  return {
    phone_number: json.phone_number,
    twilio_sid: json.twilio_sid,
    elevenlabs_phone_number_id: json.elevenlabs_phone_number_id,
    attached_to_agent_id: json.attached_to_agent_id,
    receipt_id: json.receipt_id,
    purchased_at: json.purchased_at,
  };
}

// ---------------------------------------------------------------------------
// Routing contacts CRUD — Yellow tier per route. Server proxy mints capability
// tokens (scope = `front_desk:routing_write`) before forwarding to orchestrator.
// All three routes return a fresh `RoutingContactRow` (POST/PATCH) or
// `{success}` (DELETE) — see backend/.../routes/front_desk.py:412-560.
// ---------------------------------------------------------------------------

/**
 * Wire payload for POST /v1/front-desk/routing-contacts.
 * The backend accepts both `name` (canonical, matches DB) and `label`
 * (legacy alias). We send `label` here for backward compat with older
 * orchestrator versions; once everything is on the new schema we'll
 * switch the wire to `name`.
 */
export interface RoutingContactCreatePayload {
  role: string;
  label: string;
  phone?: string;
  sip_uri?: string;
  email?: string;
  transfer_allowed?: boolean;
  fallback_mode?: string;
  sort_order?: number;
}

export interface RoutingContactPatchPayload {
  role?: string;
  label?: string;
  phone?: string;
  sip_uri?: string;
  email?: string;
  transfer_allowed?: boolean;
  fallback_mode?: string;
  sort_order?: number;
}

export async function createRoutingContact(
  opts: FetchOpts,
  payload: RoutingContactCreatePayload,
): Promise<RoutingContactRow> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/routing-contacts`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  const json = await expectJson<{ success: boolean; contact: RoutingContactRow }>(
    resp,
    'ROUTING_CONTACT_CREATE_FAILED',
  );
  return json.contact;
}

export async function updateRoutingContact(
  opts: FetchOpts,
  contactId: string,
  payload: RoutingContactPatchPayload,
): Promise<RoutingContactRow> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/routing-contacts/${encodeURIComponent(contactId)}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  const json = await expectJson<{ success: boolean; contact: RoutingContactRow }>(
    resp,
    'ROUTING_CONTACT_PATCH_FAILED',
  );
  return json.contact;
}

export async function deleteRoutingContact(
  opts: FetchOpts,
  contactId: string,
): Promise<void> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/routing-contacts/${encodeURIComponent(contactId)}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'DELETE',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  await expectJson<{ success: boolean }>(resp, 'ROUTING_CONTACT_DELETE_FAILED');
}

/**
 * Yellow tier — fire a test inbound call to the office's purchased number.
 * Server proxy mints capability token (scope = `front_desk:test_call`) before
 * forwarding.
 */
export async function triggerTestCall(opts: FetchOpts): Promise<TestCallResponse> {
  const url = `${API_BASE}${PROXY_PREFIX}/front-desk/config/test-call`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  return expectJson<TestCallResponse>(resp, 'FRONT_DESK_TEST_CALL_FAILED');
}
