/**
 * SectionPanel — internal shared shell for Front Desk Setup sections (§10.3).
 *
 * Every numbered section (1–5) wraps its content in this panel so that
 * spacing, borders, shadows, and typography stay consistent across the
 * page. The numbered "step" badge is a luminescent blue chip — not a flat
 * solid — per §12.1 (layered depth, every surface has 2+ layers).
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │ ⓪ Section Title             ┄┄┄┄┄┄┄┄┄┄┄┄┄ headerRight │
 *   │                                                       │
 *   │    children                                           │
 *   └────────────────────────────────────────────────────────┘
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

// One-time CSS injection — staggered fade-up for sections (web).
// Per §12.1: cinematic motion with 60ms stagger between siblings.
let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-section-panel-css';
  style.textContent = `
    @keyframes fds-section-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fds-section-panel { animation: fds-section-fade-up 380ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .fds-section-panel { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

export interface SectionPanelProps {
  /** Numbered step 1–5 shown in the round badge */
  step: number;
  /** Section title (h2-equivalent) */
  title: string;
  /** Optional one-line caption beneath the title */
  caption?: string;
  /** Optional right-aligned slot in the header (e.g., `+ Add contact`) */
  headerRight?: ReactNode;
  /** Section body */
  children: ReactNode;
  /** Optional override of the panel's outer style */
  style?: ViewStyle;
  /** Optional content padding override */
  contentPadding?: number;
  /** Optional zero-based index for staggered entrance (60ms per index) */
  enterIndex?: number;
}

export function SectionPanel({
  step,
  title,
  caption,
  headerRight,
  children,
  style,
  contentPadding = 20,
  enterIndex = 0,
}: SectionPanelProps) {
  injectCss();

  const animationDelay =
    Platform.OS === 'web'
      ? ({ animationDelay: `${enterIndex * 60}ms` } as object)
      : undefined;

  return (
    <View
      style={[styles.panel, animationDelay as any, style]}
      {...(Platform.OS === 'web' ? ({ className: 'fds-section-panel' } as any) : {})}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.stepBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.stepBadgeText}>{step}</Text>
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </View>
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>

      <View style={[styles.content, { padding: contentPadding, paddingTop: caption ? 16 : 18 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#101012',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.025)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: 3,
        }),
  } as any,

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerRight: {
    flexShrink: 0,
  },

  // The numbered badge is a luminescent blue chip — layered depth per §12.1.
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.40)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 4px rgba(59,130,246,0.06), 0 0 16px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.45,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 2,
        }),
  } as any,
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.2,
    lineHeight: 16,
  },

  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 18,
  },

  content: {
    // padding controlled via prop
  },
});

export default SectionPanel;
