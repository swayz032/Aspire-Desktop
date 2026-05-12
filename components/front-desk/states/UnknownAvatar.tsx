/**
 * UnknownAvatar — premium dark gradient circle for unknown callers.
 *
 * Dimensions are intentionally identical to inboxShared.tsx Avatar (default
 * size = 36) so the list layout does not shift when an unknown caller row
 * replaces a known-caller row.
 *
 * Visual spec:
 *   - Background: dark gradient #1f1f22 → #16161a (depth without color)
 *   - Inner ring: inset 0 1px 0 rgba(255,255,255,0.08) — barely-there highlight
 *   - Icon: Ionicons `call-outline` at rgba(255,255,255,0.55) — muted, readable
 *   - No colored avatar — color is reserved for identity (Law of contrast)
 */

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface UnknownAvatarProps {
  size?: number;
}

export function UnknownAvatar({ size = 36 }: UnknownAvatarProps) {
  if (Platform.OS !== 'web') {
    return <View style={[styles.fill, { width: size, height: size }]} />;
  }

  const iconSize = Math.round(size * 0.44);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: 'linear-gradient(145deg, #1f1f22 0%, #16161a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.08)',
          'inset 0 -1px 0 rgba(0,0,0,0.30)',
          '0 1px 3px rgba(0,0,0,0.40)',
        ].join(', '),
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Ionicons name="call-outline" size={iconSize} color="rgba(255,255,255,0.55)" />
    </div>
  );
}

const styles = StyleSheet.create({ fill: { backgroundColor: '#1f1f22', borderRadius: 999 } });
