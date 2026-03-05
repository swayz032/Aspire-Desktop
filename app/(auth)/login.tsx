import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';

// ─── Console definitions ─────────────────────────────────────────────────────
const CONSOLES = [
  {
    id: 'admin',
    title: 'Admin Console',
    tagline: 'Governed AI execution platform',
    accent: '#0ea5e9',
    accentRgb: '14,165,233',
    globeInitAngle: 1.1,
    globeLandColor: '68,76,84',
    mode: 'auth' as const,
  },
  {
    id: 'team',
    title: 'Team Console',
    tagline: 'Collaborate across your organization',
    accent: '#8b5cf6',
    accentRgb: '139,92,246',
    globeInitAngle: 3.2,
    globeLandColor: '72,65,90',
    mode: 'auth' as const,
  },
  {
    id: 'ecommerce',
    title: 'Ecommerce Console',
    tagline: 'Commerce intelligence — arriving soon',
    accent: '#10b981',
    accentRgb: '16,185,129',
    globeInitAngle: -0.5,
    globeLandColor: '55,80,68',
    mode: 'waitlist' as const,
  },
] as const;

// ─── City lights [lat, lon] ──────────────────────────────────────────────────
const CITIES: [number, number][] = [
  [40.71,-74.01],[51.51,-0.13],[48.85,2.35],[52.52,13.40],[55.75,37.62],
  [39.91,116.39],[35.68,139.69],[37.56,126.98],[1.35,103.82],[22.28,114.16],
  [19.08,72.88],[28.61,77.21],[12.97,77.59],[13.07,80.27],[23.13,113.27],
  [-23.55,-46.63],[-34.61,-58.38],[-33.87,151.21],[-37.81,144.96],
  [6.52,3.38],[30.06,31.25],[36.82,10.17],[-1.29,36.82],[25.20,55.27],
  [24.69,46.72],[41.01,28.95],[59.91,10.75],[59.33,18.07],[55.68,12.57],
  [60.17,24.94],[47.50,19.04],[50.07,14.44],[52.23,21.01],[48.15,17.11],
  [44.80,20.47],[37.98,23.73],[41.33,19.82],[45.81,15.98],[46.05,14.51],
  [47.37,8.54],[46.20,6.15],[48.21,16.37],[53.34,-6.27],[52.37,4.90],
  [50.85,4.35],[43.30,5.37],[45.76,4.84],[40.42,-3.70],[38.72,-9.14],
  [41.16,-8.63],[34.02,-6.84],[36.74,3.06],[33.89,35.50],[33.34,44.40],
  [35.69,51.42],[21.49,39.19],[3.15,101.69],[13.75,100.50],[21.03,105.85],
  [10.82,106.63],[11.56,104.92],[16.87,96.19],[47.91,106.92],
  [-4.32,15.32],[9.03,38.74],[2.05,45.34],[-26.32,31.14],[-33.93,18.42],
  [5.35,-4.01],[12.37,-1.52],[5.56,-0.20],[18.54,-72.34],[23.13,-82.38],
  [19.43,-99.13],[14.09,-87.21],[4.71,-74.07],[10.49,-66.88],
  [-0.23,-78.52],[-12.05,-77.03],[-16.50,-68.15],[-33.46,-70.65],[-34.90,-56.19],
  [47.61,-122.33],[37.77,-122.42],[34.05,-118.24],[29.76,-95.37],
  [41.88,-87.63],[43.65,-79.38],[45.51,-73.55],
];

// ─── Shared land points cache ────────────────────────────────────────────────
let _landCache: [number, number][] | null = null;
let _landPromise: Promise<[number, number][]> | null = null;

function getLandPoints(): Promise<[number, number][]> {
  if (_landCache) return Promise.resolve(_landCache);
  if (_landPromise) return _landPromise;
  _landPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
    .then(r => r.json())
    .then((topo: any) => {
      const { scale, translate } = topo.transform;
      const pts: [number, number][] = [];
      for (const arc of topo.arcs) {
        let qx = 0, qy = 0, prevLon = 0, prevLat = 0;
        for (let j = 0; j < arc.length; j++) {
          qx += arc[j][0];
          qy += arc[j][1];
          const lon = qx * scale[0] + translate[0];
          const lat = qy * scale[1] + translate[1];
          pts.push([lon, lat]);
          if (j > 0) pts.push([(lon + prevLon) / 2, (lat + prevLat) / 2]);
          prevLon = lon;
          prevLat = lat;
        }
      }
      _landCache = pts;
      return pts;
    })
    .catch(() => {
      const fallback: [number, number][] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        const n = Math.floor(Math.cos((lat * Math.PI) / 180) * 36);
        for (let i = 0; i < n; i++) fallback.push([(i / n) * 360 - 180, lat]);
      }
      _landCache = fallback;
      return fallback;
    });
  return _landPromise;
}

// ─── useScramble ─────────────────────────────────────────────────────────────
function useScramble(target: string, active: boolean): string {
  const [text, setText] = useState(target);
  const timerRef = useRef<any>(null);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!active) { setText(target); return; }
    let frame = 0;
    const total = target.length * 3 + 8;
    timerRef.current = setInterval(() => {
      frame++;
      setText(
        target.split('').map((ch, i) => {
          if (ch === ' ') return ' ';
          if (frame >= i * 3 + 4) return ch;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('')
      );
      if (frame > total) { clearInterval(timerRef.current); setText(target); }
    }, 35);
    return () => clearInterval(timerRef.current);
  }, [active, target]);

  return text;
}

// ─── GlobeCanvas ─────────────────────────────────────────────────────────────
interface GlobeProps {
  accent: string;
  accentRgb: string;
  landColor: string;
  initAngle: number;
}

function GlobeCanvas({ accent, accentRgb, landColor, initAngle }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(initAngle);
  const tRef = useRef(0);
  const ptsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    angleRef.current = initAngle;
    getLandPoints().then(pts => { ptsRef.current = pts; });
  }, [initAngle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 520, H = 520, R = 215;
    const cx = W / 2, cy = H / 2;
    const TILT = (20 * Math.PI) / 180;

    const project = (lat: number, lon: number, rot: number) => {
      const phi = (lat * Math.PI) / 180;
      const lam = (lon * Math.PI) / 180 + rot;
      const x3 = Math.cos(phi) * Math.cos(lam);
      const y3 = Math.sin(phi);
      const z3 = Math.cos(phi) * Math.sin(lam);
      const y2 = y3 * Math.cos(TILT) - z3 * Math.sin(TILT);
      const z2 = y3 * Math.sin(TILT) + z3 * Math.cos(TILT);
      return { sx: cx + x3 * R, sy: cy - y2 * R, d: z2 };
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      angleRef.current += 0.0022;
      tRef.current += 0.016;
      const rot = angleRef.current;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);

      const pts = ptsRef.current;
      for (let i = 0; i < pts.length; i++) {
        const { sx, sy, d } = project(pts[i][1], pts[i][0], rot);
        if (d >= 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.35, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${landColor},${(0.3 + d * 0.6).toFixed(2)})`;
          ctx.fill();
        } else if (d > -0.25) {
          ctx.beginPath();
          ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${landColor},0.06)`;
          ctx.fill();
        }
      }

      for (let i = 0; i < CITIES.length; i++) {
        const { sx, sy, d } = project(CITIES[i][0], CITIES[i][1], rot);
        if (d >= -0.1) {
          const vis = Math.max(0, (d + 0.1) / 1.1);
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 0.7);
          const sz = 2.5 + d * 2;
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sz * 3.5);
          grd.addColorStop(0, `rgba(${accentRgb},${(pulse * vis * 0.6).toFixed(2)})`);
          grd.addColorStop(1, `rgba(${accentRgb},0)`);
          ctx.beginPath();
          ctx.arc(sx, sy, sz * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, sz * 0.65), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210,238,255,${(pulse * vis * 0.92).toFixed(2)})`;
          ctx.fill();
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [accentRgb, landColor]);

  return (
    <canvas
      ref={canvasRef as any}
      width={520}
      height={520}
      style={{ display: 'block', animation: 'floatGlobe 6s ease-in-out infinite' } as React.CSSProperties}
    />
  );
}

// ─── ConsoleCard ─────────────────────────────────────────────────────────────
interface CardProps {
  consoleDef: typeof CONSOLES[number];
  index: number;
  activeIndex: number;
  onSetActive: (i: number) => void;
}

function ConsoleCard({ consoleDef, index, activeIndex, onSetActive }: CardProps) {
  const router = useRouter();
  const isActive = index === activeIndex;
  const offset = index - activeIndex;

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const title = useScramble(consoleDef.title, isActive);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTilt({
      x: -((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 3.5,
      y: ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 5,
    });
  }, [isActive]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const switchMode = (m: AuthMode) => { setMode(m); setError(null); setSuccessMsg(null); };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password.'); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: ae } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (ae) { setError(ae.message); return; }
      if (data.session) {
        const suiteId = data.session.user?.user_metadata?.suite_id;
        if (suiteId) {
          const { data: profile } = await supabase
            .from('suite_profiles')
            .select('onboarding_completed_at, owner_name, business_name, industry')
            .eq('suite_id', suiteId).single();
          if (!profile?.onboarding_completed_at || !profile?.owner_name || !profile?.business_name || !profile?.industry) {
            router.replace('/(auth)/onboarding' as any); return;
          }
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) { setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!inviteCode.trim()) { setError('Invite code is required for private beta access.'); return; }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, inviteCode: inviteCode.trim() }),
      });
      const rd = await res.json();
      if (!res.ok || !rd.success) { setError(rd.error || 'Signup failed.'); return; }
      const { error: sie } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (sie) { setError(sie.message); return; }
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) { setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleWaitlist = () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setSuccessMsg("You're on the list! We'll be in touch soon.");
    setEmail('');
  };

  const inp = (field: string): React.CSSProperties => ({
    width: '100%',
    background: 'rgba(255,255,255,0.07)',
    border: `1px solid ${focused === field ? consoleDef.accent : 'rgba(255,255,255,0.11)'}`,
    borderRadius: 10,
    padding: '13px 15px',
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    marginBottom: 14,
  });

  const lbl: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.42)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 6,
    fontFamily: 'inherit',
  };

  const tx = offset * 1100;
  const scale = isActive ? 1 : 0.87;
  const opacity = isActive ? 1 : Math.abs(offset) <= 1 ? 0.28 : 0;

  return (
    <div
      ref={cardRef as any}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => !isActive && Math.abs(offset) === 1 && onSetActive(index)}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `perspective(1400px) translateX(calc(-50% + ${tx}px)) translateY(-50%) scale(${scale}) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.58s cubic-bezier(0.34,1.12,0.64,1), opacity 0.4s ease',
        opacity,
        zIndex: isActive ? 10 : 1,
        width: 'clamp(820px, 86vw, 1040px)',
        height: 'clamp(520px, 76vh, 630px)',
        display: 'flex',
        flexDirection: 'row',
        borderRadius: 22,
        background: 'rgba(8,12,22,0.94)',
        backdropFilter: 'blur(52px) saturate(180%)',
        WebkitBackdropFilter: 'blur(52px) saturate(180%)',
        border: `1px solid rgba(${consoleDef.accentRgb},0.2)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.035), 0 52px 150px rgba(0,0,0,0.85), 0 0 90px rgba(${consoleDef.accentRgb},0.09), inset 0 1px 0 rgba(255,255,255,0.055)`,
        cursor: isActive ? 'default' : 'pointer',
        pointerEvents: Math.abs(offset) <= 1 ? 'auto' : 'none',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
      } as React.CSSProperties}
    >
      {/* ── LEFT: Form ── */}
      <div style={{
        width: '42%',
        padding: '52px 44px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Accent bar + console title */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ width: 28, height: 2, background: consoleDef.accent, borderRadius: 2, marginBottom: 14, opacity: 0.85 }} />
          <h1 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.04em',
            margin: '0 0 6px 0',
            lineHeight: 1.1,
            fontFamily: 'inherit',
          }}>
            {title}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.36)', margin: 0, letterSpacing: '0.01em', fontFamily: 'inherit' }}>
            {consoleDef.tagline}
          </p>
        </div>

        {/* ── WAITLIST (Ecommerce) ── */}
        {consoleDef.mode === 'waitlist' ? (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: `rgba(${consoleDef.accentRgb},0.1)`,
              border: `1px solid rgba(${consoleDef.accentRgb},0.26)`,
              borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 700,
              color: consoleDef.accent, letterSpacing: '0.09em', marginBottom: 26,
              width: 'fit-content', fontFamily: 'inherit',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: consoleDef.accent, display: 'inline-block', opacity: 0.9 }} />
              COMING SOON
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.26)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#F87171', fontFamily: 'inherit' }}>{error}</div>}
            {successMsg && <div style={{ background: `rgba(${consoleDef.accentRgb},0.1)`, border: `1px solid rgba(${consoleDef.accentRgb},0.26)`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: consoleDef.accent, fontFamily: 'inherit' }}>{successMsg}</div>}
            <label style={lbl}>Email Address</label>
            <input
              type="email" placeholder="your@email.com" value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              style={inp('email')}
            />
            <button
              onClick={handleWaitlist}
              style={{
                width: '100%', background: consoleDef.accent, borderRadius: 10,
                padding: '14px 0', fontSize: 14, fontWeight: 700, color: '#fff',
                cursor: 'pointer', border: 'none', marginTop: 2, fontFamily: 'inherit',
                letterSpacing: '0.01em', transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.opacity = '0.84'; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.opacity = '1'; }}
            >
              Join the Waitlist
            </button>
          </>
        ) : (
          <>
            {/* ── AUTH (Admin + Team) ── */}
            <div style={{ display: 'flex', flexDirection: 'row', borderBottom: '1px solid rgba(255,255,255,0.09)', marginBottom: 24, position: 'relative' }}>
              {(['signin', 'signup'] as AuthMode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, background: 'none', border: 'none', padding: '9px 0 11px',
                  fontSize: 13, fontWeight: 600, color: mode === m ? '#fff' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', transition: 'color 0.2s', fontFamily: 'inherit',
                }}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
              <div style={{
                position: 'absolute', bottom: 0, left: mode === 'signin' ? '0%' : '50%',
                width: '50%', height: 2, background: consoleDef.accent,
                transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)', borderRadius: 2,
              }} />
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.26)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#F87171', fontFamily: 'inherit' }}>{error}</div>}
            {successMsg && <div style={{ background: `rgba(${consoleDef.accentRgb},0.1)`, border: `1px solid rgba(${consoleDef.accentRgb},0.26)`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: consoleDef.accent, fontFamily: 'inherit' }}>{successMsg}</div>}

            {mode === 'signup' && (
              <>
                <label style={lbl}>Invite Code</label>
                <input type="text" placeholder="Private beta invite code" value={inviteCode}
                  onChange={(e: any) => setInviteCode(e.target.value)}
                  onFocus={() => setFocused('invite')} onBlur={() => setFocused(null)}
                  disabled={loading} style={inp('invite')} />
              </>
            )}

            <label style={lbl}>Email</label>
            <input type="email" placeholder="you@company.com" value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              disabled={loading} style={inp('email')} />

            <label style={lbl}>Password</label>
            <input type="password" placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'}
              value={password} onChange={(e: any) => setPassword(e.target.value)}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
              onKeyDown={(e: any) => e.key === 'Enter' && mode === 'signin' && handleSignIn()}
              disabled={loading} style={inp('password')} />

            {mode === 'signup' && (
              <>
                <label style={lbl}>Confirm Password</label>
                <input type="password" placeholder="Re-enter your password"
                  value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                  onKeyDown={(e: any) => e.key === 'Enter' && handleSignUp()}
                  disabled={loading} style={inp('confirm')} />
              </>
            )}

            <button
              onClick={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? `rgba(${consoleDef.accentRgb},0.48)` : consoleDef.accent,
                border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 14,
                fontWeight: 700, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, transition: 'opacity 0.2s, background 0.2s', fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e: any) => { if (!loading) e.currentTarget.style.opacity = '0.84'; }}
              onMouseLeave={(e: any) => { if (!loading) e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </>
        )}
      </div>

      {/* ── RIGHT: Globe ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: '1px solid rgba(255,255,255,0.055)',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 80% at 55% 55%, rgba(${consoleDef.accentRgb},0.08) 0%, transparent 68%)`,
        }} />

        {/* Manifesto */}
        <div style={{ position: 'absolute', top: 30, left: 28, zIndex: 10, maxWidth: 240, pointerEvents: 'none' }}>
          <span style={{
            display: 'block', fontSize: 46, lineHeight: 1, marginBottom: -2,
            color: consoleDef.accent, opacity: 0.88,
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}>❝</span>
          <span style={{
            display: 'block', fontSize: 20, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.035em', lineHeight: 1.15, fontFamily: 'inherit',
          }}>Creating Freedom</span>
          <span style={{
            display: 'block', fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.65)',
            letterSpacing: '-0.01em', lineHeight: 1.35, marginTop: 5, fontFamily: 'inherit',
          }}>One Step at a Time.</span>
          <div style={{ width: 34, height: 2, background: consoleDef.accent, borderRadius: 2, marginTop: 14, opacity: 0.6 }} />
        </div>

        {/* Globe */}
        <GlobeCanvas
          accent={consoleDef.accent}
          accentRgb={consoleDef.accentRgb}
          landColor={consoleDef.globeLandColor}
          initAngle={consoleDef.globeInitAngle}
        />
      </div>
    </div>
  );
}

// ─── WebLoginScreen ──────────────────────────────────────────────────────────
function WebLoginScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CONSOLES[activeIndex];

  return (
    <>
      <style>{`
        @keyframes floatGlobe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-13px); }
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(20,26,38,1) inset !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        ::placeholder { color: rgba(255,255,255,0.24) !important; }
      `}</style>

      <div style={{
        width: '100vw', height: '100vh', background: '#030712', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
      }}>
        {/* HEADER */}
        <div style={{
          height: 66, padding: '0 44px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(3,7,18,0.96)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)', flexShrink: 0, zIndex: 100, position: 'relative',
        }}>
          <img src="/aspire-logo-full.png" alt="Aspire" style={{ height: 30, objectFit: 'contain' }} />
        </div>

        {/* CAROUSEL STAGE */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {CONSOLES.map((c, i) => (
            <ConsoleCard key={c.id} consoleDef={c} index={i} activeIndex={activeIndex} onSetActive={setActiveIndex} />
          ))}

          {/* Left arrow */}
          {activeIndex > 0 && (
            <button
              onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
              style={{
                position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', zIndex: 50,
                width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.72)',
                fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'background 0.2s', lineHeight: 1,
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            >
              ‹
            </button>
          )}

          {/* Right arrow */}
          {activeIndex < CONSOLES.length - 1 && (
            <button
              onClick={() => setActiveIndex(i => Math.min(CONSOLES.length - 1, i + 1))}
              style={{
                position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', zIndex: 50,
                width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.72)',
                fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'background 0.2s', lineHeight: 1,
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            >
              ›
            </button>
          )}

          {/* Nav pill tiles */}
          <div style={{
            position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 10, zIndex: 50,
          }}>
            {CONSOLES.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActiveIndex(i)}
                style={{
                  padding: i === activeIndex ? '8px 22px' : '8px 16px',
                  borderRadius: 20,
                  background: i === activeIndex ? `rgba(${c.accentRgb},0.14)` : 'rgba(255,255,255,0.04)',
                  border: i === activeIndex ? `1px solid rgba(${c.accentRgb},0.4)` : '1px solid rgba(255,255,255,0.09)',
                  boxShadow: i === activeIndex ? `0 0 20px rgba(${c.accentRgb},0.18)` : 'none',
                  color: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.38)',
                  fontSize: 12, fontWeight: i === activeIndex ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.32s cubic-bezier(0.34,1.12,0.64,1)',
                  fontFamily: 'inherit', letterSpacing: '0.01em', whiteSpace: 'nowrap',
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 18, right: 28,
          fontSize: 11, color: 'rgba(255,255,255,0.16)', letterSpacing: '0.04em',
          zIndex: 5, fontFamily: 'inherit', pointerEvents: 'none',
        }}>
          Aspire — Private Beta
        </div>
      </div>
    </>
  );
}

// ─── Native Fallback (unchanged) ─────────────────────────────────────────────
function NativeLoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode); setError(null); setSuccessMessage(null);
    Animated.spring(slideAnim, { toValue: newMode === 'signin' ? 0 : 1, useNativeDriver: false, tension: 300, friction: 30 }).start();
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password.'); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      if (data.session) {
        const suiteId = data.session.user?.user_metadata?.suite_id;
        if (suiteId) {
          const { data: profile } = await supabase.from('suite_profiles')
            .select('onboarding_completed_at, owner_name, business_name, industry')
            .eq('suite_id', suiteId).single();
          if (!profile?.onboarding_completed_at || !profile?.owner_name || !profile?.business_name || !profile?.industry) {
            router.replace('/(auth)/onboarding' as any); return;
          }
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) { setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!inviteCode.trim()) { setError('Invite code is required for private beta access.'); return; }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, inviteCode: inviteCode.trim() }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok || !signupData.success) { setError(signupData.error || 'Signup failed.'); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(signInError.message); return; }
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) { setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const tabUnderlineLeft = slideAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <KeyboardAvoidingView style={nStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={nStyles.inner}>
        <View style={nStyles.logoSection}>
          <View style={nStyles.logoCircle}><Text style={nStyles.logoText}>A</Text></View>
          <Text style={nStyles.brandName}>Aspire</Text>
          <Text style={nStyles.tagline}>Governed AI execution for your business</Text>
        </View>
        <View style={nStyles.tabContainer}>
          <TouchableOpacity style={nStyles.tab} onPress={() => switchMode('signin')} activeOpacity={0.7}>
            <Text style={[nStyles.tabText, mode === 'signin' && nStyles.tabTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={nStyles.tab} onPress={() => switchMode('signup')} activeOpacity={0.7}>
            <Text style={[nStyles.tabText, mode === 'signup' && nStyles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
          <Animated.View style={[nStyles.tabUnderline, { left: tabUnderlineLeft }]} />
        </View>
        <View style={nStyles.formSection}>
          {error && <View style={nStyles.errorBox}><Text style={nStyles.errorText}>{error}</Text></View>}
          {successMessage && <View style={nStyles.successBox}><Text style={nStyles.successText}>{successMessage}</Text></View>}
          {mode === 'signup' && (
            <>
              <Text style={nStyles.label}>Invite Code</Text>
              <TextInput style={nStyles.input} placeholder="Enter your private beta invite code" placeholderTextColor="#555" autoCapitalize="none" autoCorrect={false} value={inviteCode} onChangeText={setInviteCode} editable={!loading} />
            </>
          )}
          <Text style={nStyles.label}>Email</Text>
          <TextInput style={nStyles.input} placeholder="you@company.com" placeholderTextColor="#555" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!loading} />
          <Text style={nStyles.label}>Password</Text>
          <TextInput style={nStyles.input} placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'} placeholderTextColor="#555" secureTextEntry value={password} onChangeText={setPassword} editable={!loading} onSubmitEditing={mode === 'signin' ? handleSignIn : undefined} />
          {mode === 'signup' && (
            <>
              <Text style={nStyles.label}>Confirm Password</Text>
              <TextInput style={nStyles.input} placeholder="Re-enter your password" placeholderTextColor="#555" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} editable={!loading} onSubmitEditing={handleSignUp} />
            </>
          )}
          <TouchableOpacity style={[nStyles.actionButton, loading && nStyles.actionButtonDisabled]} onPress={mode === 'signin' ? handleSignIn : handleSignUp} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={nStyles.actionButtonText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
          </TouchableOpacity>
        </View>
        <Text style={nStyles.footer}>Aspire — Private Beta</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  if (Platform.OS === 'web') return <WebLoginScreen />;
  return <NativeLoginScreen />;
}

// ─── Native Styles ────────────────────────────────────────────────────────────
const nStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, maxWidth: 420, alignSelf: 'center', width: '100%' },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#00BCD4', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#00BCD4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  logoText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  brandName: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  tagline: { fontSize: 14, color: '#888', marginTop: 8 },
  tabContainer: { flexDirection: 'row', width: '100%', marginBottom: 24, position: 'relative', borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  tabUnderline: { position: 'absolute', bottom: 0, width: '50%', height: 2, backgroundColor: '#00BCD4' },
  formSection: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', color: '#aaa', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#fff' },
  actionButton: { backgroundColor: '#00BCD4', borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 12 },
  errorText: { color: '#F87171', fontSize: 14 },
  successBox: { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)', borderRadius: 8, padding: 12 },
  successText: { color: '#4ADE80', fontSize: 14 },
  footer: { color: '#555', fontSize: 12, marginTop: 48 },
});
