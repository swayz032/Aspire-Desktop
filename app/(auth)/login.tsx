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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signin' | 'signup';

// ─── City coordinates [lat, lon] for ~80 major cities ───────────────────────
const CITIES: [number, number][] = [
  [40.71, -74.01],[51.51, -0.13],[48.85, 2.35],[52.52, 13.40],[55.75, 37.62],
  [39.91, 116.39],[35.68, 139.69],[37.56, 126.98],[1.35, 103.82],[22.28, 114.16],
  [19.08, 72.88],[28.61, 77.21],[12.97, 77.59],[13.07, 80.27],[23.13, 113.27],
  [-23.55, -46.63],[-34.61, -58.38],[-33.87, 151.21],[-37.81, 144.96],
  [6.52, 3.38],[30.06, 31.25],[36.82, 10.17],[-1.29, 36.82],[25.20, 55.27],
  [24.69, 46.72],[41.01, 28.95],[59.91, 10.75],[59.33, 18.07],[55.68, 12.57],
  [60.17, 24.94],[47.50, 19.04],[50.07, 14.44],[52.23, 21.01],[48.15, 17.11],
  [44.80, 20.47],[37.98, 23.73],[41.33, 19.82],[42.00, 21.43],[43.85, 18.36],
  [45.81, 15.98],[46.05, 14.51],[47.37, 8.54],[46.20, 6.15],[48.21, 16.37],
  [53.34, -6.27],[52.37, 4.90],[50.85, 4.35],[43.30, 5.37],[45.76, 4.84],
  [40.42, -3.70],[38.72, -9.14],[41.16, -8.63],[32.65, -16.92],[28.46, -16.26],
  [34.02, -6.84],[36.74, 3.06],[31.63, -8.00],[33.89, 35.50],[33.34, 44.40],
  [35.69, 51.42],[21.49, 39.19],[17.33, 78.44],[6.91, 79.85],[27.47, 89.64],
  [3.15, 101.69],[13.75, 100.50],[21.03, 105.85],[10.82, 106.63],[14.09, 108.22],
  [11.56, 104.92],[16.87, 96.19],[47.91, 106.92],[43.12, 131.90],[56.01, 92.79],
  [51.13, 71.43],[41.30, 69.24],[37.95, 58.38],[38.56, 68.77],[42.87, 74.59],
  [-4.32, 15.32],[9.03, 38.74],[2.05, 45.34],[-26.32, 31.14],[-25.75, 28.19],
  [-29.87, 31.03],[-33.93, 18.42],[-8.84, 13.23],[5.35, -4.01],[12.37, -1.52],
  [5.56, -0.20],[18.54, -72.34],[23.13, -82.38],[19.43, -99.13],[14.09, -87.21],
  [4.71, -74.07],[10.49, -66.88],[-0.23, -78.52],[-12.05, -77.03],[-16.50, -68.15],
  [-33.46, -70.65],[-34.90, -56.19],[47.61, -122.33],[37.77, -122.42],
  [34.05, -118.24],[29.76, -95.37],[41.88, -87.63],[43.65, -79.38],
  [45.51, -73.55],[19.43, -70.69],
];

// ─── Globe Canvas Component ──────────────────────────────────────────────────
function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 560;
    const H = 560;
    const R = 220;
    const TILT = (23 * Math.PI) / 180;

    const toRad = (d: number) => (d * Math.PI) / 180;

    function project(lat: number, lon: number, rotation: number): { x: number; y: number; z: number } {
      const phi = toRad(lat);
      const lam = toRad(lon) + rotation;
      const xr = Math.cos(phi) * Math.cos(lam);
      const yr = Math.sin(phi);
      const zr = Math.cos(phi) * Math.sin(lam);
      // apply axial tilt
      const y2 = yr * Math.cos(TILT) - zr * Math.sin(TILT);
      const z2 = yr * Math.sin(TILT) + zr * Math.cos(TILT);
      return {
        x: W / 2 + xr * R,
        y: H / 2 - y2 * R,
        z: z2,
      };
    }

    // Build grid dots
    const gridDots: { lat: number; lon: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      const lonStep = lat % 10 === 0 ? 5 : 8;
      for (let lon = -180; lon < 180; lon += lonStep) {
        gridDots.push({ lat, lon });
      }
    }

    let t = 0;
    function draw() {
      frameRef.current = requestAnimationFrame(draw);
      t += 0.016;
      angleRef.current += 0.003;
      const rot = angleRef.current;

      ctx!.clearRect(0, 0, W, H);

      // Draw grid dots
      for (const { lat, lon } of gridDots) {
        const { x, y, z } = project(lat, lon, rot);
        if (z >= 0) {
          // visible hemisphere — dark gray/charcoal
          const brightness = 0.35 + z * 0.45;
          const alpha = 0.25 + z * 0.5;
          const gray = Math.floor(70 + brightness * 50);
          ctx!.beginPath();
          ctx!.arc(x, y, 1.1, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${gray},${gray+5},${gray+8},${alpha.toFixed(2)})`;
          ctx!.fill();
        } else {
          // far hemisphere — very faint
          ctx!.beginPath();
          ctx!.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx!.fillStyle = 'rgba(55,60,65,0.12)';
          ctx!.fill();
        }
      }

      // Draw city lights (Aspire blue)
      CITIES.forEach(([lat, lon], i) => {
        const { x, y, z } = project(lat, lon, rot);
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.8 + i * 0.7);
        const size = 2.5 + z * 2;

        if (z >= -0.15) {
          const visibility = Math.max(0, (z + 0.15) / 1.15);
          // outer glow
          const grd = ctx!.createRadialGradient(x, y, 0, x, y, size * 3.5);
          grd.addColorStop(0, `rgba(14,165,233,${(pulse * visibility * 0.55).toFixed(2)})`);
          grd.addColorStop(1, 'rgba(14,165,233,0)');
          ctx!.beginPath();
          ctx!.arc(x, y, size * 3.5, 0, Math.PI * 2);
          ctx!.fillStyle = grd;
          ctx!.fill();

          // bright core
          ctx!.beginPath();
          ctx!.arc(x, y, Math.max(1, size * 0.7), 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(180,230,255,${(pulse * visibility * 0.95).toFixed(2)})`;
          ctx!.fill();
        }
      });
    }

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef as any}
      width={560}
      height={560}
      style={{
        display: 'block',
        animation: 'floatGlobe 6s ease-in-out infinite',
      }}
    />
  );
}

// ─── Web Login Layout ────────────────────────────────────────────────────────
function WebLoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    setTilt({
      x: -(dy / (rect.height / 2)) * 10,
      y: (dx / (rect.width / 2)) * 10,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) { setError(authError.message); return; }
      if (data.session) {
        const suiteId = data.session.user?.user_metadata?.suite_id;
        if (suiteId) {
          const { data: profile } = await supabase
            .from('suite_profiles')
            .select('onboarding_completed_at, owner_name, business_name, industry')
            .eq('suite_id', suiteId)
            .single();
          if (!profile?.onboarding_completed_at || !profile?.owner_name || !profile?.business_name || !profile?.industry) {
            router.replace('/(auth)/onboarding' as any);
            return;
          }
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!inviteCode.trim()) { setError('Invite code is required for private beta access.'); return; }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, inviteCode: inviteCode.trim() }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok || !signupData.success) { setError(signupData.error || 'Signup failed.'); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(signInError.message); return; }
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === 'signin' ? handleSignIn : handleSignUp;

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${focusedField === field ? '#0ea5e9' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 10,
    padding: '14px 16px',
    fontSize: 15,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  });

  return (
    <>
      <style>{`
        @keyframes floatGlobe {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        ::placeholder { color: rgba(255,255,255,0.28) !important; }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        background: '#030712',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      }}>
        {/* ── LEFT PANEL ── */}
        <div style={{
          width: '45%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px 40px',
          position: 'relative',
          zIndex: 2,
        }}>
          {/* Quote */}
          <p style={{
            fontSize: 17,
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.42)',
            letterSpacing: '-0.02em',
            textAlign: 'center',
            marginBottom: 36,
            lineHeight: 1.5,
            maxWidth: 340,
          }}>
            "Creating Freedom One Step at a Time"
          </p>

          {/* 3D Tilt Card */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(24px) saturate(200%)',
              WebkitBackdropFilter: 'blur(24px) saturate(200%)',
              border: '1px solid rgba(14,165,233,0.22)',
              borderRadius: 24,
              boxShadow: '0 0 80px rgba(14,165,233,0.09), 0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
              padding: '44px 40px',
              maxWidth: 420,
              width: '100%',
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`,
              transition: 'transform 0.15s ease-out',
              cursor: 'default',
            }}
          >
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <img
                src="/aspire-logo-full.png"
                alt="Aspire"
                style={{ height: 48, objectFit: 'contain' }}
              />
              <p style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 10,
                letterSpacing: '0.01em',
              }}>
                Governed AI execution for your business
              </p>
            </div>

            {/* Tab Selector */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: 28,
              position: 'relative',
            }}>
              {(['signin', 'signup'] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    padding: '10px 0 12px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: mode === m ? '#fff' : 'rgba(255,255,255,0.38)',
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: mode === 'signin' ? '0%' : '50%',
                width: '50%',
                height: 2,
                background: '#0ea5e9',
                transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                borderRadius: 2,
              }} />
            </div>

            {/* Error / Success */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#F87171',
              }}>
                {error}
              </div>
            )}
            {successMessage && (
              <div style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.28)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: '#4ADE80',
              }}>
                {successMessage}
              </div>
            )}

            {/* Invite Code (signup only) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                  Invite Code
                </label>
                <input
                  type="text"
                  placeholder="Enter your private beta invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onFocus={() => setFocusedField('invite')}
                  onBlur={() => setFocusedField(null)}
                  disabled={loading}
                  style={{ ...inputStyle('invite'), marginBottom: 14 }}
                />
              </div>
            )}

            {/* Email */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              disabled={loading}
              style={{ ...inputStyle('email'), marginBottom: 14 }}
            />

            {/* Password */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              onKeyDown={(e) => e.key === 'Enter' && mode === 'signin' && handleSubmit()}
              disabled={loading}
              style={{ ...inputStyle('password'), marginBottom: 14 }}
            />

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                  style={{ ...inputStyle('confirm'), marginBottom: 14 }}
                />
              </>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? 'rgba(14,165,233,0.55)' : '#0ea5e9',
                border: 'none',
                borderRadius: 10,
                padding: '15px 0',
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s, transform 0.1s',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#38bdf8'; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#0ea5e9'; }}
            >
              {loading
                ? <span style={{ opacity: 0.8 }}>Please wait…</span>
                : mode === 'signin' ? 'Sign In' : 'Create Account'
              }
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          width: '55%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(14,165,233,0.09) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Globe */}
          <GlobeCanvas />

          {/* Footer */}
          <p style={{
            position: 'absolute',
            bottom: 24,
            fontSize: 12,
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.04em',
          }}>
            Aspire — Private Beta
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Native (Mobile) Fallback ────────────────────────────────────────────────
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
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    Animated.spring(slideAnim, {
      toValue: newMode === 'signin' ? 0 : 1,
      useNativeDriver: false,
      tension: 300,
      friction: 30,
    }).start();
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      if (data.session) {
        const suiteId = data.session.user?.user_metadata?.suite_id;
        if (suiteId) {
          const { data: profile } = await supabase
            .from('suite_profiles')
            .select('onboarding_completed_at, owner_name, business_name, industry')
            .eq('suite_id', suiteId)
            .single();
          if (!profile?.onboarding_completed_at || !profile?.owner_name || !profile?.business_name || !profile?.industry) {
            router.replace('/(auth)/onboarding' as any);
            return;
          }
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!inviteCode.trim()) { setError('Invite code is required for private beta access.'); return; }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, inviteCode: inviteCode.trim() }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok || !signupData.success) { setError(signupData.error || 'Signup failed.'); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(signInError.message); return; }
      router.replace('/(auth)/onboarding' as any);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === 'signin' ? handleSignIn : handleSignUp;
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
          <TextInput style={nStyles.input} placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'} placeholderTextColor="#555" secureTextEntry value={password} onChangeText={setPassword} editable={!loading} onSubmitEditing={mode === 'signin' ? handleSubmit : undefined} />
          {mode === 'signup' && (
            <>
              <Text style={nStyles.label}>Confirm Password</Text>
              <TextInput style={nStyles.input} placeholder="Re-enter your password" placeholderTextColor="#555" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} editable={!loading} onSubmitEditing={handleSubmit} />
            </>
          )}
          <TouchableOpacity style={[nStyles.actionButton, loading && nStyles.actionButtonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
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

// ─── Native Styles ───────────────────────────────────────────────────────────
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
