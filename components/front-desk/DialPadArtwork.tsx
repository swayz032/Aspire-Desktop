import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playDTMFTone, resumeAudioContextFromGesture } from '@/app/session/calls';
import { callBack } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import { useTenant } from '@/providers/TenantProvider';

/**
 * DialPadArtwork — black glassy keypad card.
 *
 * - Number screen is a real <input type="tel"> so the user can type from
 *   their keyboard, paste, or use system autofill. As they type we
 *   sanitize to {digits, *, #, +} and re-format for display.
 * - DTMF dual-tones play on each digit (both clicks AND keyboard).
 * - Call button enables only when the number is in a callable shape
 *   (10 US digits, 11 with leading 1, or +intl with 8+ digits).
 * - Press Enter while focused on the screen to trigger Call.
 *
 * Skeleton scope — backend wiring (token mint + /call-room) lands later.
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

const MAX_LEN = 18;
const SANITIZE = /[^\d*#+]/g;

/** Format raw typed string for the display field. */
function formatPhone(raw: string): string {
  // Pass through DTMF-only strings (* or # present) unmodified.
  if (/[*#]/.test(raw)) return raw;

  // International: keep leading + and digits, group lightly.
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length === 0) return '+';
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, digits.length - 3)} ${digits.slice(-3)}`;
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}`;
  }

  // US-style.
  const d = raw.replace(/\D/g, '');
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  // 11 digits with leading 1 = US country-code
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return d;
}

function isCallable(raw: string): boolean {
  // DTMF-only strings (caller using * # for tones) — not callable.
  if (/[*#]/.test(raw)) return false;
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }
  const d = raw.replace(/\D/g, '');
  return d.length === 10 || (d.length === 11 && d.startsWith('1'));
}

export function DialPadArtwork() {
  const [typed, setTyped] = useState('');
  const display = useMemo(() => formatPhone(typed), [typed]);
  const callable = useMemo(() => isCallable(typed), [typed]);
  const audioPrimed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [runCall, callPending] = useAction('Call back');
  const { tenant } = useTenant();
  const officeId = tenant?.officeId;

  const primeAudio = useCallback(() => {
    if (audioPrimed.current) return;
    audioPrimed.current = true;
    void resumeAudioContextFromGesture();
  }, []);

  const appendKey = useCallback(
    (ch: string) => {
      setTyped((prev) => (prev + ch).slice(0, MAX_LEN));
      primeAudio();
      playDTMFTone(ch);
    },
    [primeAudio],
  );

  const backspace = () => setTyped((prev) => prev.slice(0, -1));

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(SANITIZE, '').slice(0, MAX_LEN);
    setTyped(cleaned);
    // Reformat shifts the visible text — pin cursor to the end so users
    // typing fast aren't trapped mid-string.
    requestAnimationFrame(() => {
      const inp = inputRef.current;
      if (inp) {
        const len = inp.value.length;
        try {
          inp.setSelectionRange(len, len);
        } catch {}
      }
    });
  }, []);

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const k = e.key;
      if (k === 'Enter') {
        e.preventDefault();
        if (callable && !callPending) {
          void runCall(() => callBack(typed, { officeId }));
        }
        return;
      }
      // Play DTMF for digit / * / # keystrokes
      if (/^[0-9*#]$/.test(k)) {
        primeAudio();
        playDTMFTone(k);
      } else if (k === '+' && typed.length === 0) {
        // intl prefix; no tone
      }
    },
    [callable, primeAudio, typed.length],
  );

  if (Platform.OS !== 'web') {
    return <View style={styles.card} />;
  }

  return (
    <View style={styles.card}>
      {/* Glassy number screen — real <input> so the keyboard works */}
      <div style={screen}>
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={display}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          placeholder="Enter number"
          aria-label="Phone number"
          style={screenInput(display.length === 0)}
        />
        {typed.length > 0 ? (
          <button
            aria-label="Backspace"
            onClick={backspace}
            style={backspaceBtn}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')
            }
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
            onClick={() => appendKey(k.d)}
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
          if (callable && !callPending) {
            void runCall(() => callBack(typed, { officeId }));
          }
        }}
        disabled={!callable || callPending}
        style={{
          ...callBtn,
          cursor: callable && !callPending ? 'pointer' : 'not-allowed',
          opacity: callPending ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!callable) return;
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
          if (!callable) return;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(1px) scale(0.98)';
        }}
        onMouseUp={(e) => {
          if (!callable) return;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
      >
        {callPending ? (
          <Ionicons name="reload-outline" size={18} color="#ffffff" />
        ) : (
          <Ionicons name="call" size={18} color="#ffffff" />
        )}
        <span style={callBtnLabel}>{callPending ? 'Calling…' : 'Call'}</span>
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

function screenInput(empty: boolean): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: empty ? 13 : 18,
    fontWeight: empty ? 400 : 600,
    letterSpacing: empty ? 0 : 0.4,
    color: '#ffffff',
    fontVariantNumeric: 'tabular-nums',
    padding: 0,
    height: '100%',
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
  boxShadow: '0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flexShrink: 0,
  transition: 'transform 0.12s ease, box-shadow 0.15s ease, opacity 0.15s ease, filter 0.15s ease',
};

const callBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: 0.3,
};
