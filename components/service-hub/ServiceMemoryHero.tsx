/**
 * ServiceMemoryHero — the brand statement at the top of `/service-hub/memory`.
 *
 * Editorial composition mirrors `MemoryEngineHero` byte-for-byte. Only the
 * title and subtitle text change — every spacing, color, animation, and
 * gradient token stays IDENTICAL so the two pages feel like one product.
 *
 *   1. AvaOrb (220×220, idle) — centerpiece.
 *   2. "Service Memory" — display title 48/700, letter-spacing -1.2.
 *   3. Subtitle — 16/400 rgba(255,255,255,0.55).
 *   4. LedAmbientSearchBar — max-width 720.
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
import { AvaOrb } from '@/components/AvaOrb';
import { Colors } from '@/constants/tokens';
import { LedAmbientSearchBar } from '@/components/office-memory/LedAmbientSearchBar';

export interface ServiceMemoryHeroProps {
  onSearch: (q: string) => void;
}

export function ServiceMemoryHero({ onSearch }: ServiceMemoryHeroProps) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (q: string) => {
      onSearch(q);
    },
    [onSearch],
  );

  const titleShadow: TextStyle =
    Platform.OS === 'web'
      ? ({ textShadow: '0 0 32px rgba(59,130,246,0.18)' } as unknown as TextStyle)
      : {};

  return (
    <View style={styles.container} accessibilityRole="header">
      {Platform.OS === 'web' && (
        <View
          style={styles.backdropWeb as ViewStyle}
          aria-hidden
          pointerEvents="none"
        />
      )}

      <View style={styles.orbWrap}>
        <AvaOrb state="idle" size={220} />
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.title, titleShadow]}
        numberOfLines={1}
      >
        Service Memory
      </Text>

      <Text style={styles.subtitle}>
        Search every job, blueprint, material decision, and call your service desk has captured.
      </Text>

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

export default ServiceMemoryHero;
