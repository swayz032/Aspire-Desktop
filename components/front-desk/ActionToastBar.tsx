/**
 * ActionToastBar — bottom-center "Verified ✓" receipt toasts.
 *
 * Renders the active toasts from FrontDeskContext at the bottom of the
 * front-desk surface.  Each toast auto-dismisses after 3s.
 *
 * Law #2: receipt_id MUST be surfaced in every success state.
 */

import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFrontDeskContext } from '@/lib/context/FrontDeskContext';

export function ActionToastBar() {
  const { toasts, dismissToast } = useFrontDeskContext();
  if (Platform.OS !== 'web' || toasts.length === 0) return null;

  return (
    <div style={container}>
      {toasts.map((t) => (
        <div key={t.id} style={toastRow}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <span style={toastLabel}>Verified</span>
          {t.label ? <span style={toastDetail}>{t.label}</span> : null}
          <span style={receiptChip}>#{t.receipt_id.slice(0, 8)}</span>
          <button
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
            style={dismissBtn}
          >
            <Ionicons name="close" size={11} color="rgba(255,255,255,0.5)" />
          </button>
        </div>
      ))}
    </div>
  );
}

const container: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  zIndex: 100,
  pointerEvents: 'none',
};

const toastRow: React.CSSProperties = {
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  paddingTop: 7,
  paddingBottom: 7,
  paddingLeft: 12,
  paddingRight: 10,
  borderRadius: 999,
  background: 'rgba(10,10,15,0.92)',
  border: '1px solid rgba(34,197,94,0.25)',
  boxShadow: '0 4px 14px rgba(0,0,0,0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  whiteSpace: 'nowrap',
};

const toastLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: '#22C55E',
  letterSpacing: 0.2,
};

const toastDetail: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.65)',
};

const receiptChip: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.40)',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 999,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 6,
  paddingRight: 6,
  fontVariantNumeric: 'tabular-nums',
};

const dismissBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: 9,
  marginLeft: 2,
};
