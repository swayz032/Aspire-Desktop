/**
 * MessagesThreadView — right-pane state (C): a thread is selected
 * (plan §3.9.4 state C, Lane E4).
 *
 * Layout:
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ ThreadHeader: avatar + name + phone + role + ⋮ overflow       │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │                                                                │
 *   │   ─── Today, 2:14 PM ───                                       │
 *   │   ╭─ Hey — saw your update on the Maya project. Q on timing? ─╮│
 *   │                                              ╭─ Heading over now ─╮│
 *   │                                              ✓✓                  │
 *   │                                                                │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │ ⚠ SMS sending requires A2P registration   →  Set up           │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │ [Use template ▾] ┌──────────────────────────┐ {n}/160  [Send] │
 *   │                  │  Type a message…          │                 │
 *   │                  └──────────────────────────┘                  │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Sections:
 *   1. ThreadHeader — contact identity + 3-dot overflow (Pin/Archive/Mark unread)
 *   2. BubbleStream — scrollable, owner-side right (cyan gradient), contact-side
 *      left (dark gray), time separators between 5+ minute clusters, delivery
 *      status icons on outbound bubbles
 *   3. A2P banner — only renders when `tenantA2pStatus !== 'registered'`
 *   4. Composer — textarea + char counter (SMS segment math) + template
 *      dropdown placeholder (V1 stub) + Send button (disabled when empty
 *      or A2P unregistered)
 *
 * Send flow (V1 — mocked, no real API call):
 *   1. User types body → composer enables Send button
 *   2. Click Send → Yellow-tier confirm via Platform-aware dialog
 *   3. Optimistic local append: outbound bubble with status='sending'
 *   4. After 800ms simulated round-trip → status='sent'
 *   5. Composer clears, focus stays for fast follow-ups
 *
 * Lane E5 will swap the template-dropdown stub for `MessageTemplatePicker`.
 * Lane E6 will swap the local mock send for `useSendMessage`.
 *
 * A11y:
 *   - All interactive elements ≥44pt
 *   - Bubble stream: each bubble is `accessibilityRole="text"` with composed label
 *   - Send button: `accessibilityState.disabled` reflects gate state
 *   - Composer: `accessibilityLabel="Message composer"`
 *   - A2P banner: `accessibilityRole="alert"`
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
  Platform,
  ScrollView,
  TextInput,
  Alert,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MessageThreadSummary, RoutingRole } from './fixtures';
import { MessageTemplatePicker } from './MessageTemplatePicker';
import { useMessageThread } from '@/lib/messages/useMessageThread';
import { useSendMessage } from '@/lib/messages/useSendMessage';
import { useMessageThreads } from '@/lib/messages/useMessageThreads';
import { useTenantA2pStatus } from '@/lib/messages/useTenantA2pStatus';

// ---------------------------------------------------------------------------
// Types — Lane E6 will export these from `lib/messages/types.ts`. Until then
// they live here so this component can be shipped + demoed standalone.
// ---------------------------------------------------------------------------

export type MessageDirection = 'inbound' | 'outbound';

export type MessageDeliveryStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed';

export interface ThreadMessage {
  message_id: string;
  thread_id: string;
  direction: MessageDirection;
  /** Author label for outbound messages — owner / sarah / ava. */
  author?: 'owner' | 'sarah' | 'ava';
  body: string;
  /** ISO timestamp. */
  sent_at: string;
  delivery_status: MessageDeliveryStatus;
  /** Number of SMS segments billed (160 chars per segment). */
  num_segments?: number;
}

export type TenantA2pStatus = 'unregistered' | 'pending' | 'registered';

export interface MessagesThreadViewProps {
  selectedThread: MessageThreadSummary;

  /** Test/demo override — A2P state. Defaults to mock 'unregistered'. */
  a2pStatusOverride?: TenantA2pStatus;
  /** Test/demo override — initial messages. Defaults to mock for the thread. */
  messagesOverride?: ThreadMessage[];
  /** Hide the A2P banner entirely (for visual review). */
  hideA2pBanner?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS (web only)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectThreadViewCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-thread-view-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes msg-tv-bubble-in {
      from { opacity: 0; transform: translateY(6px) scale(0.985); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg-tv-bubble {
      animation: msg-tv-bubble-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes msg-tv-status-pulse {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 1; }
    }
    .msg-tv-status-sending { animation: msg-tv-status-pulse 1400ms ease-in-out infinite; }

    .msg-tv-icon-btn {
      transition: background-color 140ms ease-out, transform 140ms ease-out;
    }
    .msg-tv-icon-btn:hover { background-color: rgba(255,255,255,0.06); }
    .msg-tv-icon-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }

    .msg-tv-send {
      transition: transform 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out;
    }
    .msg-tv-send:hover:not(:disabled) {
      box-shadow: 0 0 0 1px rgba(59,130,246,0.55), 0 6px 14px rgba(59,130,246,0.32);
    }
    .msg-tv-send:active:not(:disabled) { transform: scale(0.97); }
    .msg-tv-send:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }
    .msg-tv-send:disabled { cursor: not-allowed; }

    .msg-tv-template {
      transition: background-color 140ms ease-out, border-color 140ms ease-out;
    }
    .msg-tv-template:hover {
      background-color: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.16);
    }
    .msg-tv-template:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; }

    .msg-tv-input:focus { outline: none; border-color: rgba(59,130,246,0.45); }
    .msg-tv-input { transition: border-color 140ms ease-out; }

    .msg-tv-overflow-menu {
      animation: msg-tv-menu-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes msg-tv-menu-in {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg-tv-menu-item { transition: background-color 120ms ease-out; }
    .msg-tv-menu-item:hover { background-color: rgba(255,255,255,0.06); }

    /* Scrollbar — same treatment as thread list. */
    .msg-tv-scroll::-webkit-scrollbar { width: 6px; }
    .msg-tv-scroll::-webkit-scrollbar-track { background: transparent; }
    .msg-tv-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.10);
      border-radius: 3px;
    }
    .msg-tv-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

    @media (prefers-reduced-motion: reduce) {
      .msg-tv-bubble,
      .msg-tv-status-sending,
      .msg-tv-icon-btn,
      .msg-tv-send,
      .msg-tv-template,
      .msg-tv-overflow-menu { animation: none; transition: none; }
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

/**
 * Format a time separator label (e.g. "Today, 2:14 PM" or "Yesterday, 9:30 AM").
 * Used between message clusters with >5 minute gaps.
 */
function formatTimeSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  const weekDay = d.toLocaleDateString(undefined, { weekday: 'long' });
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  if (d >= sevenDaysAgo) return `${weekDay}, ${time}`;
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${date}, ${time}`;
}

/** SMS segment math — 160 ASCII chars per segment, 153 if multi-segment. */
function computeSegments(body: string): { segments: number; max: number } {
  if (body.length === 0) return { segments: 0, max: 160 };
  if (body.length <= 160) return { segments: 1, max: 160 };
  // Multi-segment math — each segment carries 153 chars due to the UDH header.
  const segments = Math.ceil(body.length / 153);
  return { segments, max: segments * 153 };
}

// ---------------------------------------------------------------------------
// Mock messages — kept for `MessagesThreadView.demo.tsx` (visual review).
// Production reads come through `useMessageThread` against
// `/api/messages/threads/{threadId}/messages`.
// ---------------------------------------------------------------------------

export function buildMockMessages(thread: MessageThreadSummary): ThreadMessage[] {
  const baseTime = new Date(thread.last_activity_at).getTime();
  const tid = thread.thread_id;
  return [
    {
      message_id: `${tid}_m1`,
      thread_id: tid,
      direction: 'inbound',
      body:
        thread.contact_name
          ? `Hi! Quick question about your service hours next week.`
          : `Hi — is this the right number for kitchen quotes?`,
      sent_at: new Date(baseTime - 1000 * 60 * 28).toISOString(),
      delivery_status: 'delivered',
    },
    {
      message_id: `${tid}_m2`,
      thread_id: tid,
      direction: 'outbound',
      author: 'sarah',
      body: `Yes — we're open 8am to 6pm Mon-Fri, and Saturdays 9-2. What works for you?`,
      sent_at: new Date(baseTime - 1000 * 60 * 26).toISOString(),
      delivery_status: 'delivered',
      num_segments: 1,
    },
    {
      message_id: `${tid}_m3`,
      thread_id: tid,
      direction: 'inbound',
      body: thread.last_message_preview,
      sent_at: thread.last_activity_at,
      delivery_status: 'delivered',
    },
  ];
}

// ---------------------------------------------------------------------------
// Avatar — shared compact (40px) for header
// ---------------------------------------------------------------------------

function HeaderAvatar({
  name,
  phone,
}: {
  name: string;
  phone: string;
}) {
  const seed = name || phone;
  return (
    <View
      style={[avatarStyles.wrap, { backgroundColor: avatarBg(seed) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[avatarStyles.text, { color: avatarFg(seed) }]}>
        {initials(name, phone)}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

// ---------------------------------------------------------------------------
// Role pill
// ---------------------------------------------------------------------------

function RolePill({ role }: { role: RoutingRole }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.text}>{role.toUpperCase()}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: Colors.accent.cyan,
  },
});

// ---------------------------------------------------------------------------
// Thread header — contact identity + overflow menu
// ---------------------------------------------------------------------------

interface ThreadHeaderProps {
  thread: MessageThreadSummary;
  onPin: () => void;
  onArchive: () => void;
  onMarkUnread: () => void;
}

function ThreadHeader({
  thread,
  onPin,
  onArchive,
  onMarkUnread,
}: ThreadHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const display =
    (thread.contact_name || formatPhone(thread.contact_phone)).trim() ||
    formatPhone(thread.contact_phone);

  // Close on escape (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <View style={headerStyles.wrap}>
      <HeaderAvatar
        name={thread.contact_name}
        phone={thread.contact_phone}
      />

      <View style={headerStyles.identity}>
        <View style={headerStyles.namePlusRole}>
          <Text style={headerStyles.name} numberOfLines={1}>
            {display}
          </Text>
          {thread.routing_role && <RolePill role={thread.routing_role} />}
        </View>
        <Text style={headerStyles.phone} numberOfLines={1}>
          {formatPhone(thread.contact_phone)}
        </Text>
      </View>

      <View style={headerStyles.menuWrap}>
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Thread actions"
          accessibilityHint="Open menu with pin, archive, and mark-unread actions"
          accessibilityState={{ expanded: menuOpen }}
          style={({ pressed }) => [
            headerStyles.iconBtn,
            pressed && headerStyles.iconBtnPressed,
          ]}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-tv-icon-btn' } as any)
            : {})}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={Colors.text.secondary}
          />
        </Pressable>

        {menuOpen && (
          <View
            style={headerStyles.menu}
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-tv-overflow-menu' } as any)
              : {})}
          >
            <MenuItem
              icon={thread.is_pinned ? 'pin' : 'pin-outline'}
              label={thread.is_pinned ? 'Unpin' : 'Pin'}
              onPress={() => {
                setMenuOpen(false);
                onPin();
              }}
            />
            <MenuItem
              icon={thread.is_archived ? 'archive' : 'archive-outline'}
              label={thread.is_archived ? 'Unarchive' : 'Archive'}
              onPress={() => {
                setMenuOpen(false);
                onArchive();
              }}
            />
            <MenuItem
              icon="mail-unread-outline"
              label="Mark unread"
              onPress={() => {
                setMenuOpen(false);
                onMarkUnread();
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, onPress, destructive }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      style={({ pressed }) => [
        headerStyles.menuItem,
        pressed && headerStyles.menuItemPressed,
      ]}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tv-menu-item' } as any)
        : {})}
    >
      <Ionicons
        name={icon}
        size={15}
        color={destructive ? Colors.semantic.error : Colors.text.secondary}
      />
      <Text
        style={[
          headerStyles.menuItemText,
          destructive && { color: Colors.semantic.error },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  namePlusRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  phone: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  menuWrap: {
    position: 'relative',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.85,
  },
  menu: {
    position: 'absolute',
    top: 50,
    right: 0,
    minWidth: 180,
    paddingVertical: 6,
    backgroundColor: '#1A1A1C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: BorderRadius.md,
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.35)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
        }),
  } as any,
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});

// ---------------------------------------------------------------------------
// Bubble + delivery status
// ---------------------------------------------------------------------------

function DeliveryStatusIcon({ status }: { status: MessageDeliveryStatus }) {
  if (status === 'sending') {
    return (
      <View
        style={statusStyles.row}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-tv-status-sending' } as any)
          : {})}
      >
        <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.55)" />
        <Text style={statusStyles.label}>Sending</Text>
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="alert-circle" size={11} color={Colors.semantic.error} />
        <Text style={[statusStyles.label, { color: Colors.semantic.error }]}>
          Failed — tap to retry
        </Text>
      </View>
    );
  }
  if (status === 'delivered') {
    return (
      <View style={statusStyles.row}>
        <Ionicons name="checkmark-done" size={11} color="rgba(255,255,255,0.55)" />
        <Text style={statusStyles.label}>Delivered</Text>
      </View>
    );
  }
  // sent
  return (
    <View style={statusStyles.row}>
      <Ionicons name="checkmark" size={11} color="rgba(255,255,255,0.45)" />
      <Text style={statusStyles.label}>Sent</Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.1,
  },
});

interface BubbleProps {
  message: ThreadMessage;
  isOutbound: boolean;
  showTail: boolean; // last in cluster on that side
}

function Bubble({ message, isOutbound, showTail }: BubbleProps) {
  const a11yLabel = useMemo(() => {
    const who = isOutbound
      ? message.author === 'ava'
        ? 'You (Ava draft)'
        : message.author === 'sarah'
          ? 'You (Sarah)'
          : 'You'
      : 'Contact';
    return `${who}: ${message.body}. ${
      isOutbound ? `Status: ${message.delivery_status}.` : ''
    }`.trim();
  }, [isOutbound, message]);

  return (
    <View
      style={[
        bubbleStyles.outer,
        isOutbound ? bubbleStyles.outerOutbound : bubbleStyles.outerInbound,
      ]}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tv-bubble' } as any)
        : {})}
    >
      <View
        style={[
          bubbleStyles.bubble,
          isOutbound ? bubbleStyles.bubbleOut : bubbleStyles.bubbleIn,
          // Smooth mirrored corner — tail side keeps small radius
          showTail &&
            (isOutbound
              ? { borderBottomRightRadius: 6 }
              : { borderBottomLeftRadius: 6 }),
        ]}
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
      >
        {isOutbound ? (
          <LinearGradient
            colors={[Colors.accent.cyan, Colors.accent.cyanDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill as ViewStyle}
          />
        ) : null}

        {/* Author chip — only for ava-drafted outbound (Sarah is invisible). */}
        {isOutbound && message.author === 'ava' && (
          <View style={bubbleStyles.authorChip}>
            <Ionicons name="sparkles" size={9} color="#ffffff" />
            <Text style={bubbleStyles.authorChipText}>AVA</Text>
          </View>
        )}

        {/* Inline media placeholder (V1.1 will render actual media). */}
        {/* Body */}
        <Text
          style={[
            bubbleStyles.bodyText,
            isOutbound ? bubbleStyles.bodyTextOut : bubbleStyles.bodyTextIn,
          ]}
        >
          {message.body}
        </Text>
      </View>

      {isOutbound && (
        <View style={bubbleStyles.statusRow}>
          <DeliveryStatusIcon status={message.delivery_status} />
        </View>
      )}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  outer: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  outerInbound: {
    alignSelf: 'flex-start',
  },
  outerOutbound: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 36,
  },
  bubbleIn: {
    backgroundColor: '#1E1E20',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bubbleOut: {
    borderColor: 'rgba(59,130,246,0.5)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.25), 0 4px 12px rgba(59,130,246,0.18)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }),
  } as any,
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  authorChipText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: '#ffffff',
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
  },
  bodyTextIn: {
    color: Colors.text.primary,
  },
  bodyTextOut: {
    color: '#ffffff',
  },
  statusRow: {
    paddingRight: 4,
  },
});

// ---------------------------------------------------------------------------
// Time separator chip — shown between message clusters with >5 min gap
// ---------------------------------------------------------------------------

function TimeSeparator({ iso }: { iso: string }) {
  return (
    <View
      style={separatorStyles.wrap}
      accessibilityRole="header"
      accessibilityLabel={formatTimeSeparator(iso)}
    >
      <View style={separatorStyles.line} />
      <Text style={separatorStyles.label}>{formatTimeSeparator(iso)}</Text>
      <View style={separatorStyles.line} />
    </View>
  );
}

const separatorStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 0.6,
  },
});

// ---------------------------------------------------------------------------
// Bubble stream — handles cluster + separator logic
// ---------------------------------------------------------------------------

interface BubbleStreamProps {
  messages: ThreadMessage[];
}

function BubbleStream({ messages }: BubbleStreamProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when message count grows
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(id);
  }, [messages.length]);

  // Render with cluster + separator logic (>5min gap on either side ends cluster)
  const items = useMemo(() => {
    type StreamItem =
      | { kind: 'separator'; iso: string; key: string }
      | {
          kind: 'bubble';
          message: ThreadMessage;
          showTail: boolean;
          isOutbound: boolean;
          key: string;
        };
    const result: StreamItem[] = [];
    const FIVE_MIN_MS = 5 * 60 * 1000;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const isOutbound = m.direction === 'outbound';

      const gapBefore =
        !prev ||
        new Date(m.sent_at).getTime() - new Date(prev.sent_at).getTime() >
          FIVE_MIN_MS;
      if (gapBefore) {
        result.push({
          kind: 'separator',
          iso: m.sent_at,
          key: `sep_${m.message_id}`,
        });
      }

      // showTail: this bubble is the last in its same-direction cluster
      const sameAsNext = next && next.direction === m.direction;
      const gapAfter =
        !next ||
        new Date(next.sent_at).getTime() - new Date(m.sent_at).getTime() >
          FIVE_MIN_MS;
      const showTail = !sameAsNext || gapAfter;

      result.push({
        kind: 'bubble',
        message: m,
        showTail,
        isOutbound,
        key: m.message_id,
      });
    }
    return result;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <View style={streamStyles.empty}>
        <View
          style={streamStyles.emptyHalo}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LinearGradient
            colors={[
              'rgba(59,130,246,0.20)',
              'rgba(59,130,246,0.05)',
              'transparent',
            ]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill as ViewStyle}
          />
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={26}
            color={Colors.accent.cyan}
          />
        </View>
        <Text style={streamStyles.emptyTitle} accessibilityRole="header">
          Fresh thread
        </Text>
        <Text style={streamStyles.emptyBody}>
          No messages yet. Send a note below to start the conversation — it
          will appear right here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={streamStyles.scroll}
      contentContainerStyle={streamStyles.content}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tv-scroll' } as any)
        : {})}
    >
      {items.map((it) => {
        if (it.kind === 'separator') {
          return <TimeSeparator key={it.key} iso={it.iso} />;
        }
        return (
          <Bubble
            key={it.key}
            message={it.message}
            isOutbound={it.isOutbound}
            showTail={it.showTail}
          />
        );
      })}
    </ScrollView>
  );
}

const streamStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
});

// ---------------------------------------------------------------------------
// A2P banner
// ---------------------------------------------------------------------------

function A2pBanner({ status }: { status: TenantA2pStatus }) {
  if (status === 'registered') return null;
  const isPending = status === 'pending';
  return (
    <View
      style={a2pStyles.banner}
      accessibilityRole="alert"
      accessibilityLabel={
        isPending
          ? 'A2P registration is pending verification'
          : 'SMS sending requires A2P registration'
      }
    >
      <View
        style={a2pStyles.iconWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons
          name={isPending ? 'time-outline' : 'warning-outline'}
          size={14}
          color={Colors.semantic.warning}
        />
      </View>
      <View style={a2pStyles.bodyCol}>
        <Text style={a2pStyles.title}>
          {isPending
            ? 'A2P registration in review'
            : 'SMS sending requires A2P registration'}
        </Text>
        <Text style={a2pStyles.body}>
          {isPending
            ? 'Your campaign is being verified — we’ll re-enable sending automatically.'
            : 'Outbound SMS is gated until your business is registered.'}
        </Text>
      </View>
      {!isPending && (
        <Pressable
          onPress={() => {
            // Lane B exposes /settings/sms-registration — page-level routing
            // (Lane E5) wires this. For now the link is informational.
            if (Platform.OS === 'web' && typeof console !== 'undefined') {
              console.info(
                '[messages] A2P set-up link tapped — Lane B wires the route',
              );
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="Set up A2P registration"
          style={({ pressed }) => [
            a2pStyles.cta,
            pressed && a2pStyles.ctaPressed,
          ]}
        >
          <Text style={a2pStyles.ctaText}>Set up</Text>
          <Ionicons
            name="arrow-forward"
            size={12}
            color={Colors.semantic.warning}
          />
        </Pressable>
      )}
    </View>
  );
}

const a2pStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.20)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.20)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
  },
  bodyCol: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.05,
  },
  body: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 15,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
  },
  ctaPressed: {
    backgroundColor: 'rgba(245,158,11,0.20)',
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 0.4,
  },
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  disabled: boolean;
  contactName: string;
  contactPhone: string;
  onSend: (body: string) => void;
}

function Composer({ disabled, contactName, contactPhone, onSend }: ComposerProps) {
  const [body, setBody] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { segments, max } = computeSegments(body);
  const trimmed = body.trim();
  const canSend = !disabled && trimmed.length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const display =
      contactName?.trim() || formatPhone(contactPhone) || contactPhone;

    const proceed = () => {
      onSend(trimmed);
      setBody('');
      // Keep focus for fast follow-ups
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    // Yellow-tier confirm — Platform-aware
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm(
          `Send SMS to ${display} at ${formatPhone(contactPhone)}?`,
        );
        if (ok) proceed();
      } else {
        proceed();
      }
    } else {
      Alert.alert(
        'Send SMS',
        `Send to ${display} at ${formatPhone(contactPhone)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send', style: 'default', onPress: proceed },
        ],
      );
    }
  }, [canSend, contactName, contactPhone, onSend, trimmed]);

  return (
    <View style={composerStyles.wrap}>
      {/* Template dropdown — V1 stub, Lane E5 wires real picker */}
      <View style={composerStyles.templateWrap}>
        <Pressable
          onPress={() => setTemplateOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Use message template"
          accessibilityHint="Opens a list of common reply templates"
          accessibilityState={{ expanded: templateOpen }}
          style={({ pressed }) => [
            composerStyles.templateBtn,
            pressed && composerStyles.templateBtnPressed,
          ]}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-tv-template' } as any)
            : {})}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={Colors.text.tertiary}
          />
          <Text style={composerStyles.templateText}>Use template</Text>
          <Ionicons
            name={templateOpen ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={Colors.text.muted}
          />
        </Pressable>

        {templateOpen && (
          <View style={composerStyles.templateMenu}>
            {/* Lane E5: real picker replaces the V1 stub. The picker fills
                the composer with the template body and substitutes any
                {{tokens}} we can resolve from thread context — anything
                unresolved stays as `{{token}}` for the owner to fill before
                sending. */}
            <MessageTemplatePicker
              open
              onClose={() => setTemplateOpen(false)}
              onSelect={(tplBody) => {
                setBody(tplBody);
                setTemplateOpen(false);
                setTimeout(() => inputRef.current?.focus(), 60);
              }}
              threadContext={{
                contactName: contactName,
              }}
            />
          </View>
        )}
      </View>

      <View style={composerStyles.row}>
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={setBody}
          placeholder={
            disabled
              ? 'SMS disabled until A2P registration is complete'
              : 'Type a message…'
          }
          placeholderTextColor={Colors.text.muted}
          multiline
          editable={!disabled}
          accessibilityLabel="Message composer"
          accessibilityHint="Type your message and press Send"
          style={[
            composerStyles.input,
            disabled && composerStyles.inputDisabled,
          ]}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-tv-input' } as any)
            : {})}
          onKeyPress={(e) => {
            // Web: cmd/ctrl + Enter to send
            const ne: any = e.nativeEvent;
            if (
              Platform.OS === 'web' &&
              ne?.key === 'Enter' &&
              (ne?.metaKey || ne?.ctrlKey)
            ) {
              e.preventDefault?.();
              handleSend();
            }
          }}
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityHint={
            disabled
              ? 'Disabled until A2P registration is complete'
              : 'Sends your message to the contact'
          }
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [
            composerStyles.sendBtn,
            !canSend && composerStyles.sendBtnDisabled,
            canSend && pressed && composerStyles.sendBtnPressed,
          ]}
          {...(Platform.OS === 'web'
            ? ({
                className: 'msg-tv-send',
                disabled: !canSend ? true : undefined,
              } as any)
            : {})}
        >
          <Ionicons
            name="send"
            size={16}
            color={canSend ? '#ffffff' : Colors.text.muted}
          />
        </Pressable>
      </View>

      <View style={composerStyles.metaRow}>
        <Text
          style={[
            composerStyles.charCounter,
            body.length > max - 10 && composerStyles.charCounterWarn,
            body.length > max && composerStyles.charCounterError,
          ]}
        >
          {`${body.length}/${max} (${segments} SMS)`}
        </Text>
        {Platform.OS === 'web' && (
          <Text style={composerStyles.hint}>
            <Text style={composerStyles.hintKey}>⌘</Text>
            <Text>+</Text>
            <Text style={composerStyles.hintKey}>Enter</Text>
            <Text> to send</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const composerStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(10,10,12,0.5)',
    gap: 8,
    position: 'relative',
  },
  templateWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  templateBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.9,
  },
  templateText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  // Lane E5 positioning shell — picks up bottom + left anchor and stacks
  // above the composer; the picker itself owns the card chrome (width,
  // background, border, shadow, radius, etc.) so we keep this wrapper
  // unstyled beyond positioning.
  templateMenu: {
    position: 'absolute',
    bottom: 38,
    left: 0,
    zIndex: 100,
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as object)
      : {}),
  } as any,
  inputDisabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(59,130,246,0.28)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        }),
  } as any,
  sendBtnPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as object) : {}),
  } as any,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  charCounter: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  charCounterWarn: {
    color: Colors.semantic.warning,
  },
  charCounterError: {
    color: Colors.semantic.error,
  },
  hint: {
    fontSize: 10,
    fontWeight: '400',
    color: Colors.text.muted,
  },
  hintKey: {
    fontWeight: '600',
    color: Colors.text.tertiary,
  },
});

// ---------------------------------------------------------------------------
// Inner — orchestrates header + stream + banner + composer
// ---------------------------------------------------------------------------

function MessagesThreadViewInner({
  selectedThread,
  a2pStatusOverride,
  messagesOverride,
  hideA2pBanner,
}: MessagesThreadViewProps) {
  injectThreadViewCss();

  // Lane E6: real A2P status — fail-closed default 'unregistered' if route 404s.
  const a2p = useTenantA2pStatus();
  const a2pStatus: TenantA2pStatus = a2pStatusOverride ?? a2p.status;
  const sendDisabled = a2pStatus !== 'registered';

  // Lane E6: real thread-message fetch via `useMessageThread`. The demo
  // page (`/demo/messages`) supplies `messagesOverride` to render fixture
  // data without a backend.
  const realThread = useMessageThread(
    messagesOverride ? null : selectedThread.thread_id,
  );
  // The component used to manage messages locally (with setMessages) so the
  // optimistic send could append + transition status. With useMessageThread
  // the cache is the source of truth; useSendMessage writes optimistic rows
  // into the same cache via `appendMessageToThread`. We just read.
  const messages: ThreadMessage[] = useMemo(() => {
    if (messagesOverride) return messagesOverride;
    if (realThread.messages.length > 0) return realThread.messages;
    // Empty network response while loading first page — render empty (the
    // BubbleStream renders the "Fresh thread" empty state when length === 0).
    return [];
  }, [messagesOverride, realThread.messages]);

  // Lane E6: real send via `useSendMessage`. The optimistic outbound bubble
  // is appended to the thread cache by the hook; no local state needed.
  const sender = useSendMessage();
  const handleSend = useCallback(
    (body: string) => {
      // The Composer already ran the Yellow-tier confirm. Fire the mutation;
      // errors bubble up via the cache (delivery_status='failed'). For demo
      // override mode we no-op so the static fixture bubbles aren't wiped.
      if (messagesOverride) return;
      void sender
        .mutateAsync({
          phone: selectedThread.contact_phone,
          body,
          threadId: selectedThread.thread_id,
          author: 'owner',
        })
        .catch((err) => {
          if (Platform.OS === 'web' && typeof console !== 'undefined') {
            console.warn('[messages] send failed:', err);
          }
        });
    },
    [messagesOverride, selectedThread.contact_phone, selectedThread.thread_id, sender],
  );

  // Lane E6: pin/archive/markRead via `useMessageThreads('all')`. The hook
  // shares cache across instances, so calling these here is identical to
  // calling them from the page-level threads hook.
  const threadOps = useMessageThreads('all');
  const handlePin = useCallback(() => {
    threadOps.togglePin(selectedThread.thread_id).catch((err) => {
      if (Platform.OS === 'web' && typeof console !== 'undefined') {
        console.warn('[messages] pin failed:', err);
      }
    });
  }, [threadOps, selectedThread.thread_id]);
  const handleArchive = useCallback(() => {
    threadOps.toggleArchive(selectedThread.thread_id).catch((err) => {
      if (Platform.OS === 'web' && typeof console !== 'undefined') {
        console.warn('[messages] archive failed:', err);
      }
    });
  }, [threadOps, selectedThread.thread_id]);
  const handleMarkUnread = useCallback(() => {
    // V1 has no "mark unread" backend route — only mark-read. Treat the
    // overflow item as a no-op for now and surface a console hint so
    // reviewers know it's intentional. V1.1 plan adds the inverse PATCH.
    if (Platform.OS === 'web' && typeof console !== 'undefined') {
      console.info(
        '[messages] mark-unread is V1.1 — no backend route in V1 (markRead is the V1 op)',
      );
    }
  }, []);

  return (
    <View style={styles.wrap}>
      <ThreadHeader
        thread={selectedThread}
        onPin={handlePin}
        onArchive={handleArchive}
        onMarkUnread={handleMarkUnread}
      />

      <View style={styles.streamWrap}>
        <BubbleStream messages={messages} />
      </View>

      {!hideA2pBanner && <A2pBanner status={a2pStatus} />}

      <Composer
        disabled={sendDisabled}
        contactName={selectedThread.contact_name}
        contactPhone={selectedThread.contact_phone}
        onSend={handleSend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
  },
  streamWrap: {
    flex: 1,
    minHeight: 0,
  },
});

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function MessagesThreadView(props: MessagesThreadViewProps) {
  return <MessagesThreadViewInner {...props} />;
}

export default MessagesThreadView;
