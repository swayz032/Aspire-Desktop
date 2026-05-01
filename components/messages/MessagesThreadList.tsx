/**
 * MessagesThreadList — left-column thread list (plan §3.9.3, Lane E3).
 *
 * Each row is a small editorial card:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  ╭───╮  Tonio Scott · OWNER         2m   📌  ✨        │
 *   │  │TS │  Hey — saw your update on… [2]                  │
 *   │  ╰───╯                                                  │
 *   └─────────────────────────────────────────────────────┘
 *
 * Layered visual elements:
 *   - 44px circular avatar with deterministic color hash from name/phone
 *   - Green "online" dot if last_activity_at < 60s ago
 *   - Bold contact name + (when available) routing role pill
 *   - Single-line preview, ellipsis
 *   - Top-right relative timestamp (12/500, secondary)
 *   - Bottom-right unread badge (Aspire-blue pill, 0 hidden)
 *   - Pin icon (top-right) when pinned
 *   - Faint Ava-glow (right-edge cyan accent) when last_drafter='ava'
 *
 * Interaction:
 *   - Hover (web) / press (native): card lifts -2px, faint blue halo
 *   - Selected: 3px blue left-edge bar + tinted bg rgba(59,130,246,0.08)
 *   - Right-click (web) / long-press (native): context menu
 *     (Pin/Archive/Mark unread/Delete) — Delete is stub for V1
 *
 * Empty state varies per filter — never a generic "no items":
 *   - all       → "No conversations yet" + 1 illustration
 *   - unread    → "You're caught up" + checkmark
 *   - pinned    → "Nothing pinned yet"
 *   - archived  → "No archived threads"
 *
 * Performance: FlatList virtualized. Row height varies slightly (single-line
 * preview), but FlatList handles non-fixed heights fine for ≤500 rows; a
 * `getItemLayout` optimization can be added later if profiling demands it.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type {
  MessageThreadSummary,
  RoutingRole,
} from './fixtures';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MessagesFilterTabId = 'all' | 'unread' | 'pinned' | 'archived';

/** Context-menu actions surfaced on right-click / long-press. */
export type ThreadContextAction =
  | 'pin'
  | 'unpin'
  | 'archive'
  | 'unarchive'
  | 'mark-unread'
  | 'delete';

export interface MessagesThreadListProps {
  threads: MessageThreadSummary[];
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  /** Fired with a context action — page owns persistence. */
  onContextMenu: (threadId: string, action: ThreadContextAction) => void;
  isLoading?: boolean;
  /** Filter affects the empty-state copy ONLY; threads are pre-filtered by parent. */
  filter: MessagesFilterTabId;
}

// ---------------------------------------------------------------------------
// One-time CSS injection (web only)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectThreadListCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-thread-list-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .msg-thread-row {
      transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                  background-color 180ms ease-out,
                  box-shadow 180ms ease-out,
                  border-color 180ms ease-out;
    }
    .msg-thread-row:hover {
      transform: translateY(-2px);
      background-color: rgba(28,28,30,0.85);
      box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 6px 16px rgba(0,0,0,0.32), 0 0 24px rgba(59,130,246,0.06);
    }
    .msg-thread-row:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: 2px;
    }
    .msg-thread-row-selected {
      background-color: rgba(59,130,246,0.08) !important;
      box-shadow: 0 0 0 1px rgba(59,130,246,0.22), 0 6px 16px rgba(0,0,0,0.28) !important;
    }
    .msg-context-menu {
      animation: msg-context-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes msg-context-in {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg-context-item { transition: background-color 120ms ease-out; }
    .msg-context-item:hover { background-color: rgba(255,255,255,0.06); }
    .msg-context-item-destructive:hover { background-color: rgba(239,68,68,0.10); }
    @media (prefers-reduced-motion: reduce) {
      .msg-thread-row, .msg-context-menu, .msg-context-item { animation: none; transition: none; }
    }
    /* Scrollbar — same treatment as Office Memory result list. */
    .msg-thread-scroll::-webkit-scrollbar { width: 6px; }
    .msg-thread-scroll::-webkit-scrollbar-track { background: transparent; }
    .msg-thread-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.10);
      border-radius: 3px;
    }
    .msg-thread-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format E.164 number for human display: +14045550182 → (404) 555-0182. */
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

/** Compact relative-time label for the row's right-side timestamp. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Display name preferred over phone — falls back when name is empty. */
function displayName(thread: MessageThreadSummary): string {
  return (thread.contact_name || formatPhone(thread.contact_phone)).trim() ||
    formatPhone(thread.contact_phone);
}

/** Initials for avatar — 2 chars max, contact name preferred over phone. */
function initials(thread: MessageThreadSummary): string {
  const name = (thread.contact_name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // No name — use last 2 digits of the phone for visual variety.
  const digits = thread.contact_phone.replace(/\D/g, '');
  return digits.slice(-2) || '··';
}

/**
 * Deterministic hue from a string — used to give each contact a stable
 * avatar color. Two contacts with the same name/phone always render the
 * same color, but no two adjacent contacts collide visually because the
 * djb2 hash spreads inputs well across the hue circle.
 */
function avatarHue(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

/** Avatar background — desaturated, tonal so initials stay readable. */
function avatarBg(seed: string): string {
  const h = avatarHue(seed);
  // 28% saturation, 22% lightness — tonal, never neon. Same brightness for
  // every contact so the row reads consistently.
  return `hsl(${h}, 28%, 22%)`;
}

/** Avatar text color — slightly lighter version of the bg hue. */
function avatarFg(seed: string): string {
  const h = avatarHue(seed);
  return `hsl(${h}, 60%, 75%)`;
}

/** Routing role → display label + pill background. */
function roleLabel(role: RoutingRole | undefined): string | null {
  if (!role) return null;
  return role.toUpperCase();
}

// ---------------------------------------------------------------------------
// Avatar component
// ---------------------------------------------------------------------------

interface AvatarProps {
  thread: MessageThreadSummary;
  size?: number;
}

function Avatar({ thread, size = 44 }: AvatarProps) {
  const seed = thread.contact_name || thread.contact_phone || thread.thread_id;
  const bg = avatarBg(seed);
  const fg = avatarFg(seed);

  const lastActivityMs = Date.now() - new Date(thread.last_activity_at).getTime();
  const isOnline = lastActivityMs < 60_000;

  return (
    <View
      style={[
        avatarStyles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text
        style={[avatarStyles.text, { color: fg, fontSize: size * 0.36 }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {initials(thread)}
      </Text>
      {isOnline && (
        <View
          style={[
            avatarStyles.onlineDot,
            { right: 0, bottom: 0 },
          ]}
          accessibilityLabel="Active recently"
          accessibilityRole="image"
        />
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  onlineDot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#34c759',
    borderWidth: 2,
    borderColor: '#0d0d0d',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 6px rgba(52,199,89,0.65)' } as object)
      : {
          shadowColor: '#34c759',
          shadowOpacity: 0.7,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
});

// ---------------------------------------------------------------------------
// Routing role pill
// ---------------------------------------------------------------------------

function RolePill({ role }: { role: RoutingRole }) {
  const label = roleLabel(role);
  if (!label) return null;
  return (
    <View style={rolePillStyles.pill}>
      <Text style={rolePillStyles.text}>{label}</Text>
    </View>
  );
}

const rolePillStyles = StyleSheet.create({
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
// Thread row
// ---------------------------------------------------------------------------

interface ThreadRowProps {
  thread: MessageThreadSummary;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: (anchorX: number, anchorY: number) => void;
  onContextMenuWeb: (clientX: number, clientY: number) => void;
}

function ThreadRow({
  thread,
  isSelected,
  onPress,
  onLongPress,
  onContextMenuWeb,
}: ThreadRowProps) {
  const liftAnim = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(liftAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [liftAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(liftAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [liftAnim]);

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  // Web onContextMenu — preventDefault + bubble up coords so the parent can
  // anchor the menu. Native uses long-press; we approximate the anchor via
  // the row layout (passed in via callback).
  const webContextProps =
    Platform.OS === 'web'
      ? ({
          onContextMenu: (e: any) => {
            e.preventDefault?.();
            onContextMenuWeb(e.clientX ?? 0, e.clientY ?? 0);
          },
          className: `msg-thread-row${isSelected ? ' msg-thread-row-selected' : ''}`,
        } as any)
      : {};

  const isAvaDraft = thread.last_drafter === 'ava';

  return (
    <Animated.View
      style={{
        transform: [{ translateY: Platform.OS === 'web' ? 0 : translateY }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={(e) => {
          // RN long-press doesn't surface absolute coords reliably across
          // platforms — we use locationX/Y from the event as a best-effort.
          const lx = (e?.nativeEvent as any)?.pageX ?? 0;
          const ly = (e?.nativeEvent as any)?.pageY ?? 0;
          onLongPress(lx, ly);
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={buildA11yLabel(thread)}
        accessibilityState={{ selected: isSelected }}
        accessibilityHint="Tap to open conversation. Long-press for actions."
        style={[
          rowStyles.row,
          isSelected && rowStyles.rowSelected,
        ]}
        {...webContextProps}
      >
        {/* 3px Aspire-blue left-edge bar — only visible when selected */}
        {isSelected && <View style={rowStyles.selectedBar} />}

        {/* Faint Ava-glow accent on right edge — only when last_drafter='ava' */}
        {isAvaDraft && <View style={rowStyles.avaGlow} pointerEvents="none" />}

        <Avatar thread={thread} />

        <View style={rowStyles.body}>
          <View style={rowStyles.topRow}>
            <View style={rowStyles.namePlusRole}>
              <Text style={rowStyles.name} numberOfLines={1}>
                {displayName(thread)}
              </Text>
              {thread.routing_role && <RolePill role={thread.routing_role} />}
            </View>
            <View style={rowStyles.metaRight}>
              {thread.is_pinned && (
                <Ionicons
                  name="pin"
                  size={12}
                  color={Colors.accent.cyan}
                  style={rowStyles.pinIcon}
                  accessibilityLabel="Pinned"
                />
              )}
              <Text style={rowStyles.time} numberOfLines={1}>
                {relativeTime(thread.last_activity_at)}
              </Text>
            </View>
          </View>

          <View style={rowStyles.bottomRow}>
            <Text
              style={[
                rowStyles.preview,
                thread.unread_count > 0 && rowStyles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {thread.last_drafter === 'owner' || thread.last_drafter === 'sarah' || thread.last_drafter === 'ava' ? (
                <Text style={rowStyles.previewSelf}>You: </Text>
              ) : null}
              {thread.last_message_preview}
            </Text>
            {thread.unread_count > 0 && (
              <View
                style={rowStyles.unreadBadge}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={rowStyles.unreadText}>
                  {thread.unread_count > 99 ? '99+' : thread.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function buildA11yLabel(thread: MessageThreadSummary): string {
  const parts: string[] = [];
  parts.push(displayName(thread));
  if (thread.routing_role) parts.push(`role ${thread.routing_role}`);
  if (thread.unread_count > 0) {
    parts.push(`${thread.unread_count} unread message${thread.unread_count === 1 ? '' : 's'}`);
  }
  if (thread.is_pinned) parts.push('pinned');
  if (thread.is_archived) parts.push('archived');
  parts.push(`last activity ${relativeTime(thread.last_activity_at)}`);
  return parts.join(', ');
}

const rowStyles = StyleSheet.create({
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
    minHeight: 68,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  rowSelected: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.22)',
  },
  selectedBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(59,130,246,0.65)' } as object)
      : {}),
  } as any,
  avaGlow: {
    position: 'absolute',
    right: -1,
    top: 12,
    bottom: 12,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(59,130,246,0.30)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 12px rgba(59,130,246,0.30)' } as object)
      : {}),
  } as any,

  body: {
    flex: 1,
    minWidth: 0, // critical for ellipsis on web flexbox
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  namePlusRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pinIcon: {
    marginRight: 2,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    fontVariant: ['tabular-nums'],
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 18,
    minWidth: 0,
  },
  previewUnread: {
    color: Colors.text.bright,
    fontWeight: '500',
  },
  previewSelf: {
    color: Colors.text.muted,
    fontWeight: '400',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(59,130,246,0.40)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOpacity: 0.5,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        }),
  } as any,
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
});

// ---------------------------------------------------------------------------
// Empty state — varies by filter so the page never reads as a generic
// "nothing to see here". Per §12.1 Framer-style: empty states have personality.
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  filter: MessagesFilterTabId;
}

function EmptyState({ filter }: EmptyStateProps) {
  const copy = useMemo(() => emptyCopyFor(filter), [filter]);
  return (
    <View style={emptyStyles.wrap} accessibilityLabel={`${copy.title}. ${copy.subtitle}`}>
      {/* Iconographic illustration — single Ionicon at scale + soft halo.
          Consistent with the Office Memory empty-state pattern (one big icon,
          not a stock illustration drop-in). */}
      <View style={emptyStyles.iconHalo}>
        <Ionicons
          name={copy.icon}
          size={36}
          color={copy.tint}
        />
      </View>
      <Text style={emptyStyles.title} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={emptyStyles.subtitle}>{copy.subtitle}</Text>
    </View>
  );
}

interface EmptyCopy {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tint: string;
}

function emptyCopyFor(filter: MessagesFilterTabId): EmptyCopy {
  switch (filter) {
    case 'unread':
      return {
        icon: 'checkmark-done',
        title: "You're caught up",
        subtitle: "Nothing unread on your business line. Nice work.",
        tint: '#34c759',
      };
    case 'pinned':
      return {
        icon: 'pin-outline',
        title: 'Nothing pinned yet',
        subtitle: "Pin a thread to keep it at the top of the list.",
        tint: Colors.accent.cyan,
      };
    case 'archived':
      return {
        icon: 'archive-outline',
        title: 'No archived threads',
        subtitle: 'Threads you archive show up here. They never auto-delete.',
        tint: Colors.text.muted,
      };
    case 'all':
    default:
      return {
        icon: 'chatbubbles-outline',
        title: 'No conversations yet',
        subtitle: 'Messages with your business line appear here.',
        tint: Colors.accent.cyan,
      };
  }
}

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  iconHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.14)',
    marginBottom: 4,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 24px rgba(59,130,246,0.12)' } as object)
      : {}),
  } as any,
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.bright,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
});

// ---------------------------------------------------------------------------
// Context menu — opens at click/long-press anchor. Floats absolute on web,
// renders at fixed position on native (best-effort given RN's lack of
// portal-style overlay primitive at this layer).
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  thread: MessageThreadSummary;
  anchorX: number;
  anchorY: number;
  onAction: (action: ThreadContextAction) => void;
  onDismiss: () => void;
}

function ContextMenu({
  thread,
  anchorX,
  anchorY,
  onAction,
  onDismiss,
}: ContextMenuProps) {
  // Click-outside to close on web — listen on document for any mousedown that
  // isn't inside the menu node.
  const menuRef = useRef<View | null>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MouseEvent) => {
      const node = menuRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) onDismiss();
    };
    // Use setTimeout to avoid catching the same click that opened the menu.
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onDismiss]);

  // Compute position — clamp to viewport so the menu never overflows. We use
  // a 220x200 menu footprint as the worst-case for clamping math.
  const MENU_W = 220;
  const MENU_H = 200;
  const vw = Platform.OS === 'web' ? window.innerWidth : 0;
  const vh = Platform.OS === 'web' ? window.innerHeight : 0;
  const left =
    Platform.OS === 'web'
      ? Math.max(8, Math.min(anchorX, vw - MENU_W - 8))
      : Math.max(8, anchorX - 16);
  const top =
    Platform.OS === 'web'
      ? Math.max(8, Math.min(anchorY, vh - MENU_H - 8))
      : Math.max(8, anchorY + 8);

  return (
    <View
      ref={menuRef as any}
      style={[ctxStyles.menu, { left, top }]}
      accessibilityRole="menu"
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-context-menu' } as any)
        : {})}
    >
      <CtxItem
        icon={thread.is_pinned ? 'pin' : 'pin-outline'}
        label={thread.is_pinned ? 'Unpin thread' : 'Pin thread'}
        onPress={() => onAction(thread.is_pinned ? 'unpin' : 'pin')}
      />
      <CtxItem
        icon={thread.is_archived ? 'arrow-undo-outline' : 'archive-outline'}
        label={thread.is_archived ? 'Unarchive' : 'Archive'}
        onPress={() => onAction(thread.is_archived ? 'unarchive' : 'archive')}
      />
      <CtxItem
        icon="mail-unread-outline"
        label="Mark as unread"
        onPress={() => onAction('mark-unread')}
        disabled={thread.unread_count > 0}
      />
      <View style={ctxStyles.divider} />
      <CtxItem
        icon="trash-outline"
        label="Delete thread"
        onPress={() => onAction('delete')}
        destructive
      />
    </View>
  );
}

function CtxItem({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[ctxStyles.item, disabled && ctxStyles.itemDisabled]}
      {...(Platform.OS === 'web'
        ? ({
            className: `msg-context-item${
              destructive ? ' msg-context-item-destructive' : ''
            }`,
          } as any)
        : {})}
    >
      <Ionicons
        name={icon}
        size={15}
        color={
          disabled
            ? Colors.text.disabled
            : destructive
              ? Colors.semantic.error
              : Colors.text.secondary
        }
      />
      <Text
        style={[
          ctxStyles.itemLabel,
          destructive && !disabled && ctxStyles.itemLabelDestructive,
          disabled && ctxStyles.itemLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const ctxStyles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 200,
    maxWidth: 240,
    backgroundColor: '#161618',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    zIndex: 99999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.5), 0 12px 36px rgba(0,0,0,0.4)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          elevation: 12,
        }),
  } as any,
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.bright,
  },
  itemLabelDestructive: {
    color: Colors.semantic.error,
  },
  itemLabelDisabled: {
    color: Colors.text.disabled,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
    marginHorizontal: 6,
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessagesThreadList({
  threads,
  selectedThreadId,
  onThreadSelect,
  onContextMenu,
  isLoading = false,
  filter,
}: MessagesThreadListProps) {
  injectThreadListCss();

  // Context menu state — anchored at click/long-press coords.
  const [ctxState, setCtxState] = useState<{
    threadId: string;
    x: number;
    y: number;
  } | null>(null);

  const ctxThread = ctxState
    ? threads.find((t) => t.thread_id === ctxState.threadId)
    : null;

  const renderRow = useCallback(
    ({ item }: { item: MessageThreadSummary }) => (
      <ThreadRow
        thread={item}
        isSelected={item.thread_id === selectedThreadId}
        onPress={() => onThreadSelect(item.thread_id)}
        onLongPress={(x, y) =>
          setCtxState({ threadId: item.thread_id, x, y })
        }
        onContextMenuWeb={(x, y) =>
          setCtxState({ threadId: item.thread_id, x, y })
        }
      />
    ),
    [onThreadSelect, selectedThreadId],
  );

  const keyExtractor = useCallback(
    (item: MessageThreadSummary) => item.thread_id,
    [],
  );

  // Loading-with-no-data shows a centered spinner — once we have any rows,
  // we render the list and let the parent's React Query hook handle silent
  // background refetches.
  if (isLoading && threads.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent.cyan} />
        <Text style={styles.loadingText}>Loading conversations…</Text>
      </View>
    );
  }

  if (threads.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState filter={filter} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={Platform.OS !== 'web'}
        ItemSeparatorComponent={Separator}
        {...(Platform.OS === 'web'
          ? ({ className: 'msg-thread-scroll' } as any)
          : {})}
      />

      {/* Context menu floats over everything — rendered last for z-order. */}
      {ctxState && ctxThread && (
        <ContextMenu
          thread={ctxThread}
          anchorX={ctxState.x}
          anchorY={ctxState.y}
          onAction={(action) => {
            onContextMenu(ctxThread.thread_id, action);
            setCtxState(null);
          }}
          onDismiss={() => setCtxState(null)}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  separator: {
    height: 4,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 56,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.muted,
  },
});

export default MessagesThreadList;
