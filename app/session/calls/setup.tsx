/**
 * Front Desk Setup — page shell (Pass 19 update — plan §6.1).
 *
 * Pass 19 changes:
 *   - Replaces legacy `/api/frontdesk/setup` GET/PATCH with the versioned
 *     `lib/api/frontDesk.ts` (`fetchFrontDeskConfig` / `patchFrontDeskConfig`).
 *     Save now mints a capability token server-side and writes through the
 *     same proxy pattern as Office Memory.
 *   - Drops the hardcoded `availableNumbers` demo array — the picker sheet
 *     now owns search results and returns the purchased number via
 *     `onPurchased`. The page records the selected number and re-fetches
 *     config so the rail / summary reflect Twilio truth.
 *   - Wires the §3.2 Catch×Public-Number interlock: when CatchCallsSection
 *     reports `severity === 'invalid'` we mark that tab as invalid and
 *     disable the hero Save button.
 *
 * Per §12.1 Framer-style: every screen has one job. The active section
 * gets the canvas it deserves (max-width 880, generous padding) so the
 * forms breathe and feel premium instead of cramped. Tab switching
 * preserves in-memory state — no resets.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { triggerTestIncomingCall } from '@/lib/incomingCallOverlayStore';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  fetchFrontDeskConfig,
  fetchReceptionistPersonas,
  patchFrontDeskConfig,
  createRoutingContact,
  updateRoutingContact,
  deleteRoutingContact,
  triggerTestCall as apiTriggerTestCall,
  type FrontDeskConfigRow,
  type FrontDeskConfigPatchPartial,
  type ReceptionistPersonaSlug as ApiReceptionistPersonaSlug,
  type ReceptionistPersonaWire,
  type RoutingContactRow,
  type AspireNumberInfo,
  type AfterHoursMode as ApiAfterHoursMode,
  type BusyMode as ApiBusyMode,
} from '@/lib/api/frontDesk';

// New section components (Pass 10 Lane B + Pass 16 UI + Pass 19 rewrite)
import { FrontDeskSetupHero } from '@/components/calls/setup/FrontDeskSetupHero';
import {
  FrontDeskSetupTabs,
  FRONT_DESK_TABS,
  type FrontDeskTabId,
} from '@/components/calls/setup/FrontDeskSetupTabs';
import { ReceptionistSection } from '@/components/calls/setup/ReceptionistSection';
import { PublicNumberSection } from '@/components/calls/setup/PublicNumberSection';
import { CatchCallsSection } from '@/components/calls/setup/CatchCallsSection';
import { BusinessHoursSection } from '@/components/calls/setup/BusinessHoursSection';
import { RoutingContactsSection } from '@/components/calls/setup/RoutingContactsSection';
import { BusyModeSection } from '@/components/calls/setup/BusyModeSection';
import { SarahStatusRail } from '@/components/calls/setup/SarahStatusRail';

import type {
  FrontDeskConfig,
  PublicNumberConfig,
  PublicNumberMode,
  CatchMode,
  BusinessHoursConfig,
  BusinessHourDay,
  RoutingContact,
  BusyMode,
  AfterHoursMode,
  ForwardingVerification,
  ReceptionistPersonaSlug,
  SarahStatus,
  SetupSummaryItem,
  CatchInterlockResult,
} from '@/components/calls/setup/setup-types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: FrontDeskConfig = {
  publicNumber: { mode: 'ASPIRE_NEW_NUMBER' },
  catch: { mode: 'APP_AND_PHONE_SIMUL_RING' },
  businessHours: {
    days: [
      { day: 'mon', open: true, startTime: '09:00', endTime: '17:00' },
      { day: 'tue', open: true, startTime: '09:00', endTime: '17:00' },
      { day: 'wed', open: true, startTime: '09:00', endTime: '17:00' },
      { day: 'thu', open: true, startTime: '09:00', endTime: '17:00' },
      { day: 'fri', open: true, startTime: '09:00', endTime: '17:00' },
      { day: 'sat', open: false },
      { day: 'sun', open: false },
    ],
    afterHoursMode: 'TAKE_MESSAGE',
    pronunciationOverride: '',
  },
  routingContacts: [],
  busy: { mode: 'TAKE_MESSAGE' },
  forwarding: undefined,
  receptionistPersona: 'sarah',
  version: 1,
};

/**
 * Persona-aware status rail data. The display name + headshot reflect the
 * tenant's chosen persona on every render. Until the personas registry has
 * loaded we fall back to "Receptionist" so the UI never shows the wrong name.
 */
const RECEPTIONIST_FALLBACK: SarahStatus = {
  active: true,
  displayName: 'Receptionist',
  roleLabel: 'AI Front Desk Agent',
};

// ---------------------------------------------------------------------------
// Wire-format adapters (versioned API ↔ frontend type)
// ---------------------------------------------------------------------------

const AFTER_HOURS_WIRE_TO_FE: Record<ApiAfterHoursMode, AfterHoursMode> = {
  take_message: 'TAKE_MESSAGE',
  ask_callback_window: 'ASK_CALLBACK_WINDOW',
  callback_window: 'ASK_CALLBACK_WINDOW',
  try_transfer_then_message: 'TRY_TRANSFER_THEN_MESSAGE',
};
const AFTER_HOURS_FE_TO_WIRE: Record<AfterHoursMode, ApiAfterHoursMode> = {
  TAKE_MESSAGE: 'take_message',
  ASK_CALLBACK_WINDOW: 'ask_callback_window',
  TRY_TRANSFER_THEN_MESSAGE: 'try_transfer_then_message',
};
const BUSY_WIRE_TO_FE: Record<ApiBusyMode, BusyMode> = {
  take_message: 'TAKE_MESSAGE',
  ask_callback_window: 'ASK_CALLBACK_WINDOW',
  callback_window: 'ASK_CALLBACK_WINDOW',
  try_transfer_then_message: 'TRY_TRANSFER_THEN_MESSAGE',
};
const BUSY_FE_TO_WIRE: Record<BusyMode, ApiBusyMode> = {
  TAKE_MESSAGE: 'take_message',
  ASK_CALLBACK_WINDOW: 'ask_callback_window',
  TRY_TRANSFER_THEN_MESSAGE: 'try_transfer_then_message',
};

/**
 * Project a server-shaped `RoutingContactRow` into the local `RoutingContact`
 * UI shape. The backend stores the canonical role string + display label;
 * the frontend type carries extra UI-only fields (fallbackMode, priority,
 * initials) which default to safe values on hydrate.
 */
const KNOWN_ROLES: ReadonlySet<RoutingContact['role']> = new Set([
  'owner',
  'sales',
  'support',
  'operations',
  'custom',
]);

function mapWireToContact(row: RoutingContactRow, index: number): RoutingContact {
  const wireRole = (row.role ?? '').toLowerCase();
  const role = (KNOWN_ROLES.has(wireRole as RoutingContact['role'])
    ? (wireRole as RoutingContact['role'])
    : 'custom') as RoutingContact['role'];
  // Live DB column is `name`; older clients may surface `label` — read both.
  const display = (row.name ?? row.label ?? '').toString();
  const initials =
    display
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('') || '??';
  const fallbackMode =
    row.fallback_mode === 'message_only' || row.fallback_mode === 'message_fallback'
      ? 'MESSAGE_FALLBACK'
      : 'TRANSFER_ALLOWED';
  return {
    id: row.id,
    role,
    customRoleLabel: role === 'custom' ? row.role : undefined,
    name: display,
    phone: row.phone || '',
    initials,
    fallbackMode,
    transferAllowed: row.transfer_allowed ?? true,
    priority: typeof row.sort_order === 'number' ? row.sort_order : index,
  };
}

function normalizePublicNumberMode(mode: string | null | undefined): PublicNumberMode {
  if (mode === 'FORWARD_EXISTING' || mode === 'KEEP_CURRENT_NUMBER') {
    return 'FORWARD_EXISTING';
  }
  if (mode === 'PORT_IN') {
    return 'PORT_IN';
  }
  return 'ASPIRE_NEW_NUMBER';
}

function normalizeRoutingPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return phone.trim();
}

/**
 * Hydrate the FrontDeskConfig from the versioned `/v1/front-desk/config`
 * response. The wire row carries the form-level fields; routing contacts
 * come from a sibling `routing_contacts` array on the same response.
 */
function hydrateFromVersionedConfig(
  row: FrontDeskConfigRow | Record<string, never> | undefined,
  routingContacts: RoutingContactRow[] | undefined,
  base: FrontDeskConfig,
  voicemailEmail?: string,
): FrontDeskConfig {
  if (!row || !('id' in row)) {
    return {
      ...base,
      routingContacts: (routingContacts ?? []).map(mapWireToContact),
      businessHours: {
        ...base.businessHours,
        voicemailEmail: voicemailEmail ?? base.businessHours.voicemailEmail,
      },
    };
  }

  const publicNumberMode = normalizePublicNumberMode(row.public_number_mode);
  const forwarding: ForwardingVerification | undefined =
    publicNumberMode === 'FORWARD_EXISTING'
      ? {
          status: row.forwarding_status ?? 'NOT_CONFIGURED',
          lastTestAt: row.last_forwarding_test_at ?? undefined,
          lastTestErrorMessage: row.last_forwarding_test_result ?? undefined,
        }
      : undefined;

  // Project the saved 7-key business_hours JSONB back into the local
  // BusinessHourDay[] shape. If the row predates Pass 19 (no business_hours
  // saved yet), fall back to the base/default schedule.
  const dayKeys: BusinessHourDay['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const wireHours = row.business_hours ?? null;
  const hydratedDays: BusinessHourDay[] = wireHours
    ? dayKeys.map((d) => {
        const w = (wireHours as Record<string, { open: boolean; startTime?: string; endTime?: string } | undefined>)[d];
        const fallback = base.businessHours.days.find((bd) => bd.day === d);
        return {
          day: d,
          open: w?.open ?? fallback?.open ?? false,
          startTime: w?.startTime ?? fallback?.startTime,
          endTime: w?.endTime ?? fallback?.endTime,
        };
      })
    : base.businessHours.days;

  // Receptionist persona — defaults to 'sarah' for rows that predate
  // migration 109 or for offices that haven't customized yet.
  const receptionistPersona: ReceptionistPersonaSlug =
    (row.receptionist_persona as ReceptionistPersonaSlug | null) === 'tiffany'
      ? 'tiffany'
      : 'sarah';

  return {
    ...base,
    publicNumber: {
      ...base.publicNumber,
      mode: publicNumberMode,
    },
    catch: { mode: row.catch_mode },
    businessHours: {
      ...base.businessHours,
      days: hydratedDays,
      afterHoursMode: AFTER_HOURS_WIRE_TO_FE[row.after_hours_mode] ?? 'TAKE_MESSAGE',
      pronunciationOverride: row.pronunciation_override || base.businessHours.pronunciationOverride,
      timezone: row.timezone || base.businessHours.timezone,
      voicemailEmail: voicemailEmail ?? base.businessHours.voicemailEmail,
    },
    busy: { mode: BUSY_WIRE_TO_FE[row.busy_mode] ?? 'TAKE_MESSAGE' },
    routingContacts: (routingContacts ?? []).map(mapWireToContact),
    forwarding,
    receptionistPersona,
    version: row.version_no ?? 1,
  };
}

/**
 * Build the partial PATCH body for `/v1/front-desk/config`. The backend
 * expects only the fields that changed; we send the canonical projection
 * for every save (the orchestrator versions on the write).
 */
function buildPatchBody(config: FrontDeskConfig): FrontDeskConfigPatchPartial {
  // Project the per-day in-memory shape into the canonical 7-key wire shape
  // expected by the backend (front_desk_configs.business_hours JSONB column).
  const businessHoursWire: Record<string, { open: boolean; startTime?: string; endTime?: string }> = {};
  for (const d of config.businessHours.days) {
    businessHoursWire[d.day] = {
      open: !!d.open,
      ...(d.startTime ? { startTime: d.startTime } : {}),
      ...(d.endTime ? { endTime: d.endTime } : {}),
    };
  }
  const patch: FrontDeskConfigPatchPartial = {
    public_number_mode: config.publicNumber.mode,
    catch_mode: config.catch.mode,
    after_hours_mode: AFTER_HOURS_FE_TO_WIRE[config.businessHours.afterHoursMode],
    busy_mode: BUSY_FE_TO_WIRE[config.busy.mode],
    pronunciation_override: config.businessHours.pronunciationOverride ?? '',
    business_hours: businessHoursWire,
    receptionist_persona: config.receptionistPersona,
  };
  if (config.businessHours.timezone) {
    patch.timezone = config.businessHours.timezone;
  }
  // Send voicemail_email even when blank — empty string is the explicit
  // "clear" signal for an existing voicemail address. The handler relays
  // null vs unset to suite_profiles correctly.
  if (typeof config.businessHours.voicemailEmail === 'string') {
    patch.voicemail_email = config.businessHours.voicemailEmail.trim();
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Page-level summary derivation
// ---------------------------------------------------------------------------

function buildSummary(config: FrontDeskConfig): SetupSummaryItem[] {
  const open = config.businessHours.days.filter((d) => d.open);
  const openLabel =
    open.length === 0
      ? 'Always closed'
      : open.length === 7
        ? 'Every day'
        : `${dayShort(open[0].day)}–${dayShort(open[open.length - 1].day)}, ${open[0].startTime}–${open[0].endTime}`;

  const afterHoursLabel =
    config.businessHours.afterHoursMode === 'TAKE_MESSAGE'
      ? 'Take message'
      : config.businessHours.afterHoursMode === 'ASK_CALLBACK_WINDOW'
        ? 'Ask callback'
        : 'Try transfer first';

  const catchLabel =
    config.catch.mode === 'APP_ONLY'
      ? 'In Aspire'
      : config.catch.mode === 'PHONE_ONLY'
        ? 'On my phone'
        : 'Ring both';

  const publicNumberLabel: string =
    config.publicNumber.mode === 'ASPIRE_NEW_NUMBER'
      ? 'Aspire — new'
      : config.publicNumber.mode === 'FORWARD_EXISTING'
        ? 'Forward existing'
        : 'Port-in (V1.1)';

  return [
    {
      iconName: 'call-outline',
      label: 'Public number',
      value: publicNumberLabel,
    },
    { iconName: 'arrow-redo-outline', label: 'Catch calls', value: catchLabel },
    { iconName: 'time-outline', label: 'Open hours', value: openLabel },
    { iconName: 'moon-outline', label: 'After hours', value: afterHoursLabel },
    {
      iconName: 'people-outline',
      label: 'Routing contacts',
      value: `${config.routingContacts.length} configured`,
    },
  ];
}

function dayShort(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

// ---------------------------------------------------------------------------
// Per-tab dirty diff
// ---------------------------------------------------------------------------

function diffDirtyTabs(
  current: FrontDeskConfig,
  original: FrontDeskConfig,
): Set<FrontDeskTabId> {
  const dirty = new Set<FrontDeskTabId>();
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (current.receptionistPersona !== original.receptionistPersona) dirty.add('receptionist');
  if (!eq(current.publicNumber, original.publicNumber)) dirty.add('public-number');
  if (!eq(current.catch, original.catch)) dirty.add('catch');
  if (!eq(current.businessHours, original.businessHours)) dirty.add('hours');
  if (!eq(current.routingContacts, original.routingContacts)) dirty.add('routing');
  if (!eq(current.busy, original.busy)) dirty.add('busy');
  return dirty;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FrontDeskSetupContent() {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? null;

  const [config, setConfig] = useState<FrontDeskConfig>(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<FrontDeskConfig>(DEFAULT_CONFIG);
  // Receptionist tab is the first decision a tenant makes — start there so
  // brand-new offices see the persona picker on first visit.
  const [activeTab, setActiveTab] = useState<FrontDeskTabId>('receptionist');

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [aspireNumber, setAspireNumber] = useState<AspireNumberInfo | null>(null);

  // Receptionist persona registry — fetched once. Static data, safe to keep
  // for the page lifetime. Loading/error UI lives inside ReceptionistSection.
  const [personas, setPersonas] = useState<readonly ReceptionistPersonaWire[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState<string | null>(null);

  // §3.2 interlock — invalid tabs disable Save.
  const [catchInterlock, setCatchInterlock] = useState<CatchInterlockResult>({
    severity: 'ok',
    message: '',
  });

  // Forwarding-test in-flight indicator (drives the spinner inside the
  // ForwardingInstructionsCard inside PublicNumberSection).
  const [isTestingForwarding, setIsTestingForwarding] = useState(false);

  // ----- Hydrate on mount ----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!officeId) return; // wait for tenant to resolve

    (async () => {
      try {
        const res = await fetchFrontDeskConfig({ authenticatedFetch, officeId });
        if (cancelled) return;
        const hydrated = hydrateFromVersionedConfig(
          res.config,
          res.routing_contacts,
          DEFAULT_CONFIG,
          res.voicemail_email,
        );
        setConfig(hydrated);
        setOriginalConfig(hydrated);
        setAspireNumber(res.aspire_number ?? null);
        setHydrationError(null);
      } catch (err) {
        if (cancelled) return;
        // Fail-soft: keep defaults but surface the error so users see why.
        setHydrationError(err instanceof Error ? err.message : 'Could not load setup.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, officeId]);

  // ----- Fetch persona registry once on mount -------------------------
  useEffect(() => {
    let cancelled = false;
    setPersonasLoading(true);
    (async () => {
      try {
        const res = await fetchReceptionistPersonas({ authenticatedFetch });
        if (cancelled) return;
        setPersonas(res.personas ?? []);
        setPersonasError(null);
      } catch (err) {
        if (cancelled) return;
        setPersonasError(
          err instanceof Error
            ? err.message
            : 'Could not load receptionist personas.',
        );
      } finally {
        if (!cancelled) setPersonasLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch]);

  // ----- Derived state -------------------------------------------------
  const dirtyTabs = useMemo(
    () => diffDirtyTabs(config, originalConfig),
    [config, originalConfig],
  );
  const invalidTabs = useMemo<Set<FrontDeskTabId>>(() => {
    const set = new Set<FrontDeskTabId>();
    if (catchInterlock.severity === 'invalid') set.add('catch');
    return set;
  }, [catchInterlock]);
  const isDirty = dirtyTabs.size > 0;
  const hasInvalid = invalidTabs.size > 0;

  // ----- Patchers ------------------------------------------------------
  const updatePersona = useCallback((slug: ReceptionistPersonaSlug) => {
    setConfig((prev) => ({ ...prev, receptionistPersona: slug }));
  }, []);

  const updatePublicNumber = useCallback((p: Partial<PublicNumberConfig>) => {
    setConfig((prev) => ({ ...prev, publicNumber: { ...prev.publicNumber, ...p } }));
  }, []);

  const updateCatch = useCallback((mode: CatchMode) => {
    setConfig((prev) => ({ ...prev, catch: { mode } }));
  }, []);

  const updateBusinessHours = useCallback((p: Partial<BusinessHoursConfig>) => {
    setConfig((prev) => ({ ...prev, businessHours: { ...prev.businessHours, ...p } }));
  }, []);

  const updateContacts = useCallback((contacts: RoutingContact[]) => {
    setConfig((prev) => ({ ...prev, routingContacts: contacts }));
  }, []);

  const updateBusy = useCallback((mode: BusyMode) => {
    setConfig((prev) => ({ ...prev, busy: { mode } }));
  }, []);

  // ----- Refresh from server (after a purchase or test-call) ----------
  const refreshFromServer = useCallback(async () => {
    if (!officeId) return;
    try {
      const res = await fetchFrontDeskConfig({ authenticatedFetch, officeId });
      const hydrated = hydrateFromVersionedConfig(
        res.config,
        res.routing_contacts,
        config,
        res.voicemail_email,
      );
      setConfig(hydrated);
      setOriginalConfig(hydrated);
      setAspireNumber(res.aspire_number ?? null);
    } catch {
      // Soft-fail — original config + local edits remain.
    }
  }, [authenticatedFetch, officeId, config]);

  // ----- Save ----------------------------------------------------------
  const onSave = useCallback(async () => {
    if (!isDirty || isSaving || hasInvalid || !officeId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // 1) Save the form-level config (Public Number, Catch, Hours, Busy).
      const body = buildPatchBody(config);
      await patchFrontDeskConfig({ authenticatedFetch, officeId }, body);

      // 2) Persist routing-contact CRUD via the dedicated Yellow-tier endpoints.
      //    Diff against the server snapshot (originalConfig.routingContacts):
      //      - in new but NOT in original (by id)        -> POST
      //      - in both with changed fields                -> PATCH
      //      - in original but NOT in new                 -> DELETE
      //    Local IDs from the section's add flow are temp client-side ids.
      //    The server returns the canonical UUID on POST; we reconcile state
      //    via a refreshFromServer() at the end.
      const prevById = new Map(originalConfig.routingContacts.map((c) => [c.id, c]));
      const newById = new Map(config.routingContacts.map((c) => [c.id, c]));
      const toCreate = config.routingContacts.filter((c) => !prevById.has(c.id));
      const toDelete = originalConfig.routingContacts.filter((c) => !newById.has(c.id));
      const toUpdate = config.routingContacts.filter((c) => {
        const prev = prevById.get(c.id);
        if (!prev) return false;
        return (
          prev.name !== c.name ||
          prev.phone !== c.phone ||
          prev.role !== c.role ||
          prev.customRoleLabel !== c.customRoleLabel
        );
      });

      const opts = { authenticatedFetch, officeId };
      const ops: Promise<unknown>[] = [];
      for (const c of toCreate) {
        ops.push(
          createRoutingContact(opts, {
            role: c.role === 'custom' ? c.customRoleLabel || 'custom' : c.role,
            label: c.name,
            phone: normalizeRoutingPhone(c.phone),
            transfer_allowed: c.transferAllowed,
            fallback_mode:
              c.fallbackMode === 'MESSAGE_FALLBACK' ? 'message_fallback' : 'transfer_allowed',
            sort_order: c.priority,
          }),
        );
      }
      for (const c of toUpdate) {
        ops.push(
          updateRoutingContact(opts, c.id, {
            role: c.role === 'custom' ? c.customRoleLabel || 'custom' : c.role,
            label: c.name,
            phone: normalizeRoutingPhone(c.phone),
            transfer_allowed: c.transferAllowed,
            fallback_mode:
              c.fallbackMode === 'MESSAGE_FALLBACK' ? 'message_fallback' : 'transfer_allowed',
            sort_order: c.priority,
          }),
        );
      }
      for (const c of toDelete) {
        ops.push(deleteRoutingContact(opts, c.id));
      }
      if (ops.length > 0) {
        await Promise.all(ops);
      }

      // 3) Re-hydrate from server so local state reflects canonical UUIDs +
      //    the bumped version_no on front_desk_configs.
      await refreshFromServer();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [
    isDirty,
    isSaving,
    hasInvalid,
    officeId,
    config,
    originalConfig,
    authenticatedFetch,
    refreshFromServer,
  ]);

  // ----- Test incoming call -------------------------------------------
  const onTest = useCallback(async () => {
    setIsTesting(true);
    // Local UI overlay first (snappy preview), then real backend call.
    triggerTestIncomingCall();
    if (officeId) {
      try {
        await apiTriggerTestCall({ authenticatedFetch, officeId });
      } catch {
        // Non-fatal; the local overlay already showed.
      }
    }
    setTimeout(() => setIsTesting(false), 1200);
  }, [authenticatedFetch, officeId]);

  // ----- Forwarding test (FORWARD_EXISTING only) -----------------------
  const onTestForwarding = useCallback(async () => {
    if (!officeId) return;
    setIsTestingForwarding(true);
    try {
      await apiTriggerTestCall({ authenticatedFetch, officeId });
      await refreshFromServer();
    } catch {
      // Card surfaces its own error UI on the next render via forwarding state.
    } finally {
      setIsTestingForwarding(false);
    }
  }, [authenticatedFetch, officeId, refreshFromServer]);

  // ----- Right rail data ----------------------------------------------
  const summary = useMemo(() => buildSummary(config), [config]);

  // Persona-aware status — driven by the chosen receptionist + registry.
  // Falls back to `RECEPTIONIST_FALLBACK` until personas hydrate so the rail
  // never flashes "Sarah" for a Tiffany tenant on first paint.
  const selectedPersona = useMemo(
    () => personas.find((p) => p.slug === config.receptionistPersona),
    [personas, config.receptionistPersona],
  );
  const selectedPersonaStatus: SarahStatus = useMemo(
    () =>
      selectedPersona
        ? {
            active: true,
            displayName: selectedPersona.display_name,
            roleLabel: selectedPersona.role_label,
          }
        : RECEPTIONIST_FALLBACK,
    [selectedPersona],
  );

  // ----- Render the active tab body -----------------------------------
  const renderTabBody = (): React.ReactNode => {
    switch (activeTab) {
      case 'receptionist':
        return (
          <ReceptionistSection
            selectedSlug={config.receptionistPersona}
            personas={personas}
            isLoading={personasLoading}
            error={personasError}
            onChange={updatePersona}
            enterIndex={0}
          />
        );
      case 'public-number':
        return (
          <PublicNumberSection
            config={config.publicNumber}
            onChange={updatePublicNumber}
            enterIndex={0}
            onTestForwarding={onTestForwarding}
            isTestingForwarding={isTestingForwarding}
          />
        );
      case 'catch':
        return (
          <CatchCallsSection
            mode={config.catch.mode}
            onChange={updateCatch}
            publicNumberMode={config.publicNumber.mode}
            onValidityChange={setCatchInterlock}
            enterIndex={0}
          />
        );
      case 'hours':
        return (
          <BusinessHoursSection
            config={config.businessHours}
            onChange={updateBusinessHours}
            enterIndex={0}
          />
        );
      case 'routing':
        return (
          <RoutingContactsSection
            contacts={config.routingContacts}
            onChange={updateContacts}
            enterIndex={0}
          />
        );
      case 'busy':
        return (
          <BusyModeSection
            mode={config.busy.mode}
            onChange={updateBusy}
            enterIndex={0}
          />
        );
    }
  };

  const activeTabLabel =
    FRONT_DESK_TABS.find((t) => t.id === activeTab)?.label ?? 'Section';

  // Disabled save when nothing changed OR when an invalid combo is present.
  const saveDisabledReason = hasInvalid
    ? 'Resolve the invalid Catch×Public-Number combo before saving.'
    : saveError ?? hydrationError ?? '';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <FrontDeskSetupHero
        onSave={onSave}
        onTest={onTest}
        isSaving={isSaving}
        isTesting={isTesting}
        isDirty={isDirty && !hasInvalid}
        sarahActive={selectedPersonaStatus.active}
        saveDisabledReason={saveDisabledReason || undefined}
      />

      {/* Tab nav */}
      <View style={styles.tabsWrap}>
        <FrontDeskSetupTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          dirtyTabs={dirtyTabs}
          invalidTabs={invalidTabs}
        />
      </View>

      {/* 2-column body — center stage + sticky right rail */}
      <View style={styles.bodyGrid}>
        <View style={styles.mainCol}>
          <View
            style={styles.centerStage}
            key={`stage-${activeTab}`}
            accessibilityLabel={activeTabLabel}
          >
            {renderTabBody()}
          </View>
        </View>

        <View style={styles.railCol}>
          <View style={styles.railSticky}>
            <SarahStatusRail
              sarah={selectedPersonaStatus}
              summary={summary}
              forwarding={config.forwarding}
              publicNumberMode={config.publicNumber.mode}
              publicNumberConfig={config.publicNumber}
              aspireNumber={aspireNumber}
              headshotUrl={selectedPersona?.headshot_url}
              accentColor={selectedPersona?.accent_color}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  scrollContent: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 80,
    gap: 20,
    ...(Platform.OS === 'web'
      ? ({ maxWidth: 1480, marginHorizontal: 'auto' as const, width: '100%' } as object)
      : {}),
  } as any,

  // ----- Tab nav strip -------------------------------------------------
  tabsWrap: {
    paddingHorizontal: 4,
  },

  // ----- Body grid -----------------------------------------------------
  bodyGrid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  mainCol: {
    flex: 7,
    minWidth: 600,
  },
  railCol: {
    flex: 3,
    minWidth: 320,
  },
  railSticky: {
    ...(Platform.OS === 'web'
      ? ({ position: 'sticky', top: 96 } as unknown as ViewStyle)
      : {}),
  } as any,

  // ----- Center stage --------------------------------------------------
  centerStage: {
    width: '100%',
    maxWidth: 880,
    marginHorizontal: 'auto' as const,
    paddingHorizontal: Platform.OS === 'web' ? 8 : 0,
  } as any,
});

// Surface unused-import warnings for tokens (kept for future tweaks).
void Spacing;
void Colors;

// ---------------------------------------------------------------------------
// Default export — DesktopShell wrapper + error boundary
// ---------------------------------------------------------------------------

export default function FrontDeskSetupPage() {
  return (
    <PageErrorBoundary pageName="front-desk-setup">
      <DesktopShell fullBleed>
        <FrontDeskSetupContent />
      </DesktopShell>
    </PageErrorBoundary>
  );
}
