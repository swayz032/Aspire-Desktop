/**
 * BusyModeSection — Pass 10 Lane B (plan §10.3 Section 5)
 *
 * Numbered "5" — When We're Busy. Three premium radio CARDS in a row
 * (icon + title + subtitle each) — not flat radio buttons. The cards
 * sit on a horizontal grid; each card is a full-bleed selectable
 * surface with a layered selection state.
 *
 * Per §12.1: each card has icon bubble + spring-animated selection,
 * web hover lift, focus ring, ≥44pt tap targets. Cards wrap to a
 * stacked column below ~720px parent width.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import type { BusyMode } from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BusyModeSectionProps {
  mode: BusyMode;
  onChange: (mode: BusyMode) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// Option metadata
// ---------------------------------------------------------------------------

type OptionDef = {
  value: BusyMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const OPTIONS: OptionDef[] = [
  {
    value: 'TAKE_MESSAGE',
    icon: 'mail-outline',
    title: 'Take message',
    subtitle: "Capture caller's message.",
  },
  {
    value: 'ASK_CALLBACK_WINDOW',
    icon: 'time-outline',
    title: 'Ask for callback window',
    subtitle: 'Get a good time to call back.',
  },
  {
    value: 'TRY_TRANSFER_THEN_MESSAGE',
    icon: 'swap-horizontal-outline',
    title: 'Try transfer once, then message',
    subtitle: 'Attempt transfer before taking a message.',
  },
];

// ---------------------------------------------------------------------------
// One-time CSS
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-busy-mode-css';
  style.textContent = `
    .fds-busy-card { transition: border-color 200ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease-out, box-shadow 200ms ease-out, transform 180ms ease-out; }
    .fds-busy-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.16); }
    .fds-busy-card:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-busy-card:active { transform: translateY(0); }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusyModeSection({ mode, onChange, enterIndex }: BusyModeSectionProps) {
  injectCss();

  return (
    <SectionPanel step={5} title="When We're Busy" enterIndex={enterIndex}>
      <View style={styles.cardsRow} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
              style={[styles.card, selected && styles.cardSelected]}
              {...(Platform.OS === 'web' ? ({ className: 'fds-busy-card' } as any) : {})}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBubble, selected && styles.iconBubbleSelected]}>
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={selected ? Colors.accent.cyan : Colors.text.tertiary}
                  />
                </View>

                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
              </View>

              <Text style={[styles.title, selected && styles.titleSelected]}>{opt.title}</Text>
              <Text style={styles.subtitle}>{opt.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 220,
    padding: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 130,
    gap: 8,
    justifyContent: 'flex-start',
  },
  cardSelected: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderColor: 'rgba(59,130,246,0.50)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(59,130,246,0.30), 0 4px 16px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
        } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.42,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }),
  } as any,

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBubbleSelected: {
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderColor: 'rgba(59,130,246,0.32)',
  },

  // Radio
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.accent.cyan,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.accent.cyan,
  },

  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
    lineHeight: 18,
    marginTop: 4,
  },
  titleSelected: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 17,
  },
});

export default BusyModeSection;
