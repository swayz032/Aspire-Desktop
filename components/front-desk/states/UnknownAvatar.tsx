/**
 * UnknownAvatar — premium "no-identity" avatar for unmatched callers.
 *
 * Pass D round 3 (2026-05-12) — founder: regular premium avatar look (no "?"),
 * vivid Aspire-blue, sits as a peer next to the colored initial-circles
 * (BO/ML/DR/JC/AH/CS/MT) in the inbox rail.
 *
 * Spec:
 *   - Vivid Aspire-blue conic gradient surface (same saturation as colored peers).
 *   - Glass top-left highlight sweep — premium material feel.
 *   - Inner highlight + outer shadow stack matching colored Avatar.
 *   - White filled person silhouette centered, slight drop shadow.
 *   - All sizes get the same treatment (no size gating). Scales linearly.
 *
 * Dimensions stay identical to inboxShared.tsx Avatar so list rows don't shift.
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

  const iconSize = Math.round(size * 0.62);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 2,
        // Vivid Aspire-blue with conic sheen — same family as colored avatars,
        // instantly readable as a peer (not a placeholder).
        backgroundImage:
          'conic-gradient(from 220deg at 50% 50%, #1D4ED8 0deg, #2563EB 90deg, #3B82F6 180deg, #1E40AF 280deg, #1D4ED8 360deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: [
          'inset 0 1px 0 rgba(255,255,255,0.30)',
          'inset 0 -1px 1px rgba(0,0,0,0.35)',
          '0 1px 3px rgba(0,0,0,0.50)',
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* Glass top-left highlight sweep — premium material feel. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-20%',
          width: '90%',
          height: '70%',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 70%)',
          transform: 'rotate(-12deg)',
          pointerEvents: 'none',
          borderRadius: '50%',
        }}
      />
      {/* White filled person silhouette — premium, low-key, ID-card vibe. */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          display: 'flex',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))',
        }}
      >
        <Ionicons name="person" size={iconSize} color="#ffffff" />
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { backgroundColor: '#1D4ED8', borderRadius: 999 } });
