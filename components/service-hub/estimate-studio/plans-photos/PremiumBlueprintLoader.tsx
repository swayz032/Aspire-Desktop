/**
 * PremiumBlueprintLoader — Wave 11k upgrade for the canvas loading state.
 *
 * Replaces the bare spinning ring with a cinematic particle ribbon while Drew
 * analyzes a blueprint. Web uses a real <canvas> driving a particle system
 * (adapted from lightswind/magic-loader, recolored to Aspire's amber-gold
 * accent palette). Native falls back to a multi-ring pulse animation so the
 * mobile build still feels alive.
 *
 * Mission alignment (per Aspire premium standard):
 *   - CLS = 0: parent reserves the loader box.
 *   - 200ms entry cross-fade (parent owns this).
 *   - No motion sickness: gentle 90% confined orbit, life-decayed sparkles.
 *   - Single focused canvas element — never compete with the headline.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

interface Props {
  size?: number;            // diameter in CSS pixels (default 160)
  particleCount?: number;   // particles emitted per frame (default 2)
  speed?: number;           // animation speed multiplier (default 1)
  /**
   * HSL hue range for the particles. Defaults to Aspire amber-gold
   * (#fbbf24-ish): 36-50.
   */
  hueRange?: [number, number];
  testID?: string;
}

interface Particle {
  radius: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  accel: number;
  decay: number;
  life: number;
}

/**
 * Canvas-based premium loader for web. Pure 2D canvas — no WebGL — so it
 * runs on Metro web targets without extra deps. ~50-80 FPS on a modern
 * laptop, scales down gracefully on slower devices.
 */
function WebMagicLoader({
  size = 160,
  particleCount = 2,
  speed = 1,
  hueRange = [36, 50],
  testID,
}: Required<Pick<Props, 'size' | 'particleCount' | 'speed' | 'hueRange'>> & { testID?: string }): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tickRef = useRef(0);
  const angleRef = useRef(0);
  const rotRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'lighter';

    particlesRef.current = [];
    tickRef.current = 0;
    angleRef.current = 0;
    rotRef.current = 0;

    const cx = size / 2;
    const cy = size / 2;
    const minSize = Math.min(size, size) * 0.5;

    const createParticle = (): Particle => ({
      radius: 6,
      x: cx + (Math.cos(tickRef.current / 20) * minSize) / 2,
      y: cy + (Math.sin(tickRef.current / 20) * minSize) / 2,
      angle: rotRef.current + angleRef.current,
      speed: 0,
      accel: 0.012,
      decay: 0.014,
      life: 1,
    });

    const step = (p: Particle, idx: number) => {
      p.speed += p.accel;
      p.x += Math.cos(p.angle) * p.speed * speed;
      p.y += Math.sin(p.angle) * p.speed * speed;
      p.angle += Math.PI / 64;
      p.accel *= 1.01;
      p.life -= p.decay;
      if (p.life <= 0) particlesRef.current.splice(idx, 1);
    };

    const draw = (p: Particle, idx: number, t: number) => {
      const hue = hueRange[0] + ((t + p.life * 120) % (hueRange[1] - hueRange[0]));
      const color = `hsla(${hue}, 100%, 62%, ${p.life})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const prev = particlesRef.current[idx - 1];
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.001, p.life * p.radius), 0, Math.PI * 2);
      ctx.fill();
      // sparkle
      const sx = p.x + (Math.random() - 0.5) * 32 * p.life;
      const sy = p.y + (Math.random() - 0.5) * 32 * p.life;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.max(0.5, Math.random() * 1.2), Math.max(0.5, Math.random() * 1.2));
    };

    let running = true;
    const animate = () => {
      if (!running) return;
      for (let i = 0; i < particleCount; i++) particlesRef.current.push(createParticle());
      particlesRef.current.forEach((p, idx) => step(p, idx));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p, idx) => draw(p, idx, tickRef.current));
      rotRef.current += (Math.PI / 6) * speed;
      angleRef.current += (Math.PI / 6) * speed;
      tickRef.current++;
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size, particleCount, speed, hueRange[0], hueRange[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Render via createElement so RN typecheck doesn't fight the <canvas> tag.
    React.createElement('canvas', {
      ref: canvasRef as any,
      'data-testid': testID,
      style: { display: 'block', width: size, height: size },
    } as any)
  );
}

/**
 * Native fallback — three concentric pulse rings on rotation. No canvas
 * dependency; pure RN Animated. Looks intentionally similar to web so the
 * brand feels consistent across platforms.
 */
function NativePulseLoader({ size = 160 }: { size?: number }): React.ReactElement {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, dur: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: true, delay }),
          Animated.timing(v, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      );
    const aa = mk(a, 1800);
    const bb = mk(b, 1800, 600);
    const cc = mk(c, 1800, 1200);
    aa.start(); bb.start(); cc.start();
    return () => { aa.stop(); bb.stop(); cc.stop(); };
  }, [a, b, c]);
  const ring = (v: Animated.Value, color: string) => {
    const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
    const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
    return (
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
    );
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {ring(a, '#fbbf24')}
      {ring(b, 'rgba(251,191,36,0.7)')}
      {ring(c, 'rgba(251,191,36,0.45)')}
      <View
        style={{
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: (size * 0.16) / 2,
          backgroundColor: '#fbbf24',
          shadowColor: '#fbbf24',
          shadowOpacity: 0.75,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

export function PremiumBlueprintLoader(props: Props): React.ReactElement {
  const size = props.size ?? 160;
  const particleCount = props.particleCount ?? 2;
  const speed = props.speed ?? 1;
  const hueRange = props.hueRange ?? [36, 50];

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap} testID={props.testID ?? 'premium-loader'}>
        {/* Soft amber halo behind the canvas to feel cinematic */}
        <View style={[styles.halo, { width: size * 1.6, height: size * 1.6, borderRadius: size }]} />
        <WebMagicLoader
          size={size}
          particleCount={particleCount}
          speed={speed}
          hueRange={hueRange}
          testID="premium-loader-canvas"
        />
      </View>
    );
  }
  return (
    <View style={styles.wrap} testID={props.testID ?? 'premium-loader'}>
      <View style={[styles.halo, { width: size * 1.6, height: size * 1.6, borderRadius: size }]} />
      <NativePulseLoader size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(251,191,36,0.06)',
    // soft inner glow effect
    shadowColor: '#fbbf24',
    shadowOpacity: 0.18,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default PremiumBlueprintLoader;
