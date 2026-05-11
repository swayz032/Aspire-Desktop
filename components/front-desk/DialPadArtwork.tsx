import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * DialPadArtwork — black glassy keypad card.
 *
 * Layout: glassy number screen on top, 4x3 grid of neutral glass dial
 * buttons in the middle (no gradient — kept calm so the screen + call
 * button breathe), single full-width gradient Call pill at the bottom.
 * Pure CSS grid so the buttons size to fit the container at any width.
 */

const KEYS = [
  { d: '1', sub: '' },
  { d: '2', sub: 'ABC' },
  { d: '3', sub: 'DEF' },
  { d: '4', sub: 'GHI' },
  { d: '5', sub: 'JKL' },
  { d: '6', sub: 'MNO' },
  { d: '7', sub: 'PQRS' },
  { d: '8', sub: 'TUV' },
  { d: '9', sub: 'WXYZ' },
  { d: '*', sub: '' },
  { d: '0', sub: '+' },
  { d: '#', sub: '' },
];

const GRADIENT =
  'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)';

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d*#+]/g, '');
  if (d.length === 0) return '';
  if (/[*#+]/.test(raw)) return raw;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `+${d.slice(0, d.length - 10)} (${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}`;
}

export function DialPadArtwork() {
  const [typed, setTyped] = useState('');
  const display = useMemo(() => formatPhone(typed), [typed]);

  const append = (ch: string) => setTyped((prev) => (prev + ch).slice(0, 18));
  const backspace = () => setTyped((prev) => prev.slice(0, -1));

  if (Platform.OS !== 'web') {
    return <View style={styles.card} />;
  }

  return (
    <View style={styles.card}>
      {/* Glassy number screen */}
      <div style={screen}>
        <span style={screenText(display.length === 0)}>
          {display || 'Enter number'}
        </span>
        {typed.length > 0 ? (
          <button
            aria-label="Backspace"
            onClick={backspace}
            style={backspaceBtn}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
          >
            <Ionicons name="backspace-outline" size={18} color="currentColor" />
          </button>
        ) : null}
      </div>

      {/* Keypad grid */}
      <div style={grid}>
        {KEYS.map((k) => (
          <button
            key={k.d}
            onClick={() => append(k.d)}
            style={keyBtn}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.08)';
              el.style.borderColor = 'rgba(255,255,255,0.14)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,255,255,0.04)';
              el.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <span style={keyDigit}>{k.d}</span>
            {k.sub ? <span style={keySub}>{k.sub}</span> : null}
          </button>
        ))}
      </div>

      {/* Gradient Call pill */}
      <button
        onClick={() => {
          /* skeleton — wire-up later */
        }}
        style={callBtn}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 10px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.30)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.98)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
      >
        <Ionicons name="call" size={18} color="#ffffff" />
        <span style={callBtnLabel}>Call</span>
      </button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 4,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 14,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #050507 0%, #000000 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        } as any)
      : null),
  },
});

const screen: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: '100%',
  height: 44,
  borderRadius: 12,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 14,
  paddingRight: 10,
  flexShrink: 0,
  overflow: 'hidden',
  minWidth: 0,
};

function screenText(empty: boolean): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: empty ? 13 : 18,
    fontWeight: empty ? 400 : 600,
    letterSpacing: empty ? 0 : 0.4,
    color: empty ? 'rgba(255,255,255,0.35)' : '#ffffff',
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

const backspaceBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 6,
  transition: 'color 0.15s ease',
};

const grid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridTemplateRows: 'repeat(4, 1fr)',
  gap: 8,
  minHeight: 0,
};

const keyBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  cursor: 'pointer',
  outline: 'none',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.08s ease',
  padding: 0,
  minHeight: 0,
};

const keyDigit: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1,
  color: '#ffffff',
};

const keySub: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: 0.8,
  color: 'rgba(255,255,255,0.55)',
};

const callBtn: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: '100%',
  height: 44,
  borderRadius: 22,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  backgroundImage: GRADIENT,
  boxShadow:
    '0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flexShrink: 0,
  transition: 'transform 0.12s ease, box-shadow 0.15s ease',
};

const callBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: 0.3,
};
