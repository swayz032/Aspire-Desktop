/**
 * CatchCallsSection — Pass 10 Lane B (plan §10.3 Section 2)
 *
 * Numbered "2" — How You Catch Calls. Three radio options stacked
 * vertically. Italic clarifying note below the options about the
 * "first answer wins" race condition between Aspire and direct phone
 * voicemail.
 *
 * Per §12.1: every option has hover lift, focus ring, and ≥44pt tap
 * area; selected state uses Aspire-blue ring + soft glow.
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
import type { CatchMode } from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CatchCallsSectionProps {
  mode: CatchMode;
  onChange: (mode: CatchMode) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// Option metadata
// ---------------------------------------------------------------------------

type OptionDef = {
  value: CatchMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const OPTIONS: OptionDef[] = [
  {
    value: 'APP_ONLY',
    icon: 'desktop-outline',
    title: 'Ring in Aspire',
    subtitle: 'Calls ring in the Aspire desktop and mobile app.',
  },
  {
    value: 'PHONE_ONLY',
    icon: 'phone-portrait-outline',
    title: 'Ring my phone',
    subtitle: 'Calls route to your direct phone number.',
  },
  {
    value: 'APP_AND_PHONE_SIMUL_RING',
    icon: 'flash-outline',
    title: 'Ring both (advanced)',
    subtitle: 'Ring Aspire and your phone at the same time.',
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
  style.id = 'fds-catch-calls-css';
  style.textContent = `
    .fds-catch-row { transition: border-color 180ms cubic-bezier(0.16,1,0.3,1), background-color 180ms ease-out, box-shadow 180ms ease-out, transform 160ms ease-out; }
    .fds-catch-row:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.16); }
    .fds-catch-row:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CatchCallsSection({ mode, onChange, enterIndex }: CatchCallsSectionProps) {
  injectCss();

  return (
    <SectionPanel step={2} title="How You Catch Calls" enterIndex={enterIndex}>
      <View style={styles.optionsCol} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
              style={[styles.row, selected && styles.rowSelected]}
              {...(Platform.OS === 'web' ? ({ className: 'fds-catch-row' } as any) : {})}
            >
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>

              <View style={[styles.iconBubble, selected && styles.iconBubbleSelected]}>
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={selected ? Colors.accent.cyan : Colors.text.tertiary}
                />
              </View>

              <View style={styles.body}>
                <Text style={[styles.title, selected && styles.titleSelected]}>{opt.title}</Text>
                <Text style={styles.subtitle}>{opt.subtitle}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={13} color={Colors.text.muted} />
        <Text style={styles.noteText}>
          First answer wins. Direct-phone voicemail may answer first.
        </Text>
      </View>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  optionsCol: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 60,
  },
  rowSelected: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(59,130,246,0.25), 0 0 20px rgba(59,130,246,0.13)' } as object)
      : { shadowColor: '#3B82F6', shadowOpacity: 0.32, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }),
  } as any,

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

  // Icon bubble
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBubbleSelected: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.30)',
  },

  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  titleSelected: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.text.muted,
    flex: 1,
  },
});

export default CatchCallsSection;
