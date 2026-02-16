import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AvatarTileSize = 'small' | 'normal' | 'spotlight';

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function AvatarTileSurface({
  name,
  seed,
  accentColor,
  size = 'normal',
  videoOff = false,
  style,
}: {
  name: string;
  seed: string;
  accentColor: string;
  size?: AvatarTileSize;
  videoOff?: boolean;
  style?: ViewStyle;
}) {
  const initials = useMemo(() => getInitials(name), [name]);

  const { bgA, bgB } = useMemo(() => {
    const h = hashSeed(seed);
    const palette: [string, string][] = [
      ['#0F172A', '#111827'],
      ['#0B1020', '#0F172A'],
      ['#111827', '#0A0A0C'],
      ['#0B1324', '#101A2C'],
      ['#0A1222', '#0E1628'],
    ];
    const [a, b] = palette[h % palette.length];
    return { bgA: a, bgB: b };
  }, [seed]);

  const ringSize = size === 'small' ? 34 : size === 'spotlight' ? 88 : 56;
  const fontSize = size === 'small' ? 14 : size === 'spotlight' ? 34 : 22;

  return (
    <LinearGradient
      colors={[bgA, bgB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, style]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.35)']}
        style={styles.vignette}
      />

      <View style={styles.center}>
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: accentColor }]}>
          <LinearGradient
            colors={[`${accentColor}55`, `${accentColor}15`]}
            style={[styles.inner, { borderRadius: (ringSize - 6) / 2 }]}
          >
            <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
          </LinearGradient>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vignette: { ...StyleSheet.absoluteFillObject },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inner: {
    width: '88%',
    height: '88%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.6,
  },
});
