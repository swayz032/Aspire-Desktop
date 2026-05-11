import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * DialPadArtwork — black glassy keypad card.
 *
 * The visual concept: ONE continuous red → violet → blue gradient is rendered
 * across the entire pad as an SVG <linearGradient>. Each dial button is a
 * <circle fill="url(#padGradient)"> so it only shows the slice of the gradient
 * at its position — the button in the top-left reads red, the one in the
 * bottom-right reads Aspire blue, the middle button reads violet. The black
 * background of the card is the only thing painted "over" the gradient, so
 * the buttons feel like windows the gradient flows through.
 *
 * Behaviour for the skeleton pass: typing a digit appends it to the screen.
 * No backend wiring, no /call-room navigation, no DTMF — that lands in a
 * later pass.
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

// Pad SVG coordinate system. All numbers are SVG units; the SVG scales to fit
// its container via preserveAspectRatio="xMidYMid meet".
const VB_W = 300;
const VB_H = 320;
const BTN_R = 27;
const CALL_H = 44;
const COLS_X = [60, 150, 240];
const ROWS_Y = [40, 105, 170, 235];

function formatPhone(raw: string): string {
  // Lightly format US-style for the screen; keep raw on overflow.
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
      <div style={screenWrap}>
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
              <Ionicons name="backspace-outline" size={20} color="currentColor" />
            </button>
          ) : null}
        </div>
      </div>

      {/* SVG keypad artwork — one gradient flows across all buttons */}
      <div style={artWrap}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="padGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="30%" stopColor="#DC2626" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="70%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <filter id="btnDepth" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* 12 dial buttons — each shows the gradient at its position */}
          {KEYS.map((k, i) => {
            const cx = COLS_X[i % 3];
            const cy = ROWS_Y[Math.floor(i / 3)];
            return (
              <g
                key={k.d}
                style={{ cursor: 'pointer' }}
                onClick={() => append(k.d)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={BTN_R}
                  fill="url(#padGradient)"
                  filter="url(#btnDepth)"
                />
                {/* subtle inset highlight at top */}
                <ellipse
                  cx={cx}
                  cy={cy - BTN_R / 2}
                  rx={BTN_R * 0.55}
                  ry={BTN_R * 0.18}
                  fill="rgba(255,255,255,0.18)"
                  pointerEvents="none"
                />
                <text
                  x={cx}
                  y={cy + (k.sub ? -2 : 6)}
                  textAnchor="middle"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize="20"
                  fontWeight={600}
                  fill="#ffffff"
                  pointerEvents="none"
                  letterSpacing="0"
                >
                  {k.d}
                </text>
                {k.sub ? (
                  <text
                    x={cx}
                    y={cy + 14}
                    textAnchor="middle"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontSize="9"
                    fontWeight={500}
                    fill="rgba(255,255,255,0.75)"
                    letterSpacing="1"
                    pointerEvents="none"
                  >
                    {k.sub}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Call pill — same gradient, full width */}
          <g style={{ cursor: 'pointer' }} onClick={() => { /* visual only for skeleton */ }}>
            <rect
              x={28}
              y={VB_H - CALL_H - 6}
              width={VB_W - 56}
              height={CALL_H}
              rx={CALL_H / 2}
              fill="url(#padGradient)"
              filter="url(#btnDepth)"
            />
            <rect
              x={36}
              y={VB_H - CALL_H - 1}
              width={VB_W - 72}
              height={10}
              rx={5}
              fill="rgba(255,255,255,0.18)"
              pointerEvents="none"
            />
            <g transform={`translate(${VB_W / 2 - 28}, ${VB_H - CALL_H / 2 - 6 - 9})`}>
              {/* phone glyph */}
              <path
                d="M3.6 1.2c.1-.4.5-.7.9-.6l3 .6c.4.1.7.4.7.8l-.3 2.6c0 .3-.2.6-.5.7l-1.6.6c.8 1.8 2.2 3.2 4 4l.6-1.6c.1-.3.4-.5.7-.5l2.6-.3c.4 0 .7.3.8.7l.6 3c.1.4-.2.8-.6.9-6 1.5-11.5-4-10-10z"
                transform="scale(1.05)"
                fill="#ffffff"
              />
              <text
                x={26}
                y={15}
                fontFamily="Inter, system-ui, sans-serif"
                fontSize="15"
                fontWeight={700}
                fill="#ffffff"
                letterSpacing="0.5"
                pointerEvents="none"
              >
                Call
              </text>
            </g>
          </g>
        </svg>
      </div>
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
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        } as any)
      : null),
  },
});

const screenWrap: React.CSSProperties = {
  width: '100%',
  marginBottom: 12,
};

const screen: React.CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 12,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 12,
};

function screenText(empty: boolean): React.CSSProperties {
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: empty ? 14 : 20,
    fontWeight: empty ? 400 : 600,
    letterSpacing: empty ? 0 : 0.4,
    color: empty ? 'rgba(255,255,255,0.35)' : '#ffffff',
    fontVariantNumeric: 'tabular-nums',
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
  padding: 6,
  borderRadius: 8,
  transition: 'color 0.15s ease',
};

const artWrap: React.CSSProperties = {
  flex: 1,
  width: '100%',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
};
