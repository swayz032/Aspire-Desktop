/**
 * MemorySummaryCard — primary Summary panel on the detail page.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ Summary                       │   ← 13/600 uppercase tracking +0.4
 *   │                               │
 *   │ Body paragraph (16/400)       │   ← rgba(255,255,255,0.78) opacity layer
 *   │ flowing 2–4 lines, line-      │     for readable secondary text per §12.1
 *   │ height 24 for editorial       │
 *   │ rhythm.                       │
 *   └──────────────────────────────┘
 *
 * Card chrome: deep-charcoal `Colors.memory.cardBg` + 1px hairline border +
 * inset highlight + soft drop shadow. Triple-stack pattern from GlowTrendCard.
 *
 * The eyebrow label sits at the top so the section reads as a "magazine
 * pullquote block" — title at top, body flows below. Generous left padding
 * so the body has room to breathe.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface MemorySummaryCardProps {
  summary: string;
  /** Override the eyebrow label (default: "Summary") */
  eyebrow?: string;
}

export function MemorySummaryCard({
  summary,
  eyebrow = 'Summary',
}: MemorySummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.body}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    // Triple-stack premium shadow — outer drop + inset highlight
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    // Opacity-layered white per §12.1 for body copy on dark surfaces
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 24,
    letterSpacing: -0.05,
  },
});

export default MemorySummaryCard;
