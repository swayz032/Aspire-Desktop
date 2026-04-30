/**
 * FrontDeskSetupTabs — Pass 16 UI (plan §16.G.2)
 *
 * Horizontal segmented control — 5 numbered steps that switch the visible
 * Front Desk Setup section. Replaces the previous "stack everything"
 * scroll layout with a tabbed center-stage so each section gets the full
 * canvas it deserves (per §12.1 Framer-style: "every screen has one job").
 *
 * Visual:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  ① Public Number   ② Catch   ③ Hours   ④ Routing   ⑤ Busy │
 *   │  ════════════                                                  │  <- animated underline
 *   └───────────────────────────────────────────────────────────────┘
 *
 *  - Active tab: white text, filled blue circle, 2px Aspire-blue underline
 *  - Inactive: white@0.55 text, hollow ring digit, transparent underline
 *  - Dirty tab: small Aspire-blue dot to the right of the label
 *  - Underline slides between positions on web with cubic-bezier(0.16,1,0.3,1)
 *  - Web shortcuts: ⌘/Ctrl + 1..5 jump to that tab
 *
 *  Per §12.1: cinematic motion (180ms underline slide), no decoration motion,
 *  layered depth (the active step badge is a luminescent chip), confident
 *  hierarchy (numbers do the wayfinding, labels do the meaning).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FrontDeskTabId =
  | 'public-number'
  | 'catch'
  | 'hours'
  | 'routing'
  | 'busy';

export interface FrontDeskTab {
  id: FrontDeskTabId;
  step: number;
  label: string;
}

export const FRONT_DESK_TABS: readonly FrontDeskTab[] = [
  { id: 'public-number', step: 1, label: 'Public Number' },
  { id: 'catch', step: 2, label: 'Catch Calls' },
  { id: 'hours', step: 3, label: 'Hours' },
  { id: 'routing', step: 4, label: 'Routing' },
  { id: 'busy', step: 5, label: 'Busy Mode' },
] as const;

export interface FrontDeskSetupTabsProps {
  activeTab: FrontDeskTabId;
  onChange: (tab: FrontDeskTabId) => void;
  /** Set of tab ids that have unsaved changes — render a small blue dot. */
  dirtyTabs?: ReadonlySet<FrontDeskTabId>;
}

// ---------------------------------------------------------------------------
// One-time CSS — underline transition + focus-visible (web only)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectTabsCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-tabs-css';
  style.textContent = `
    .fds-tabs-row { position: relative; }
    .fds-tab-btn {
      position: relative;
      transition: color 160ms ease-out, background-color 160ms ease-out;
      cursor: pointer;
    }
    .fds-tab-btn:hover { background-color: rgba(255,255,255,0.025); }
    .fds-tab-btn:focus-visible {
      outline: 2px solid rgba(59,130,246,0.7);
      outline-offset: -2px;
      border-radius: 8px;
    }
    .fds-tab-underline {
      transition: left 220ms cubic-bezier(0.16, 1, 0.3, 1),
                  width 220ms cubic-bezier(0.16, 1, 0.3, 1),
                  opacity 160ms ease-out;
    }
    @media (prefers-reduced-motion: reduce) {
      .fds-tab-btn, .fds-tab-underline { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FrontDeskSetupTabs({
  activeTab,
  onChange,
  dirtyTabs,
}: FrontDeskSetupTabsProps) {
  injectTabsCss();

  // Ref-based measurement of each tab so the underline tracks the active tab
  // even when label widths change (browser font-rendering, locale, etc.).
  const tabRefs = useRef<Record<FrontDeskTabId, View | null>>({
    'public-number': null,
    catch: null,
    hours: null,
    routing: null,
    busy: null,
  });

  const [underlineLeft, setUnderlineLeft] = React.useState(0);
  const [underlineWidth, setUnderlineWidth] = React.useState(0);

  // Measure on mount + when active tab changes (web).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = tabRefs.current[activeTab];
    if (!node) return;
    // RN web exposes the underlying HTMLElement on the View ref via .measure()
    // or DOM. We query it via the native node.
    const el = node as unknown as HTMLElement | null;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setUnderlineLeft(rect.left - parentRect.left);
    setUnderlineWidth(rect.width);
  }, [activeTab]);

  // Web keyboard shortcut — Cmd/Ctrl + 1..5
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const idx = Number(e.key);
      if (!Number.isInteger(idx) || idx < 1 || idx > FRONT_DESK_TABS.length) return;
      e.preventDefault();
      onChange(FRONT_DESK_TABS[idx - 1].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onChange]);

  return (
    <View style={styles.outer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={styles.tabsRow}
          accessibilityRole="tablist"
          accessibilityLabel="Front Desk Setup sections"
          {...(Platform.OS === 'web' ? ({ className: 'fds-tabs-row' } as any) : {})}
        >
          {FRONT_DESK_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const isDirty = !!dirtyTabs?.has(tab.id);
            return (
              <Pressable
                key={tab.id}
                ref={(r: any) => {
                  tabRefs.current[tab.id] = r as unknown as View | null;
                }}
                onPress={() => onChange(tab.id)}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label}${isDirty ? ', unsaved changes' : ''}`}
                accessibilityState={{ selected: isActive }}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                {...(Platform.OS === 'web' ? ({ className: 'fds-tab-btn' } as any) : {})}
              >
                <View style={styles.tabContent}>
                  <View
                    style={[
                      styles.stepCircle,
                      isActive ? styles.stepCircleActive : styles.stepCircleInactive,
                    ]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Text
                      style={[
                        styles.stepText,
                        isActive ? styles.stepTextActive : styles.stepTextInactive,
                      ]}
                    >
                      {tab.step}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {isDirty ? (
                    <View
                      style={styles.dirtyDot}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  ) : null}
                </View>

                {/* Native underline (web uses sliding underline below the row) */}
                {Platform.OS !== 'web' && isActive ? (
                  <View style={styles.nativeUnderline} />
                ) : null}
              </Pressable>
            );
          })}

          {/* Animated sliding underline — web only */}
          {Platform.OS === 'web' && underlineWidth > 0 ? (
            <View
              style={[
                styles.webUnderline,
                {
                  left: underlineLeft,
                  width: underlineWidth,
                } as ViewStyle,
              ]}
              {...({ className: 'fds-tab-underline' } as any)}
              pointerEvents="none"
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Persistent baseline rule beneath the row */}
      <View style={styles.baseline} pointerEvents="none" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TAB_HEIGHT = 52;

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
    width: '100%',
  },
  scrollContent: {
    flexDirection: 'row',
  },
  tabsRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    zIndex: 0,
  },

  // ----- Tab button ----------------------------------------------------
  tabBtn: {
    height: TAB_HEIGHT,
    paddingHorizontal: 14,
    justifyContent: 'center',
    minWidth: 44,
  },
  tabBtnActive: {},
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // ----- Step circle (1..5) -------------------------------------------
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 3px rgba(59,130,246,0.18), 0 0 12px rgba(59,130,246,0.45)',
        } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 6,
        }),
  } as any,
  stepCircleInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  stepTextActive: {
    color: '#ffffff',
  },
  stepTextInactive: {
    color: 'rgba(255,255,255,0.55)',
  },

  // ----- Label ---------------------------------------------------------
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabLabelInactive: {
    color: 'rgba(255,255,255,0.55)',
  },

  // ----- Dirty dot -----------------------------------------------------
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 6px rgba(59,130,246,0.7)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 3,
        }),
  } as any,

  // ----- Underline -----------------------------------------------------
  webUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    zIndex: 1,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(59,130,246,0.55)' } as object)
      : {}),
  } as any,
  nativeUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: Colors.accent.cyan,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});

// Surface unused-import warnings.
void BorderRadius;

export default FrontDeskSetupTabs;
