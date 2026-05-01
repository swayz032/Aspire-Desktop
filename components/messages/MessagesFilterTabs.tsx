/**
 * MessagesFilterTabs — segmented tab strip below the hero (plan §3.9.2,
 * Lane E2). Filters the thread list and exposes bulk-action overflow menu.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  [ All 42 ]  Unread 7   Pinned 3   Archived 14                ⋮  │
 *   │   ━━━━━━━━                                                        │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Active tab gets a 2px Aspire-blue underline that springs into position
 * via Animated.Value.timing — NOT a static class swap. Inactive tabs sit
 * at 60% opacity white.
 *
 * Accessibility:
 *   - container is a `tablist`, each tab is a `tab`
 *   - selected tab announces via `accessibilityState={{ selected: true }}`
 *   - ⋮ overflow opens a `menu` with `menuitem` rows
 *   - keyboard: ⌘1–⌘4 switch tabs on web (Platform.OS === 'web' guarded)
 *   - tap targets 44pt minimum
 *
 * Per §12.1 Framer-style: the underline isn't a "tab indicator" — it's the
 * heartbeat. Spring physics, not a CSS ease. Counts feel alive because they
 * tick with the data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MessagesFilterTab = 'all' | 'unread' | 'pinned' | 'archived';

export interface MessagesFilterCounts {
  all: number;
  unread: number;
  pinned: number;
  archived: number;
}

export interface MessagesFilterTabsProps {
  /** Currently-active tab. */
  activeTab: MessagesFilterTab;
  /** Fired when the user clicks a tab or hits ⌘1–⌘4. */
  onChange: (tab: MessagesFilterTab) => void;
  /** Live counts for each tab (zero is rendered, not hidden). */
  counts: MessagesFilterCounts;
  /** Overflow menu item — bulk mark all as read. */
  onMarkAllRead: () => void;
  /** Overflow menu item — clear all archived threads. */
  onClearArchived: () => void;
  /** Overflow menu item — export selected (V1.1, surfaced as "coming soon"). */
  onExportSelected?: () => void;
}

// ---------------------------------------------------------------------------
// Tab metadata — single source of truth so order, label, and shortcut all
// stay in lock-step. ⌘1 maps to index 0, ⌘2 to 1, etc.
// ---------------------------------------------------------------------------

interface TabMeta {
  id: MessagesFilterTab;
  label: string;
  /** Keyboard shortcut number on web (1-indexed). */
  shortcut: number;
}

const TABS: readonly TabMeta[] = [
  { id: 'all', label: 'All', shortcut: 1 },
  { id: 'unread', label: 'Unread', shortcut: 2 },
  { id: 'pinned', label: 'Pinned', shortcut: 3 },
  { id: 'archived', label: 'Archived', shortcut: 4 },
];

// ---------------------------------------------------------------------------
// One-time CSS injection (web only) — focus-visible outline + spring on
// the active underline ARE handled in JS (Animated.Value), not CSS, so the
// CSS block is small.
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectFilterTabsCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const STYLE_ID = 'messages-filter-tabs-css';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .msg-tab-btn { transition: color 160ms ease-out, background-color 160ms ease-out; min-height: 44px; }
    .msg-tab-btn:hover { background-color: rgba(255,255,255,0.04); }
    .msg-tab-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; border-radius: 8px; }
    .msg-tab-overflow { transition: background-color 160ms ease-out; min-height: 44px; min-width: 44px; }
    .msg-tab-overflow:hover { background-color: rgba(255,255,255,0.06); }
    .msg-tab-overflow:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; border-radius: 8px; }
    .msg-tab-menu-item { transition: background-color 120ms ease-out; }
    .msg-tab-menu-item:hover { background-color: rgba(255,255,255,0.06); }
    .msg-tab-menu-item:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: -2px; }
    @keyframes msg-tab-menu-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .msg-tab-menu { animation: msg-tab-menu-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .msg-tab-btn, .msg-tab-overflow, .msg-tab-menu-item, .msg-tab-menu { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Layout constants — kept here, not in tokens, because they describe THIS
// component's geometry and aren't reused elsewhere.
// ---------------------------------------------------------------------------

/** Tab horizontal padding — tap target growth comes from this + minHeight. */
const TAB_PAD_H = 14;
/** Tab vertical padding — combined with text height yields ≥44pt. */
const TAB_PAD_V = 12;
/** Spacing between tabs (the visual gap, not a margin on the underline). */
const TAB_GAP = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessagesFilterTabs({
  activeTab,
  onChange,
  counts,
  onMarkAllRead,
  onClearArchived,
  onExportSelected,
}: MessagesFilterTabsProps) {
  injectFilterTabsCss();

  // ── Underline animation ─────────────────────────────────────────────────
  // We track each tab's measured `{x, width}` then animate the underline's
  // `translateX` and `width` to the active tab's slot.
  const [layouts, setLayouts] = useState<Record<MessagesFilterTab, { x: number; width: number }>>(
    {
      all: { x: 0, width: 0 },
      unread: { x: 0, width: 0 },
      pinned: { x: 0, width: 0 },
      archived: { x: 0, width: 0 },
    },
  );

  const translateX = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  // Tracks whether the underline has been positioned at least once. Until
  // the first measurement lands we snap (no spring); after that, springs.
  const hasInitialPositionRef = useRef(false);

  // When the active tab or any layout changes, spring the underline.
  useEffect(() => {
    const target = layouts[activeTab];
    if (target.width === 0) return; // not measured yet

    // First-mount snap (no animation) — prevents the underline shooting in
    // from x=0 on initial render. We avoid the private `__getValue` API
    // (TS-typed as not-public) and gate on a ref instead.
    if (!hasInitialPositionRef.current) {
      hasInitialPositionRef.current = true;
      translateX.setValue(target.x);
      width.setValue(target.width);
      return;
    }

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: target.x,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.spring(width, {
        toValue: target.width,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: false,
      }),
    ]).start();
  }, [activeTab, layouts, translateX, width]);

  // ── ⌘1–⌘4 keyboard shortcuts (web only) ───────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      // Only trigger on ⌘ (Mac) or Ctrl (Win/Linux) + digit, with no other
      // modifiers + no input/textarea focused (don't hijack typing).
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!cmdOrCtrl || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        target?.getAttribute?.('contenteditable') === 'true'
      ) {
        return;
      }
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= TABS.length) {
        e.preventDefault();
        onChange(TABS[digit - 1].id);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onChange]);

  // ── Overflow menu state ─────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  // Click-outside to close (web only) — listens on document mousedown.
  const overflowRef = useRef<View>(null);
  useEffect(() => {
    if (!menuOpen || Platform.OS !== 'web') return;
    const handler = (e: MouseEvent) => {
      const node = overflowRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Tab onLayout handler ───────────────────────────────────────────────
  const onTabLayout = useCallback(
    (id: MessagesFilterTab) =>
      (e: { nativeEvent: { layout: { x: number; width: number } } }) => {
        const { x, width: w } = e.nativeEvent.layout;
        setLayouts((prev) => {
          // Skip update if unchanged — prevents infinite render loop on
          // strict-mode double-render.
          if (prev[id].x === x && prev[id].width === w) return prev;
          return { ...prev, [id]: { x, width: w } };
        });
      },
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {/* Inner row that owns the tabs + underline */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const count = counts[tab.id];
          return (
            <Pressable
              key={tab.id}
              style={styles.tabBtn}
              onPress={() => onChange(tab.id)}
              onLayout={onTabLayout(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label}${
                count > 0 ? `, ${count} ${count === 1 ? 'thread' : 'threads'}` : ''
              }`}
              accessibilityHint={
                Platform.OS === 'web'
                  ? `Keyboard shortcut: command ${tab.shortcut}`
                  : undefined
              }
              {...(Platform.OS === 'web'
                ? ({ className: 'msg-tab-btn' } as any)
                : {})}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <View
                style={[styles.countPill, isActive && styles.countPillActive]}
              >
                <Text
                  style={[
                    styles.countText,
                    isActive && styles.countTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Animated underline — sits absolutely over the tabs row */}
        <Animated.View
          style={[
            styles.underline,
            {
              transform: [{ translateX }],
              width,
            },
          ]}
          pointerEvents="none"
        />
      </View>

      {/* Overflow ⋮ — anchored to the right with bulk-action menu */}
      <View style={styles.overflowAnchor} ref={overflowRef as any}>
        <Pressable
          style={styles.overflowBtn}
          onPress={() => setMenuOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          accessibilityHint="Open bulk actions menu"
          accessibilityState={{ expanded: menuOpen }}
          {...(Platform.OS === 'web'
            ? ({ className: 'msg-tab-overflow' } as any)
            : {})}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={Colors.text.tertiary}
          />
        </Pressable>

        {menuOpen && (
          <View
            style={styles.menu}
            accessibilityRole="menu"
            {...(Platform.OS === 'web'
              ? ({ className: 'msg-tab-menu' } as any)
              : {})}
          >
            <MenuItem
              icon="checkmark-done-outline"
              label="Mark all as read"
              onPress={() => {
                setMenuOpen(false);
                onMarkAllRead();
              }}
            />
            <MenuItem
              icon="archive-outline"
              label="Clear archived"
              onPress={() => {
                setMenuOpen(false);
                onClearArchived();
              }}
              destructive
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="download-outline"
              label="Export selected"
              caption="Coming soon"
              onPress={() => {
                if (onExportSelected) {
                  setMenuOpen(false);
                  onExportSelected();
                }
              }}
              disabled
            />
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Menu item — small internal helper
// ---------------------------------------------------------------------------

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption?: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function MenuItem({
  icon,
  label,
  caption,
  onPress,
  destructive,
  disabled,
}: MenuItemProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="menuitem"
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      accessibilityState={{ disabled }}
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      {...(Platform.OS === 'web'
        ? ({ className: 'msg-tab-menu-item' } as any)
        : {})}
    >
      <Ionicons
        name={icon}
        size={16}
        color={
          disabled
            ? Colors.text.disabled
            : destructive
              ? Colors.semantic.error
              : Colors.text.secondary
        }
      />
      <View style={styles.menuItemText}>
        <Text
          style={[
            styles.menuItemLabel,
            destructive && !disabled && styles.menuItemLabelDestructive,
            disabled && styles.menuItemLabelDisabled,
          ]}
        >
          {label}
        </Text>
        {caption && (
          <Text style={styles.menuItemCaption}>{caption}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent',
    minHeight: 52,
  },

  // ----- Tabs row + underline ------------------------------------------
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TAB_GAP,
    position: 'relative',
    flex: 1,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: TAB_PAD_H,
    paddingVertical: TAB_PAD_V,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Count pill — small chip that holds the integer.
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  countPillActive: {
    backgroundColor: 'rgba(59,130,246,0.20)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  countTextActive: {
    color: Colors.accent.cyan,
  },

  // ----- Underline — absolutely positioned, sized to the active tab ----
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 1,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 12px rgba(59,130,246,0.55)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOpacity: 0.6,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,

  // ----- Overflow ⋮ -----------------------------------------------------
  overflowAnchor: {
    position: 'relative',
  },
  overflowBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },

  // ----- Menu popover (anchored top-right of overflow button) ----------
  menu: {
    position: 'absolute',
    top: 48,
    right: 0,
    minWidth: 220,
    backgroundColor: '#161618',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.35)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
          elevation: 12,
        }),
  } as any,
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  menuItemDisabled: {
    opacity: 0.55,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.bright,
  },
  menuItemLabelDestructive: {
    color: Colors.semantic.error,
  },
  menuItemLabelDisabled: {
    color: Colors.text.disabled,
  },
  menuItemCaption: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
    marginHorizontal: 6,
  },
});

export default MessagesFilterTabs;
