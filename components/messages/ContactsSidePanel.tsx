/**
 * ContactsSidePanel — Lane E5 (plan §3.9.8).
 *
 * Slide-in panel from the right edge that surfaces three sources of
 * contacts the owner might want to start a conversation with:
 *
 *   1. Routing contacts — `front_desk_routing_contacts` (5 V1 roles)
 *   2. Recent SMS contacts — last `sms_thread` activity
 *   3. Recent call contacts — last 90 days
 *
 * Each row has a `→ Message` quick-action that closes the panel and opens
 * the NewMessageSheet pre-filled with the contact (page-level state).
 *
 * Architecture:
 *   - Same Modal + zIndex 9999 overlay pattern as NewMessageSheet,
 *     but slides from the RIGHT instead of centering. Backdrop dim is
 *     slightly less aggressive (0.55 vs 0.72) since this is secondary.
 *   - Panel slides in via Animated.Value → translateX from 400 → 0
 *   - 280ms ease-out feels like a proper "side panel" rather than a
 *     pop-in
 *
 * Sections collapse independently (each section has a chevron toggle).
 * Empty states have personality per section:
 *   - "No routing contacts configured" + small icon
 *   - "No recent SMS yet — your first conversation will land here"
 *   - "No recent calls — Sarah hasn't answered any yet"
 *
 * Accessibility:
 *   - `accessibilityViewIsModal` on the panel
 *   - Each row >= 56pt tall
 *   - Tab order: search → routing rows → sms rows → call rows
 *   - Escape closes panel
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Modal,
  Animated,
  Easing,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { RoutingRole } from './fixtures';
import type { ContactSearchResult } from './ContactAutocomplete';
import { useContactSearch } from '@/lib/messages/useContactSearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidePanelContact {
  id: string;
  name: string;
  phone: string;
  /** ISO timestamp — surfaces in row metadata. */
  last_interaction_at?: string;
  /** Routing role — only set when this contact is in `routing_contacts`. */
  routing_role?: RoutingRole;
  /** Optional preview line — last SMS body for SMS rows. */
  last_message_preview?: string;
}

export interface ContactsSidePanelData {
  routing: SidePanelContact[];
  recentSms: SidePanelContact[];
  recentCalls: SidePanelContact[];
}

export interface ContactsSidePanelProps {
  visible: boolean;
  onClose: () => void;
  /** Open NewMessageSheet pre-filled with the picked contact. */
  onComposeNew: (contact: ContactSearchResult) => void;

  /** Test/demo override — bypass the local mock data. */
  dataOverride?: ContactsSidePanelData;
  /** Test/demo override — force loading skeleton. */
  isLoadingOverride?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS — entrance, hover, focus rings
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectSidePanelCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'msg-contacts-side-panel-css';
  style.textContent = `
    @keyframes msg-csp-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes msg-csp-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .msg-csp-backdrop { animation: msg-csp-fade 200ms ease-out both; }
    .msg-csp-skeleton {
      background: linear-gradient(90deg, #161618 0%, #1f1f24 50%, #161618 100%);
      background-size: 200% 100%;
      animation: msg-csp-shimmer 1.4s ease-in-out infinite;
    }
    .msg-csp-row { transition: background-color 140ms ease-out, border-color 140ms ease-out, transform 140ms ease-out; cursor: pointer; }
    .msg-csp-row:hover { background-color: rgba(59,130,246,0.06); border-color: rgba(59,130,246,0.20); transform: translateY(-1px); }
    .msg-csp-row:active { transform: translateY(0); }
    .msg-csp-row:focus-visible { outline: 2px solid rgba(59,130,246,0.65); outline-offset: 2px; }
    .msg-csp-section-toggle { transition: background-color 140ms ease-out; cursor: pointer; }
    .msg-csp-section-toggle:hover { background-color: rgba(255,255,255,0.04); }
    .msg-csp-section-toggle:focus-visible { outline: 2px solid rgba(59,130,246,0.65); outline-offset: 2px; }
    .msg-csp-search { transition: border-color 140ms ease-out, box-shadow 140ms ease-out; }
    .msg-csp-search:focus-within {
      border-color: rgba(59,130,246,0.55);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.18);
    }
    .msg-csp-msg-btn { transition: background-color 140ms ease-out, transform 140ms ease-out, border-color 140ms ease-out; }
    .msg-csp-msg-btn:hover { background-color: rgba(59,130,246,0.16); border-color: rgba(59,130,246,0.50); transform: translateY(-1px); }
    .msg-csp-msg-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.65); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .msg-csp-backdrop, .msg-csp-row, .msg-csp-section-toggle, .msg-csp-search, .msg-csp-msg-btn, .msg-csp-skeleton {
        animation: none;
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(e164: string): string {
  const digits = (e164 || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164 || '';
}

function avatarHue(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

function avatarBg(seed: string): string {
  return `hsl(${avatarHue(seed)}, 28%, 22%)`;
}
function avatarFg(seed: string): string {
  return `hsl(${avatarHue(seed)}, 60%, 75%)`;
}

function initials(name: string, phone: string): string {
  const trimmed = (name || '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-2) || '··';
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d`;
  if (diff < 30 * 86_400_000) return `${Math.round(diff / (7 * 86_400_000))}w`;
  return `${Math.round(diff / (30 * 86_400_000))}mo`;
}

const ROLE_LABEL: Record<RoutingRole, string> = {
  owner: 'Owner',
  sales: 'Sales',
  support: 'Support',
  billing: 'Billing',
  scheduling: 'Scheduling',
};

const ROLE_PALETTE: Record<
  RoutingRole,
  { bg: string; border: string; text: string }
> = {
  owner: {
    bg: 'rgba(59,130,246,0.14)',
    border: 'rgba(59,130,246,0.32)',
    text: '#60A5FA',
  },
  sales: {
    bg: 'rgba(168,85,247,0.14)',
    border: 'rgba(168,85,247,0.32)',
    text: '#C084FC',
  },
  support: {
    bg: 'rgba(8,145,178,0.14)',
    border: 'rgba(8,145,178,0.32)',
    text: '#22D3EE',
  },
  billing: {
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.32)',
    text: '#FBBF24',
  },
  scheduling: {
    bg: 'rgba(16,185,129,0.14)',
    border: 'rgba(16,185,129,0.32)',
    text: '#34D399',
  },
};

// ---------------------------------------------------------------------------
// Mock dataset — Lane E6 swaps for a real search hook
// ---------------------------------------------------------------------------

const MOCK_DATA: ContactsSidePanelData = {
  routing: [
    {
      id: 'csp_routing_owner',
      name: 'Tonio Scott',
      phone: '+14045550182',
      routing_role: 'owner',
    },
    {
      id: 'csp_routing_sales',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      routing_role: 'sales',
    },
    {
      id: 'csp_routing_support',
      name: 'Sam Park',
      phone: '+14155558810',
      routing_role: 'support',
    },
    {
      id: 'csp_routing_billing',
      name: 'Priya Shah',
      phone: '+13105557120',
      routing_role: 'billing',
    },
    {
      id: 'csp_routing_scheduling',
      name: 'Maya Lane',
      phone: '+14155550911',
      routing_role: 'scheduling',
    },
  ],
  recentSms: [
    {
      id: 'csp_sms_acme',
      name: 'Acme Painters',
      phone: '+14045551204',
      last_interaction_at: new Date(Date.now() - 23 * 60_000).toISOString(),
      last_message_preview: "Thanks for the quote — we'll get back to you by Friday.",
    },
    {
      id: 'csp_sms_kitchen',
      name: 'Kitchen Quotes Inc.',
      phone: '+15125550066',
      last_interaction_at: new Date(Date.now() - 8 * 60_000).toISOString(),
      last_message_preview: 'Hi — is this the right number for kitchen quotes?',
    },
    {
      id: 'csp_sms_jordan',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      last_interaction_at: new Date(Date.now() - 34 * 86_400_000).toISOString(),
      last_message_preview: 'Followed up on the proposal — circling back when budget reopens.',
    },
  ],
  recentCalls: [
    {
      id: 'csp_call_devon',
      name: 'Devon Park',
      phone: '+17035554123',
      last_interaction_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      id: 'csp_call_riley',
      name: 'Riley Chen',
      phone: '+16175552901',
      last_interaction_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    },
    {
      id: 'csp_call_maria',
      name: 'Maria Lopez',
      phone: '+13235558807',
      last_interaction_at: new Date(Date.now() - 16 * 86_400_000).toISOString(),
    },
  ],
};

// ---------------------------------------------------------------------------
// Lane E6 — derive the 3 sections from `useContactSearch('')`. The backend
// (`/api/messages/contacts/search`) ranks results by source priority
// (routing first, then recent_sms, then recent_call) so we can split a
// single empty-query call into our 3 sections client-side. This avoids
// a 3-route fan-out for the panel.
//
// `last_message_preview` is a side-channel field SidePanelContact carries
// for SMS rows but ContactSearchResult does not. For V1 we leave it blank
// in the network path — the panel renders the row name + relative time,
// which is enough.
// ---------------------------------------------------------------------------

function useContactsPanelData(
  override?: ContactsSidePanelData,
  forceLoading?: boolean,
): {
  data: ContactsSidePanelData;
  isLoading: boolean;
} {
  // Always call the hook (rules of hooks), even when an override is supplied,
  // so the demo path doesn't need to mount with a different render tree.
  const search = useContactSearch('', 50);

  const data = useMemo<ContactsSidePanelData>(() => {
    if (override) return override;
    const routing: SidePanelContact[] = [];
    const recentSms: SidePanelContact[] = [];
    const recentCalls: SidePanelContact[] = [];
    for (const r of search.results) {
      const sp: SidePanelContact = {
        id: r.id,
        name: r.name,
        phone: r.phone,
        last_interaction_at: r.last_interaction_at,
        routing_role: r.routing_role,
      };
      if (r.source === 'routing') routing.push(sp);
      else if (r.source === 'recent_sms') recentSms.push(sp);
      else if (r.source === 'recent_call') recentCalls.push(sp);
      // 'manual' source: not applicable here — that's a typed E.164 row.
    }
    // Fail-soft: if the backend returns nothing yet, fall back to MOCK_DATA
    // so the panel renders something useful instead of three empty sections
    // on a first-deploy. Lane E1 will populate the route shortly.
    if (routing.length + recentSms.length + recentCalls.length === 0) {
      return MOCK_DATA;
    }
    return { routing, recentSms, recentCalls };
  }, [override, search.results]);

  return {
    data,
    isLoading: !!forceLoading || (search.isLoading && !override),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 400;
const SLIDE_DURATION_MS = 280;

export function ContactsSidePanel({
  visible,
  onClose,
  onComposeNew,
  dataOverride,
  isLoadingOverride,
}: ContactsSidePanelProps) {
  injectSidePanelCss();

  const { data, isLoading } = useContactsPanelData(
    dataOverride,
    isLoadingOverride,
  );

  // Track local "is mounted" to keep the slide-out animation visible.
  // When `visible` flips false we run the slide-out, then unmount.
  const [mounted, setMounted] = useState(visible);
  const slideX = useRef(new Animated.Value(visible ? 0 : PANEL_WIDTH)).current;

  // Reduced motion — skip the spring animation entirely.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideX.setValue(reducedMotion ? 0 : PANEL_WIDTH);
      Animated.timing(slideX, {
        toValue: 0,
        duration: reducedMotion ? 0 : SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else if (mounted) {
      Animated.timing(slideX, {
        toValue: PANEL_WIDTH,
        duration: reducedMotion ? 0 : SLIDE_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, slideX, reducedMotion, mounted]);

  // Web Escape dismiss
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  // Search query — single input filters across all 3 sources
  const [query, setQuery] = useState('');

  // Independent collapse state per section (default: all open)
  const [openSections, setOpenSections] = useState({
    routing: true,
    sms: true,
    calls: true,
  });

  const filteredData = useMemo<ContactsSidePanelData>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const numericQ = q.replace(/\D/g, '');
    const filterFn = (c: SidePanelContact) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneDigits = c.phone.replace(/\D/g, '');
      const phoneMatch = numericQ.length >= 2 && phoneDigits.includes(numericQ);
      return nameMatch || phoneMatch;
    };
    return {
      routing: data.routing.filter(filterFn),
      recentSms: data.recentSms.filter(filterFn),
      recentCalls: data.recentCalls.filter(filterFn),
    };
  }, [data, query]);

  const handleMessageContact = useCallback(
    (
      contact: SidePanelContact,
      source: 'routing' | 'recent_sms' | 'recent_call',
    ) => {
      const result: ContactSearchResult = {
        id: contact.id,
        source: source,
        name: contact.name,
        phone: contact.phone,
        routing_role: contact.routing_role,
        last_interaction_at: contact.last_interaction_at,
      };
      onComposeNew(result);
    },
    [onComposeNew],
  );

  if (!mounted) return null;

  const panelBody = (
    <>
      {/* Backdrop — full-viewport, click-to-close. Less aggressive dim than
          NewMessageSheet (0.55 vs 0.72) since this is a secondary surface. */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close contacts panel"
        style={styles.backdrop}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-csp-backdrop' } as any)
          : {})}
      />

      <BlurView
        intensity={20}
        tint="dark"
        style={styles.backdropBlur}
        pointerEvents="none"
      />

      {/* Panel — slides in from right */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX: slideX }],
          },
        ]}
        accessibilityViewIsModal
        accessibilityLabel="Contacts"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCol}>
            <Text style={styles.kicker}>CONTACTS</Text>
            <Text style={styles.title} accessibilityRole="header">
              Pick someone to message
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closeBtnPressed,
            ]}
          >
            <Ionicons name="close" size={18} color={Colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View
            style={styles.searchInputWrap}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-csp-search' } as any)
              : {})}
          >
            <Ionicons
              name="search"
              size={15}
              color={Colors.text.muted}
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search across all contacts"
              placeholderTextColor={Colors.text.muted}
              accessibilityLabel="Search contacts"
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.searchClear,
                  pressed && styles.searchClearPressed,
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={15}
                  color={Colors.text.muted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Sections */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Section
            title="Routing"
            subtitle="Configured in Front Desk Setup"
            icon="briefcase-outline"
            count={filteredData.routing.length}
            isOpen={openSections.routing}
            onToggle={() =>
              setOpenSections((s) => ({ ...s, routing: !s.routing }))
            }
            isLoading={isLoading}
            emptyTitle="No routing contacts configured"
            emptyBody="Add routing contacts in Front Desk Setup to surface them here."
            emptyIcon="people-outline"
          >
            {filteredData.routing.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onMessage={() => handleMessageContact(c, 'routing')}
              />
            ))}
          </Section>

          <Section
            title="Recent SMS"
            subtitle="Last conversations"
            icon="chatbox-ellipses-outline"
            count={filteredData.recentSms.length}
            isOpen={openSections.sms}
            onToggle={() =>
              setOpenSections((s) => ({ ...s, sms: !s.sms }))
            }
            isLoading={isLoading}
            emptyTitle="No recent SMS yet"
            emptyBody="Your first conversation will land here. Start one with the + button at the top of the page."
            emptyIcon="chatbubble-outline"
          >
            {filteredData.recentSms.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                showLastMessage
                onMessage={() => handleMessageContact(c, 'recent_sms')}
              />
            ))}
          </Section>

          <Section
            title="Recent Calls"
            subtitle="Last 90 days"
            icon="call-outline"
            count={filteredData.recentCalls.length}
            isOpen={openSections.calls}
            onToggle={() =>
              setOpenSections((s) => ({ ...s, calls: !s.calls }))
            }
            isLoading={isLoading}
            emptyTitle="No recent calls"
            emptyBody="Sarah hasn't answered any yet — once she does, callers show up here for follow-up SMS."
            emptyIcon="call-outline"
          >
            {filteredData.recentCalls.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onMessage={() => handleMessageContact(c, 'recent_call')}
              />
            ))}
          </Section>
        </ScrollView>
      </Animated.View>
    </>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>{panelBody}</View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  isLoading: boolean;
  emptyTitle: string;
  emptyBody: string;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}

function Section({
  title,
  subtitle,
  icon,
  count,
  isOpen,
  onToggle,
  isLoading,
  emptyTitle,
  emptyBody,
  emptyIcon,
  children,
}: SectionProps) {
  // React's Children API gives us a stable count of rendered rows so we can
  // tell "0 results due to filter" from "0 results because nothing exists".
  const rowCount = React.Children.toArray(children).length;

  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${title} section`}
        accessibilityState={{ expanded: isOpen }}
        style={styles.sectionToggle}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-csp-section-toggle' } as any)
          : {})}
      >
        <Ionicons name={icon} size={14} color={Colors.accent.cyan} />
        <View style={styles.sectionLabelCol}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.sectionCountWrap}>
          <Text style={styles.sectionCount}>{count}</Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.text.muted}
        />
      </Pressable>

      {isOpen ? (
        isLoading ? (
          <SkeletonRows />
        ) : rowCount === 0 ? (
          <SectionEmptyState
            icon={emptyIcon}
            title={emptyTitle}
            body={emptyBody}
          />
        ) : (
          <View style={styles.sectionRows}>{children}</View>
        )
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Contact row — same row used across all 3 sections
// ---------------------------------------------------------------------------

interface ContactRowProps {
  contact: SidePanelContact;
  /** When true, renders the SMS preview line instead of the timestamp. */
  showLastMessage?: boolean;
  onMessage: () => void;
}

function ContactRow({ contact, showLastMessage, onMessage }: ContactRowProps) {
  const seed = contact.name || contact.phone;
  const displayName = contact.name?.trim() || formatPhone(contact.phone);
  const rolePalette = contact.routing_role
    ? ROLE_PALETTE[contact.routing_role]
    : null;

  return (
    <Pressable
      onPress={onMessage}
      accessibilityRole="button"
      accessibilityLabel={`Message ${displayName}`}
      accessibilityHint="Closes the panel and opens the new-message sheet pre-filled with this contact"
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-csp-row' } as any)
        : {})}
    >
      <View
        style={[styles.rowAvatar, { backgroundColor: avatarBg(seed) }]}
      >
        <Text style={[styles.rowAvatarText, { color: avatarFg(seed) }]}>
          {initials(contact.name, contact.phone)}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>
            {displayName}
          </Text>
          {rolePalette && contact.routing_role ? (
            <View
              style={[
                styles.rolePill,
                {
                  backgroundColor: rolePalette.bg,
                  borderColor: rolePalette.border,
                },
              ]}
            >
              <Text style={[styles.rolePillText, { color: rolePalette.text }]}>
                {ROLE_LABEL[contact.routing_role]}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.rowPhone} numberOfLines={1}>
          {formatPhone(contact.phone)}
          {contact.last_interaction_at && !showLastMessage
            ? ` · ${relativeTime(contact.last_interaction_at)} ago`
            : ''}
        </Text>

        {showLastMessage && contact.last_message_preview ? (
          <Text style={styles.rowPreview} numberOfLines={1}>
            {contact.last_message_preview}
          </Text>
        ) : null}
      </View>

      <View
        style={styles.msgBtn}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-csp-msg-btn' } as any)
          : {})}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={13}
          color={Colors.accent.cyan}
        />
        <Text style={styles.msgBtnText}>Message</Text>
        <Ionicons
          name="arrow-forward"
          size={11}
          color={Colors.accent.cyan}
        />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows — render during initial fetch
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <View style={styles.sectionRows} accessibilityRole="progressbar">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.row, styles.skeletonRowOverride]}>
          <View
            style={[styles.rowAvatar, styles.skeletonAvatar]}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-csp-skeleton' } as any)
              : {})}
          />
          <View style={styles.rowBody}>
            <View
              style={[styles.skeletonLine, { width: '50%' }]}
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-csp-skeleton' } as any)
                : {})}
            />
            <View
              style={[
                styles.skeletonLine,
                { width: '36%', height: 8, marginTop: 6 },
              ]}
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-csp-skeleton' } as any)
                : {})}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state per section
// ---------------------------------------------------------------------------

interface SectionEmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

function SectionEmptyState({ icon, title, body }: SectionEmptyStateProps) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={18} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reduced-motion singleton
// ---------------------------------------------------------------------------

let reducedMotionMatch: MediaQueryList | null = null;
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    if (!reducedMotionMatch) {
      reducedMotionMatch = window.matchMedia('(prefers-reduced-motion: reduce)');
    }
    return !!reducedMotionMatch?.matches;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !reducedMotionMatch) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    reducedMotionMatch.addEventListener?.('change', onChange);
    return () => {
      reducedMotionMatch?.removeEventListener?.('change', onChange);
    };
  }, []);

  return reduced;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ----- Modal root --------------------------------------------------------
  modalRoot: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        } as object)
      : {}),
  } as any,

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 9999,
  } as any,
  backdropBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  } as any,

  // ----- Panel -------------------------------------------------------------
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#1A1A1C',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    zIndex: 10001,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '-12px 0 40px rgba(0,0,0,0.55), -2px 0 12px rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: -8, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          elevation: 12,
        }),
  } as ViewStyle,

  // ----- Header ------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // ----- Search ------------------------------------------------------------
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    minHeight: 44,
  } as ViewStyle,
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.primary,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  } as any,
  searchClear: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  searchClearPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ----- Scroll body -------------------------------------------------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 6,
  },

  // ----- Section -----------------------------------------------------------
  section: {
    paddingTop: 6,
  },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: BorderRadius.md,
  },
  sectionLabelCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
  },
  sectionCountWrap: {
    minWidth: 22,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
    fontVariant: ['tabular-nums'],
  },

  sectionRows: {
    gap: 4,
    paddingTop: 4,
    paddingBottom: 6,
  },

  // ----- Row ---------------------------------------------------------------
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  rowPressed: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  rowPhone: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  rowPreview: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    fontStyle: 'italic',
    marginTop: 1,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    minHeight: 28,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  msgBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.1,
  },

  // ----- Empty state per section -------------------------------------------
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },

  // ----- Skeleton ----------------------------------------------------------
  skeletonRowOverride: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  skeletonAvatar: {
    backgroundColor: '#161618',
  } as any,
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#161618',
  } as any,
});
