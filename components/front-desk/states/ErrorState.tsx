/**
 * ErrorState — Front Desk Hub error display with gradient retry button.
 *
 * Matches the premium glass aesthetic from inboxShared.tsx (dark borders,
 * subtle backgrounds). The Retry button uses the same gradient as the SMS
 * compose send button and EventDetailModal primary button.
 */

import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  if (Platform.OS !== 'web') {
    return <View style={styles.fill} />;
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={iconWrap}>
          <Ionicons name="alert-circle-outline" size={24} color="rgba(239,68,68,0.80)" />
        </div>
        <span style={messageText}>{message}</span>
        {onRetry ? (
          <button
            onClick={onRetry}
            style={retryBtn}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.88';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
          >
            <Ionicons name="refresh-outline" size={14} color="#fff" />
            <span style={retryLabel}>Retry</span>
          </button>
        ) : null}
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
  gap: 12,
  padding: 20,
  borderRadius: 14,
  background: 'rgba(239,68,68,0.06)',
  border: '1px solid rgba(239,68,68,0.18)',
  maxWidth: 240,
  textAlign: 'center',
};

const iconWrap: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 24,
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.20)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const messageText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
  lineHeight: 1.4 as React.CSSProperties['lineHeight'],
};

const retryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  paddingLeft: 14,
  paddingRight: 14,
  borderRadius: 17,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  backgroundImage:
    'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.22)',
  transition: 'opacity 0.15s ease',
};

const retryLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  letterSpacing: 0.2,
};
