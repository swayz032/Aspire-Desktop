/**
 * Front Desk Setup — page shell (Pass 10 Lane B rewrite, plan §10.6)
 *
 * Replaces the previous setup screen wholesale per plan §10.1:
 *   REMOVED — business name field, audio preview, common-reasons matrix,
 *             team seats, inbox-hero photo.
 *   ADDED   — AvaOrbVideo hero, 5 numbered sections, right-rail status stack.
 *
 * Layout:
 *   <DesktopShell fullBleed>
 *     <FrontDeskSetupHero/>                        // full width
 *     <main>
 *       <section row>
 *         <PublicNumberSection/> | <CatchCallsSection/>
 *       </section>
 *       <BusinessHoursSection/>
 *       <RoutingContactsSection/>
 *       <BusyModeSection/>
 *     </main>
 *     <SarahStatusRail/>                           // right rail
 *
 * Data flow: hydrate from `/api/frontdesk/setup`, dirty-track all edits
 * locally, PATCH on Save, trigger overlay on Test.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { triggerTestIncomingCall } from '@/lib/incomingCallOverlayStore';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  fetchFrontDeskConfig,
  patchFrontDeskConfig,
  triggerTestCall as apiTriggerTestCall,
  type FrontDeskConfigPatchPartial,
  type FrontDeskConfigRow,
  type RoutingContactRow,
} from '@/lib/api/frontDesk';

// New section components (Pass 10 Lane B)
import { FrontDeskSetupHero } from '@/components/calls/setup/FrontDeskSetupHero';
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
  RoutingContact,
  BusyMode,
  AfterHoursMode,
  AvailableNumber,
  ForwardingVerification,
  SarahStatus,
  SetupSummaryItem,
} from '@/components/calls/setup/setup-types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: FrontDeskConfig = {
  publicNumber: { mode: 'ASPIRE_NUMBER' },
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
  routingContacts: [
    { id: 'rc-owner', role: 'owner', name: 'Tonio Scott', phone: '(404) 555-0182', initials: 'TS', fallbackMode: 'TRANSFER_ALLOWED', transferAllowed: true, priority: 0 },
    { id: 'rc-sales', role: 'sales', name: 'Maya Reed', phone: '(404) 555-0144', initials: 'MR', fallbackMode: 'TRANSFER_ALLOWED', transferAllowed: true, priority: 1 },
    { id: 'rc-support', role: 'support', name: 'James Cole', phone: '(404) 555-0177', initials: 'JC', fallbackMode: 'MESSAGE_FALLBACK', transferAllowed: true, priority: 2 },
  ],
  busy: { mode: 'TAKE_MESSAGE' },
  forwarding: undefined,
  version: 1,
};

const SARAH_DEFAULT: SarahStatus = {
  active: true,
  displayName: 'Sarah',
  roleLabel: 'AI Front Desk Agent',
};

// ---------------------------------------------------------------------------
// Migrate legacy server payload into the new FrontDeskConfig shape
// ---------------------------------------------------------------------------

type LegacyApiBag = Record<string, any>;

function hydrateFromLegacy(data: LegacyApiBag | null | undefined): FrontDeskConfig {
  if (!data) return DEFAULT_CONFIG;

  // Public number — legacy lineMode → mode
  const legacyLineMode = data.lineMode as string | undefined;
  const publicNumberMode: PublicNumberMode =
    legacyLineMode === 'EXISTING_INBOUND_ONLY' ? 'KEEP_CURRENT_NUMBER' : 'ASPIRE_NUMBER';

  // Business hours — legacy structure used capitalized day names
  const legacyHours = data.businessHours as Record<string, { enabled: boolean; start: string; end: string }> | undefined;
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const legacyDayLookup: Record<typeof dayKeys[number], string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  };

  const days = dayKeys.map((k) => {
    const legacy = legacyHours?.[legacyDayLookup[k]];
    if (!legacy) {
      const isWeekend = k === 'sat' || k === 'sun';
      return { day: k, open: !isWeekend, startTime: '09:00', endTime: '17:00' };
    }
    return {
      day: k,
      open: !!legacy.enabled,
      startTime: legacy.start ?? '09:00',
      endTime: legacy.end ?? '17:00',
    };
  });

  // After-hours mode — legacy has 2 values, new has 3
  const legacyAfterHours = data.afterHoursMode as string | undefined;
  const afterHoursMode: AfterHoursMode =
    legacyAfterHours === 'ASK_CALLBACK_TIME' ? 'ASK_CALLBACK_WINDOW' : 'TAKE_MESSAGE';

  // Busy mode — legacy RETRY_ONCE → TRY_TRANSFER_THEN_MESSAGE
  const legacyBusy = data.busyMode as string | undefined;
  const busyMode: BusyMode =
    legacyBusy === 'RETRY_ONCE'
      ? 'TRY_TRANSFER_THEN_MESSAGE'
      : legacyBusy === 'ASK_CALLBACK_TIME'
        ? 'ASK_CALLBACK_WINDOW'
        : 'TAKE_MESSAGE';

  // Routing contacts (legacy team members)
  const legacyTeam = (data.teamMembers ?? []) as Array<{ id?: string; name: string; phone?: string; role?: string }>;
  const routingContacts: RoutingContact[] =
    legacyTeam.length > 0
      ? legacyTeam.map((m, idx) => ({
          id: m.id ?? `rc-${idx}`,
          role: (m.role?.toLowerCase() as RoutingContact['role']) ?? 'custom',
          customRoleLabel: m.role,
          name: m.name,
          phone: m.phone ?? '',
          initials: deriveInitials(m.name),
          fallbackMode: 'TRANSFER_ALLOWED',
          transferAllowed: true,
          priority: idx,
        }))
      : DEFAULT_CONFIG.routingContacts;

  // Forwarding verification (only relevant in KEEP_CURRENT mode)
  const forwarding: ForwardingVerification | undefined =
    publicNumberMode === 'KEEP_CURRENT_NUMBER'
      ? {
          status: data.forwardingVerified ? 'VERIFIED' : 'NOT_CONFIGURED',
          lastTestAt: data.forwardingLastTestAt,
          lastTestErrorMessage: data.forwardingLastTestError,
        }
      : undefined;

  return {
    publicNumber: {
      mode: publicNumberMode,
      forwardedNumber: data.existingNumber || undefined,
      selectedNumberId: data.businessNumberId,
      areaCode: data.areaCode,
    },
    catch: { mode: 'APP_AND_PHONE_SIMUL_RING' },
    businessHours: {
      days,
      afterHoursMode,
      pronunciationOverride: data.pronunciation ?? '',
    },
    routingContacts,
    busy: { mode: busyMode },
    forwarding,
    version: data.version ?? 1,
  };
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Pass 17: hydrate from real `/v1/front-desk/config` (lowercase enums on wire)
// ---------------------------------------------------------------------------

const AFTER_HOURS_FROM_API: Record<string, AfterHoursMode> = {
  take_message: 'TAKE_MESSAGE',
  ask_callback_window: 'ASK_CALLBACK_WINDOW',
  try_transfer_then_message: 'TRY_TRANSFER_THEN_MESSAGE',
};
const AFTER_HOURS_TO_API: Record<AfterHoursMode, FrontDeskConfigPatchPartial['after_hours_mode']> = {
  TAKE_MESSAGE: 'take_message',
  ASK_CALLBACK_WINDOW: 'ask_callback_window',
  TRY_TRANSFER_THEN_MESSAGE: 'try_transfer_then_message',
};
const BUSY_FROM_API: Record<string, BusyMode> = {
  take_message: 'TAKE_MESSAGE',
  ask_callback_window: 'ASK_CALLBACK_WINDOW',
  try_transfer_then_message: 'TRY_TRANSFER_THEN_MESSAGE',
};
const BUSY_TO_API: Record<BusyMode, FrontDeskConfigPatchPartial['busy_mode']> = {
  TAKE_MESSAGE: 'take_message',
  ASK_CALLBACK_WINDOW: 'ask_callback_window',
  TRY_TRANSFER_THEN_MESSAGE: 'try_transfer_then_message',
};
const PUBLIC_NUMBER_MODES = new Set<PublicNumberMode>(['ASPIRE_NUMBER', 'KEEP_CURRENT_NUMBER']);
const CATCH_MODES = new Set<CatchMode>(['APP_ONLY', 'PHONE_ONLY', 'APP_AND_PHONE_SIMUL_RING']);

function hydrateFromApi(
  configRow: FrontDeskConfigRow | Record<string, never>,
  contacts: RoutingContactRow[],
): FrontDeskConfig {
  const hasConfig = !!(configRow && 'id' in configRow);

  const publicNumberMode: PublicNumberMode = hasConfig && PUBLIC_NUMBER_MODES.has(configRow.public_number_mode as PublicNumberMode)
    ? (configRow.public_number_mode as PublicNumberMode)
    : 'ASPIRE_NUMBER';
  const catchMode: CatchMode = hasConfig && CATCH_MODES.has(configRow.catch_mode as CatchMode)
    ? (configRow.catch_mode as CatchMode)
    : 'APP_AND_PHONE_SIMUL_RING';

  const afterHoursMode: AfterHoursMode = hasConfig
    ? (AFTER_HOURS_FROM_API[configRow.after_hours_mode] ?? 'TAKE_MESSAGE')
    : 'TAKE_MESSAGE';
  const busyMode: BusyMode = hasConfig
    ? (BUSY_FROM_API[configRow.busy_mode] ?? 'TAKE_MESSAGE')
    : 'TAKE_MESSAGE';

  const routingContacts: RoutingContact[] = contacts
    .filter((c) => c.is_active)
    .map((c, idx) => {
      const role = (['owner', 'sales', 'support', 'operations', 'custom'].includes(c.role)
        ? c.role
        : 'custom') as RoutingContact['role'];
      return {
        id: c.id,
        role,
        customRoleLabel: role === 'custom' ? c.label : undefined,
        name: c.label,
        phone: c.phone,
        initials: deriveInitials(c.label),
        fallbackMode: 'TRANSFER_ALLOWED',
        transferAllowed: true,
        priority: idx,
      } as RoutingContact;
    });

  // Default Mon–Fri 9-5; backend stores hours separately (out of scope for §17)
  // — preserve current default until Pass 18 wires hours into the schema.
  const days = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((k) => {
    const isWeekend = k === 'sat' || k === 'sun';
    return { day: k, open: !isWeekend, startTime: '09:00', endTime: '17:00' };
  });

  const forwarding: ForwardingVerification | undefined =
    publicNumberMode === 'KEEP_CURRENT_NUMBER' && hasConfig
      ? {
          status: (configRow.forwarding_status ?? 'NOT_CONFIGURED') as ForwardingVerification['status'],
          lastTestAt: configRow.last_forwarding_test_at ?? undefined,
          lastTestErrorMessage: configRow.last_forwarding_test_result ?? undefined,
        }
      : undefined;

  return {
    publicNumber: { mode: publicNumberMode },
    catch: { mode: catchMode },
    businessHours: {
      days,
      afterHoursMode,
      pronunciationOverride: hasConfig ? configRow.pronunciation_override ?? '' : '',
    },
    routingContacts: routingContacts.length > 0 ? routingContacts : DEFAULT_CONFIG.routingContacts,
    busy: { mode: busyMode },
    forwarding,
    version: hasConfig ? configRow.version_no : 1,
  };
}

/**
 * Compute the dirty diff between the saved snapshot and the current config.
 * Only fields the API actually persists are emitted (hours/routing contacts
 * have separate routes — out of scope for §17).
 */
function computePatchDiff(
  current: FrontDeskConfig,
  baseline: FrontDeskConfig,
): FrontDeskConfigPatchPartial {
  const partial: FrontDeskConfigPatchPartial = {};
  if (current.publicNumber.mode !== baseline.publicNumber.mode) {
    partial.public_number_mode = current.publicNumber.mode;
  }
  if (current.catch.mode !== baseline.catch.mode) {
    partial.catch_mode = current.catch.mode;
  }
  if (current.businessHours.afterHoursMode !== baseline.businessHours.afterHoursMode) {
    partial.after_hours_mode = AFTER_HOURS_TO_API[current.businessHours.afterHoursMode];
  }
  if (current.busy.mode !== baseline.busy.mode) {
    partial.busy_mode = BUSY_TO_API[current.busy.mode];
  }
  if ((current.businessHours.pronunciationOverride ?? '') !== (baseline.businessHours.pronunciationOverride ?? '')) {
    partial.pronunciation_override = current.businessHours.pronunciationOverride ?? '';
  }
  return partial;
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

  return [
    { iconName: 'call-outline', label: 'Public number', value: config.publicNumber.mode === 'ASPIRE_NUMBER' ? 'Aspire number' : 'Forwarded' },
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
// Component
// ---------------------------------------------------------------------------

function FrontDeskSetupContent() {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId;

  const [config, setConfig] = useState<FrontDeskConfig>(DEFAULT_CONFIG);
  const [originalSnapshot, setOriginalSnapshot] = useState<string>(JSON.stringify(DEFAULT_CONFIG));
  const [availableNumbers] = useState<AvailableNumber[]>([
    { id: 'demo-1', number: '(212) 555-0198', inboundReady: true, outboundAvailable: true },
    { id: 'demo-2', number: '(212) 555-7204', inboundReady: true, outboundAvailable: true },
    { id: 'demo-3', number: '(212) 555-3148', inboundReady: true, outboundAvailable: true },
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  // Hydrate error is captured for Pass 18 inline toast wiring; reference via
  // `void` until the toast component lands so strict-mode lint stays clean.
  const [hydrateError, setHydrateError] = useState<Error | null>(null);
  void hydrateError;

  // Pass 17 (§17.B): hydrate from real `GET /api/v1/front-desk/config`. The
  // legacy `/api/frontdesk/setup` shape is preserved as a parse-time fallback
  // for tenants whose backend rows haven't been migrated yet — the hydrate
  // function picks whichever shape returns 200.
  useEffect(() => {
    if (!officeId) return;
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const data = await fetchFrontDeskConfig({
          authenticatedFetch,
          officeId,
          signal: ctrl.signal,
        });
        if (cancelled) return;
        const hydrated = hydrateFromApi(data.config, data.routing_contacts ?? []);
        setConfig(hydrated);
        setOriginalSnapshot(JSON.stringify(hydrated));
        setHydrateError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Legacy fallback: try the older /api/frontdesk/setup shape so tenants
        // pre-migration still see their config. Surfacing the error to the UI
        // is safe; the page keeps the defaults until Save is clicked.
        try {
          const legacyRes = await fetch('/api/frontdesk/setup', { signal: ctrl.signal });
          if (legacyRes.ok && !cancelled) {
            const legacyData = await legacyRes.json();
            const hydrated = hydrateFromLegacy(legacyData);
            setConfig(hydrated);
            setOriginalSnapshot(JSON.stringify(hydrated));
            setHydrateError(null);
            return;
          }
        } catch {
          // ignore legacy fallback errors
        }
        setHydrateError(err instanceof Error ? err : new Error('Failed to load Front Desk config'));
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [authenticatedFetch, officeId]);

  // ----- Dirty tracking ------------------------------------------------
  const isDirty = useMemo(
    () => JSON.stringify(config) !== originalSnapshot,
    [config, originalSnapshot],
  );

  // ----- Patchers ------------------------------------------------------
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

  // ----- Save (Pass 17 §17.B — Yellow tier, server proxy mints cap token) -----
  const onSave = useCallback(async () => {
    if (!isDirty || isSaving || !officeId) return;
    setIsSaving(true);
    try {
      const baseline = JSON.parse(originalSnapshot) as FrontDeskConfig;
      const partial = computePatchDiff(config, baseline);
      // No-op patch (only contacts/hours changed) — bail out silently. The
      // routing-contacts CRUD has its own dedicated routes (Pass 18 wiring).
      if (Object.keys(partial).length === 0) {
        setOriginalSnapshot(JSON.stringify(config));
        return;
      }
      const result = await patchFrontDeskConfig(
        { authenticatedFetch, officeId },
        partial,
      );
      // Server bumps version_no — adopt it locally so the next read sees the
      // same baseline and isDirty resets.
      const next: FrontDeskConfig = { ...config, version: result.config.version_no };
      setConfig(next);
      setOriginalSnapshot(JSON.stringify(next));
    } catch {
      // UI returns to dirty state — caller can retry. Error surfaces via
      // hydrate path on next reload; inline toast wired in Pass 18.
    } finally {
      setIsSaving(false);
    }
  }, [config, isDirty, isSaving, officeId, originalSnapshot, authenticatedFetch]);

  // ----- Test incoming call (Pass 17 §17.B — calls real Twilio test) -----
  const onTest = useCallback(async () => {
    setIsTesting(true);
    // Always trigger the local overlay so the user sees activity immediately.
    triggerTestIncomingCall();
    // Fire the real backend test-call route in parallel; failures are silent
    // for now (the overlay still plays). When `officeId` is missing (auth
    // not yet hydrated) we skip the API call.
    if (officeId) {
      try {
        await apiTriggerTestCall({ authenticatedFetch, officeId });
      } catch {
        // ignore — the overlay still gives user feedback
      }
    }
    setTimeout(() => setIsTesting(false), 1200);
  }, [officeId, authenticatedFetch]);

  // ----- Right rail data ----------------------------------------------
  const summary = useMemo(() => buildSummary(config), [config]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero header (full width inside the page padding) */}
      <FrontDeskSetupHero
        onSave={onSave}
        onTest={onTest}
        isSaving={isSaving}
        isTesting={isTesting}
        isDirty={isDirty}
        sarahActive={SARAH_DEFAULT.active}
      />

      {/* 2-column body */}
      <View style={styles.bodyGrid}>
        {/* Main column (~70%) */}
        <View style={styles.mainCol}>
          {/* Sections 1 & 2 in a 2-col row — staggered entrance per §12.1 */}
          <View style={styles.topRow}>
            <View style={styles.topCol}>
              <PublicNumberSection
                config={config.publicNumber}
                onChange={updatePublicNumber}
                availableNumbers={availableNumbers}
                enterIndex={0}
              />
            </View>
            <View style={styles.topCol}>
              <CatchCallsSection
                mode={config.catch.mode}
                onChange={updateCatch}
                enterIndex={1}
              />
            </View>
          </View>

          <BusinessHoursSection
            config={config.businessHours}
            onChange={updateBusinessHours}
            enterIndex={2}
          />

          <RoutingContactsSection
            contacts={config.routingContacts}
            onChange={updateContacts}
            enterIndex={3}
          />

          <BusyModeSection
            mode={config.busy.mode}
            onChange={updateBusy}
            enterIndex={4}
          />
        </View>

        {/* Right rail (~30%) */}
        <View style={styles.railCol}>
          <SarahStatusRail
            sarah={SARAH_DEFAULT}
            summary={summary}
            forwarding={config.forwarding}
            publicNumberMode={config.publicNumber.mode}
          />
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
    gap: 24,
    ...(Platform.OS === 'web'
      ? ({ maxWidth: 1480, marginHorizontal: 'auto' as const, width: '100%' } as object)
      : {}),
  } as any,

  bodyGrid: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  mainCol: {
    flex: 7,
    minWidth: 600,
    gap: 18,
  },
  railCol: {
    flex: 3,
    minWidth: 320,
  },

  topRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  topCol: {
    flex: 1,
    minWidth: 320,
  },
});

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

// Avoid unused-warning for the Colors import while still keeping it available
// for future tweaks.
void Colors;
