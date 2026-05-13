/**
 * FrontDeskHub — main page composition (spec §6 layout map).
 *
 * 2-column grid inside the existing `DesktopShell` (sidebar + header
 * already provided — see spec §7 "Use the existing Aspire desktop
 * header language"):
 *
 *   ┌─ Left/main column ────────────────┐ ┌─ Right column ────┐
 *   │ FrontDeskHeader                   │ │ FrontDeskInbox    │
 *   │ ReceptionistStage                 │ │ (placeholder rail)│
 *   │ Bottom workstrip placeholder      │ │ DialPadCard       │
 *   └───────────────────────────────────┘ └───────────────────┘
 *
 * Pass 1 deliverables:
 *   - Persona hydration via `fetchFrontDeskConfig` + `fetchReceptionistPersonas`
 *     — the resolved persona display name flows down to FrontDeskHeader,
 *     ReceptionistStage, and TiffanySarahOrbVideo with ZERO Sarah hardcoding
 *     when Tiffany is selected.
 *   - Right rail = title "Front Desk Inbox" + 6 filter pills (All default,
 *     pills clickable but content area is empty — Pass 2 wires the rows).
 *   - Bottom workstrip = 5 tabs (Today/Recent Calls/Contacts/Callback Queue/
 *     Voice Messages) + "Cards arriving in Pass 2" empty state.
 *   - DialPadCard sits BELOW the inbox rail in the right column (spec §11
 *     non-negotiable placement).
 *
 * Pitch-black page background. Flat-premium card styling on every panel
 * (`#1C1C1E` bg, `rgba(255,255,255,0.07)` border, 14px radius, 16px padding)
 * matching the Finance Hub `GlowTrendCard` token.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { useIsFinePointer } from '@/lib/useDesktop';
import {
  fetchFrontDeskConfig,
  fetchReceptionistPersonas,
  type ReceptionistPersonaSlug,
  type ReceptionistPersonaWire,
} from '@/lib/api/frontDesk';
import { FrontDeskHeader } from './FrontDeskHeader';
import { ReceptionistStage } from './ReceptionistStage';
import { DialPadCard } from './DialPadCard';

// ---------------------------------------------------------------------------
// Right-rail filter pills (spec §10.1 — All default, 6 filters)
// ---------------------------------------------------------------------------

type InboxFilter = 'all' | 'missed' | 'incoming' | 'outgoing' | 'voicemail' | 'sms';

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missed', label: 'Missed' },
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'sms', label: 'SMS' },
];

// ---------------------------------------------------------------------------
// Bottom workstrip tabs (spec §12)
// ---------------------------------------------------------------------------

type WorkstripTab = 'today' | 'recent' | 'contacts' | 'callbacks' | 'voicemail';

const WORKSTRIP_TABS: { id: WorkstripTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'recent', label: 'Recent Calls' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'callbacks', label: 'Callback Queue' },
  { id: 'voicemail', label: 'Voice Messages' },
];

const RIGHT_COLUMN_BREAKPOINT = 768;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FrontDeskHub() {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const { width } = useWindowDimensions();
  const showRightColumn = width >= RIGHT_COLUMN_BREAKPOINT;
  const isFine = useIsFinePointer();

  // Initial slug is null so we render a neutral loading skeleton instead of
  // flashing a hardcoded "Sarah" label for Tiffany-configured tenants.
  // The slug only resolves AFTER `fetchFrontDeskConfig` returns.
  const [personaSlug, setPersonaSlug] = useState<ReceptionistPersonaSlug | null>(null);
  const [personaRegistry, setPersonaRegistry] = useState<ReceptionistPersonaWire[]>([]);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all');
  const [activeTab, setActiveTab] = useState<WorkstripTab>('today');

  // Persona hydration — single source of truth for "Sarah" vs "Tiffany"
  // labels across the entire hub. ZERO hardcoding downstream — if both the
  // config AND the registry default fail, we render the generic
  // "Receptionist" label (see `personaName` below) rather than guessing.
  useEffect(() => {
    let cancelled = false;
    const officeId = tenant?.officeId;
    if (!officeId) return;

    (async () => {
      try {
        const [cfgRes, personasRes] = await Promise.all([
          fetchFrontDeskConfig({ authenticatedFetch, officeId }),
          fetchReceptionistPersonas({ authenticatedFetch }),
        ]);
        if (cancelled) return;
        const cfg = cfgRes.config as { receptionist_persona?: ReceptionistPersonaSlug | null };
        // Prefer tenant config → registry default. Never hardcode 'sarah'.
        const slug = cfg?.receptionist_persona ?? personasRes.default_persona ?? null;
        setPersonaSlug(slug);
        setPersonaRegistry(personasRes.personas ?? []);
      } catch {
        // Hydration failed — try the registry's default_persona alone.
        // If that also fails, slug stays null and we render the generic
        // "Receptionist" label rather than guessing a name.
        try {
          const personasRes = await fetchReceptionistPersonas({ authenticatedFetch });
          if (cancelled) return;
          setPersonaSlug(personasRes.default_persona ?? null);
          setPersonaRegistry(personasRes.personas ?? []);
        } catch {
          // Leave slug null — the UI renders the generic "Receptionist" label.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, tenant?.officeId]);

  const personaName = useMemo(() => {
    if (!personaSlug) {
      // Generic label until hydration resolves OR after total config failure.
      // Header + stage render a neutral skeleton when slug is null (see below).
      return 'Receptionist';
    }
    const match = personaRegistry.find((p) => p.slug === personaSlug);
    if (match?.display_name) return match.display_name;
    // Title-case fallback so a fresh tenant without registry still sees
    // "Sarah" or "Tiffany" instead of the raw slug.
    return personaSlug.charAt(0).toUpperCase() + personaSlug.slice(1);
  }, [personaRegistry, personaSlug]);

  const personaResolved = personaSlug !== null;

  const inboxRail = (
    <View style={styles.railCard} accessibilityLabel="Front Desk Inbox">
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>Front Desk Inbox</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search inbox"
          style={({ hovered, pressed }: any) => [
            styles.railIconBtn,
            isFine && hovered && styles.railIconBtnHover,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="search" size={15} color={Colors.text.tertiary} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = activeFilter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${f.label}`}
              accessibilityState={{ selected: active }}
              style={({ hovered, pressed }: any) => [
                styles.filterPill,
                active && styles.filterPillActive,
                isFine && hovered && !active && styles.filterPillHover,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.railEmpty}>
        <Ionicons name="mail-open-outline" size={26} color="rgba(255,255,255,0.18)" />
        <Text style={styles.railEmptyTitle}>Inbox rows arrive in Pass 2</Text>
        <Text style={styles.railEmptyHint}>
          Mixed events: missed, voicemail, SMS, callback due, incoming.
        </Text>
      </View>
    </View>
  );

  const workstrip = (
    <View style={styles.workstripCard} accessibilityLabel="Front Desk Workstrip">
      <View style={styles.tabBar}>
        {WORKSTRIP_TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
              style={({ hovered, pressed }: any) => [
                styles.tabBtn,
                active && styles.tabBtnActive,
                isFine && hovered && !active && styles.tabBtnHover,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.workstripBody}>
        <Ionicons name="albums-outline" size={28} color="rgba(255,255,255,0.18)" />
        <Text style={styles.workstripEmptyTitle}>Cards arriving in Pass 2</Text>
        <Text style={styles.workstripEmptyHint}>
          {WORKSTRIP_TABS.find((t) => t.id === activeTab)?.label} cards land here.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      {Platform.OS === 'web' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: '100%',
            paddingBottom: 24,
          }}
        >
          <FrontDeskHeader personaName={personaName} personaResolved={personaResolved} />

          <div
            style={{
              display: 'flex',
              gap: 16,
              flexDirection: showRightColumn ? 'row' : 'column',
              alignItems: 'stretch',
            }}
          >
            {/* Left/main column */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <ReceptionistStage personaName={personaName} personaResolved={personaResolved} />
              {workstrip}
            </div>

            {/* Right column */}
            <div
              style={{
                flex: showRightColumn ? `0 0 360px` : '1 1 auto',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {inboxRail}
              <DialPadCard />
            </div>
          </div>
        </div>
      ) : (
        // Native fallback — single column stack
        <View style={{ gap: 16, paddingBottom: 24 }}>
          <FrontDeskHeader personaName={personaName} personaResolved={personaResolved} />
          <ReceptionistStage personaName={personaName} personaResolved={personaResolved} />
          {inboxRail}
          <DialPadCard />
          {workstrip}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Right rail (Front Desk Inbox placeholder)
  railCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 12,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  railIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  railIconBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any)
      : {}),
  },
  filterPillHover: {
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  filterPillText: {
    color: Colors.text.tertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  filterPillTextActive: {
    color: Colors.accent.cyan,
  },
  railEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  railEmptyTitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  railEmptyHint: {
    color: Colors.text.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Bottom workstrip
  workstripCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 12,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 32,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background 0.15s ease' } as any)
      : {}),
  },
  tabBtnActive: {
    backgroundColor: '#242426',
  },
  tabBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  workstripBody: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  workstripEmptyTitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  workstripEmptyHint: {
    color: Colors.text.muted,
    fontSize: 11,
  },
});
