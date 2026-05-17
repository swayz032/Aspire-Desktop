/**
 * TruthBadge — Wave 7.
 *
 * Tiny color-coded chip that renders a TruthClass inline. Used throughout
 * the Scope tab next to story facts, assemblies, materials, and missing
 * input descriptions so contractors can instantly tell what's solid vs
 * what needs field confirmation.
 *
 * Palette (premium dark theme):
 *   observed         — teal     (verified off a sheet)
 *   derived          — blue     (computed from observed facts)
 *   assumed          — amber    (LLM best-guess, needs confirmation)
 *   missing          — orange   (known-unknown, must be resolved)
 *   field_confirmed  — green    (owner/contractor confirmed in field)
 *   vendor_confirmed — emerald  (supplier quote pinned the fact)
 *   permit_confirmed — purple   (permit / inspection record pinned)
 *
 * Law #7: pure render — no fetch, no decision.
 */
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { TruthClass } from '@/lib/api/blueprintsApi';

interface Props {
  truth: TruthClass;
  /** Optional 0..1 confidence — rendered inline when present. */
  confidence?: number;
  /** Optional custom label override. Defaults to the truth class name. */
  label?: string;
  /** Compact variant — smaller padding + font. */
  size?: 'sm' | 'md';
  testID?: string;
}

interface TruthStyle {
  fg: string;
  bg: string;
  border: string;
  label: string;
}

const TRUTH_STYLES: Record<TruthClass, TruthStyle> = {
  observed: {
    fg: '#2dd4bf',
    bg: 'rgba(45,212,191,0.10)',
    border: 'rgba(45,212,191,0.45)',
    label: 'observed',
  },
  derived: {
    fg: '#60a5fa',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.45)',
    label: 'derived',
  },
  assumed: {
    fg: '#fbbf24',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.55)',
    label: 'assumed',
  },
  missing: {
    fg: '#fb923c',
    bg: 'rgba(251,146,60,0.10)',
    border: 'rgba(251,146,60,0.55)',
    label: 'missing',
  },
  field_confirmed: {
    fg: '#4ade80',
    bg: 'rgba(74,222,128,0.10)',
    border: 'rgba(74,222,128,0.45)',
    label: 'field confirmed',
  },
  vendor_confirmed: {
    fg: '#34d399',
    bg: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.45)',
    label: 'vendor confirmed',
  },
  permit_confirmed: {
    fg: '#c084fc',
    bg: 'rgba(192,132,252,0.10)',
    border: 'rgba(192,132,252,0.45)',
    label: 'permit confirmed',
  },
};

export function getTruthStyle(truth: TruthClass): TruthStyle {
  return TRUTH_STYLES[truth] ?? TRUTH_STYLES.assumed;
}

export function TruthBadge({
  truth,
  confidence,
  label,
  size = 'sm',
  testID,
}: Props): React.ReactElement {
  const style = getTruthStyle(truth);
  const text = label ?? style.label;
  const showConf =
    typeof confidence === 'number' &&
    (truth === 'derived' || truth === 'assumed');
  return (
    <View
      style={[
        styles.badge,
        size === 'md' && styles.badgeMd,
        { backgroundColor: style.bg, borderColor: style.border },
      ]}
      testID={testID ?? `truth-badge-${truth}`}
    >
      <Text
        style={[
          styles.label,
          size === 'md' && styles.labelMd,
          { color: style.fg },
        ]}
      >
        {text}
        {showConf ? ` ${confidence!.toFixed(2)}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 150ms ease' } as any)
      : {}),
  },
  badgeMd: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 5,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  labelMd: {
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
});
