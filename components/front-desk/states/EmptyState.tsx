/**
 * EmptyState — centered premium glass empty-state for Front Desk Hub sections.
 *
 * Matches the glass aesthetic established in inboxShared.tsx and the contacts
 * workspace inline emptyState style (background: rgba(255,255,255,0.04),
 * border: 1px solid rgba(255,255,255,0.08)).
 */

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/components/front-desk/types';

export interface EmptyStateProps {
  icon: IoniconName;
  headline: string;
  subtitle?: string;
}

export function EmptyState({ icon, headline, subtitle }: EmptyStateProps) {
  if (Platform.OS !== 'web') {
    return <View style={styles.fill} />;
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Icon container — 60px muted icon */}
        <div style={iconWrap}>
          <Ionicons name={icon} size={28} color="rgba(255,255,255,0.28)" />
        </div>
        <span style={headlineText}>{headline}</span>
        {subtitle ? <span style={subtitleText}>{subtitle}</span> : null}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

const wrap: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 32,
  paddingBottom: 32,
  paddingLeft: 16,
  paddingRight: 16,
};

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: 24,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  maxWidth: 240,
  textAlign: 'center',
};

const iconWrap: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 30,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
};

const headlineText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.75)',
  letterSpacing: -0.1,
};

const subtitleText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.40)',
  lineHeight: 1.4 as React.CSSProperties['lineHeight'],
};
