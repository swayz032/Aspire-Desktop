/**
 * MemoryCardGlowHalo — Aspire-blue ambient halo wrapper for memory cards.
 *
 * Provides 2 (native) or 3 (web) layers of depth around the card so it never
 * sits flat on the canvas — per §12.1 "Layered depth, not flat."
 *
 * Layer stack (web):
 *   1. Outer bloom — `boxShadow: 0 0 32px 4px rgba(59,130,246,0.18)`
 *   2. Mid halo — `boxShadow: 0 0 14px 2px rgba(59,130,246,0.25)` + 1px hairline
 *   3. Inner ring — 1px `rgba(59,130,246,0.35)` border on the card itself
 *
 * Native fallback uses 2 stacked Views with shadowColor + shadowOpacity
 * cascading, since RN doesn't support multiple shadow layers per node.
 *
 * Static — does NOT pulse. The LED search bar is the only pulsing element on
 * the page; cards stay calm so the gallery reads as "curated, not chaotic."
 *
 * Intensity prop:
 *   - subtle  — outer 0.10 / mid 0.16 (used for inactive cards in dense grids)
 *   - normal  — outer 0.18 / mid 0.25 (default)
 *   - strong  — outer 0.30 / mid 0.40 (hover/active state — applied by parent)
 */

import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/tokens';

export type HaloIntensity = 'subtle' | 'normal' | 'strong';

export interface MemoryCardGlowHaloProps {
  children: React.ReactNode;
  intensity?: HaloIntensity;
  /** Optional outer style override (e.g., width control in a grid) */
  style?: ViewStyle;
}

const WEB_SHADOWS: Record<HaloIntensity, string> = {
  subtle:
    '0 0 18px 2px rgba(59,130,246,0.10), 0 0 8px 1px rgba(59,130,246,0.16), 0 1px 2px rgba(0,0,0,0.40)',
  normal:
    '0 0 32px 4px rgba(59,130,246,0.18), 0 0 14px 2px rgba(59,130,246,0.25), 0 1px 3px rgba(0,0,0,0.50)',
  strong:
    '0 0 48px 8px rgba(59,130,246,0.30), 0 0 22px 4px rgba(59,130,246,0.40), 0 4px 14px rgba(0,0,0,0.55)',
};

const NATIVE_OPACITY: Record<HaloIntensity, number> = {
  subtle: 0.20,
  normal: 0.32,
  strong: 0.50,
};

export function MemoryCardGlowHalo({
  children,
  intensity = 'normal',
  style,
}: MemoryCardGlowHaloProps) {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.haloWeb,
          { boxShadow: WEB_SHADOWS[intensity] } as unknown as ViewStyle,
          style,
        ]}
      >
        {/* Inner 1px Aspire-blue ring — the closest layer to content */}
        <View style={styles.innerRingWeb} pointerEvents="none" aria-hidden />
        {children}
      </View>
    );
  }

  // Native: two stacked Views with cascading shadows.
  return (
    <View style={[styles.haloNative, style]}>
      <View
        style={[
          styles.shadowOuterNative,
          {
            shadowColor: Colors.accent.cyan,
            shadowOpacity: NATIVE_OPACITY[intensity] * 0.6,
            shadowRadius: 18,
            elevation: 6,
          },
        ]}
      >
        <View
          style={[
            styles.shadowMidNative,
            {
              shadowColor: Colors.accent.cyan,
              shadowOpacity: NATIVE_OPACITY[intensity],
              shadowRadius: 10,
              elevation: 8,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  haloWeb: {
    position: 'relative',
    borderRadius: 16,
  },
  innerRingWeb: {
    position: 'absolute',
    inset: 0 as unknown as number,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.memory.haloRing,
    pointerEvents: 'none',
    zIndex: 1,
  },
  haloNative: {
    borderRadius: 16,
  },
  shadowOuterNative: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  shadowMidNative: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default MemoryCardGlowHalo;
