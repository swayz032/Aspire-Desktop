/**
 * MemoryEngineHero — the brand statement at the top of `/office-memory`.
 *
 * Editorial composition (per plan §12.1 + mockup):
 *   1. AvaOrbVideo (220×220, looping) — the centerpiece. Says "this is alive."
 *   2. "Memory Engine" — display title 48/700, letter-spacing -1.2, with a
 *      subtle blue text-shadow glow on web for atmospheric depth.
 *   3. Subtitle — 16/400 with rgba(255,255,255,0.55) for opacity layering
 *      (NOT literal grey hex per §12.1 typography rules).
 *   4. LedAmbientSearchBar — max-width 720, the interactive heartbeat.
 *
 * Vertical rhythm chosen to feel "magazine cover, not landing page":
 *   Orb → 32px → Title → 12px → Subtitle → 40px → Search bar.
 *
 * The whole block is centered in a generously padded container (paddingVertical
 * 80) so the hero breathes — never crowded, never clipped.
 */

import React, { useState, useCallback } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AvaOrbVideo } from '@/components/AvaOrbVideo';
import { Colors } from '@/constants/tokens';
import { LedAmbientSearchBar } from './LedAmbientSearchBar';

export interface MemoryEngineHeroProps {
  onSearch: (q: string) => void;
}

export function MemoryEngineHero({ onSearch }: MemoryEngineHeroProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (q: string) => {
      onSearch(q);
    },
    [onSearch],
  );

  // Web-only text-shadow for atmospheric title glow per §12.1
  const titleShadow: TextStyle =
    Platform.OS === 'web'
      ? ({ textShadow: '0 0 32px rgba(59,130,246,0.18)' } as unknown as TextStyle)
      : {};

  return (
    <View style={styles.container} accessibilityRole="header">
      {/* Atmospheric backdrop — soft radial blue tint behind the orb on web.
          Native skips this since we can't easily render a soft-focus radial. */}
      {Platform.OS === 'web' && (
        <View
          style={styles.backdropWeb as ViewStyle}
          aria-hidden
          pointerEvents="none"
        />
      )}

      {/* Centerpiece orb — 220 per spec, looping, premium "living blob" */}
      <View style={styles.orbWrap}>
        <AvaOrbVideo state="idle" size={220} />
      </View>

      {/* Display title — confident hierarchy, generous letter-spacing tuning */}
      <Text
        accessibilityRole="header"
        style={[styles.title, titleShadow]}
        numberOfLines={1}
      >
        Memory Engine
      </Text>

      {/* Subtitle — opacity-layered white, max-width 560 for editorial line-length */}
      <Text style={styles.subtitle}>
        Search every meeting, call, document, and decision your office has captured.
      </Text>

      {/* Heartbeat — LED ambient search bar */}
      <View style={styles.searchWrap}>
        <LedAmbientSearchBar
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
        />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: Colors.memory.pageBackground,
    position: 'relative',
    overflow: 'hidden',
  },
  // Web-only soft radial backdrop — pure CSS radial-gradient, no image asset
  backdropWeb: {
    position: 'absolute',
    top: '50%' as unknown as number,
    left: '50%' as unknown as number,
    width: 720,
    height: 720,
    marginLeft: -360,
    marginTop: -360,
    pointerEvents: 'none',
    ...({
      background:
        'radial-gradient(circle at center, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.04) 35%, transparent 65%)',
      filter: 'blur(8px)',
    } as unknown as ViewStyle),
  },
  orbWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle bloom shadow on web only — adds depth without hijacking the orb
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 80px rgba(59,130,246,0.18)' } as unknown as ViewStyle)
      : {}),
    borderRadius: 110,
  },
  title: {
    marginTop: 32,
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -1.2,
    lineHeight: 54,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '400',
    // Opacity layering per §12.1 — NOT a literal grey hex
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 560,
  },
  searchWrap: {
    marginTop: 40,
    width: '100%' as unknown as number,
    maxWidth: 720,
    alignSelf: 'center',
  },
});

export default MemoryEngineHero;
