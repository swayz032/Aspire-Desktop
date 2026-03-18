import React, { useRef, useEffect, useCallback } from 'react';
import { View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

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

interface MagicLoaderProps {
  size?: number;
  particleCount?: number;
  speed?: number;
}

// Aspire hue range: cobalt blue → indigo → violet
const HUE_MIN = 190;
const HUE_MAX = 270;

function MagicLoaderWeb({ size, particleCount, speed }: Required<MagicLoaderProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const tickRef = useRef(0);
  const globalAngleRef = useRef(0);
  const globalRotationRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visibleRef = useRef(true);

  const createParticle = useCallback(
    (centerX: number, centerY: number, tick: number, minSize: number): Particle => ({
      radius: 7,
      x: centerX + Math.cos(tick / 20) * (minSize / 2),
      y: centerY + Math.sin(tick / 20) * (minSize / 2),
      angle: globalRotationRef.current + globalAngleRef.current,
      speed: 0,
      accel: 0.01,
      decay: 0.01,
      life: 1,
    }),
    [],
  );

  const stepParticle = useCallback(
    (particle: Particle, index: number) => {
      particle.speed += particle.accel;
      particle.x += Math.cos(particle.angle) * particle.speed * speed;
      particle.y += Math.sin(particle.angle) * particle.speed * speed;
      particle.angle += Math.PI / 64;
      particle.accel *= 1.01;
      particle.life -= particle.decay;
      if (particle.life <= 0) {
        particlesRef.current.splice(index, 1);
      }
    },
    [speed],
  );

  const drawParticle = useCallback(
    (ctx: CanvasRenderingContext2D, particle: Particle, index: number, tick: number) => {
      const hueSpan = HUE_MAX - HUE_MIN;
      const hue = HUE_MIN + ((tick + particle.life * 120) % hueSpan);
      ctx.fillStyle = ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${particle.life})`;

      ctx.beginPath();
      if (particlesRef.current[index - 1]) {
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particlesRef.current[index - 1].x, particlesRef.current[index - 1].y);
      }
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.001, particle.life * particle.radius), 0, Math.PI * 2);
      ctx.fill();

      const sparkleSize = Math.random() * 1.5;
      const sparkleX = particle.x + (Math.random() - 0.5) * 35 * particle.life;
      const sparkleY = particle.y + (Math.random() - 0.5) * 35 * particle.life;
      ctx.fillRect(Math.floor(sparkleX), Math.floor(sparkleY), sparkleSize, sparkleSize);
    },
    [],
  );

  const animate = useCallback(() => {
    if (!visibleRef.current) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const minSize = size * 0.5;

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle(centerX, centerY, tickRef.current, minSize));
    }

    particlesRef.current.forEach((p, i) => stepParticle(p, i));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach((p, i) => drawParticle(ctx, p, i, tickRef.current));

    globalRotationRef.current += (Math.PI / 6) * speed;
    globalAngleRef.current += (Math.PI / 6) * speed;
    tickRef.current++;

    animationRef.current = requestAnimationFrame(animate);
  }, [size, particleCount, speed, createParticle, stepParticle, drawParticle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'lighter';

    particlesRef.current = [];
    tickRef.current = 0;
    globalAngleRef.current = 0;
    globalRotationRef.current = 0;

    // IntersectionObserver for visibility
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 },
    );
    if (containerRef.current) observer.observe(containerRef.current);

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      observer.disconnect();
    };
  }, [size, animate]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}

function MagicLoaderNative({ size }: { size: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.6,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1.3 - (scale.value - 1) }],
    opacity: 0.3,
  }));

  const base = size * 0.35;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          ring2Style,
          {
            position: 'absolute',
            width: base * 1.8,
            height: base * 1.8,
            borderRadius: base * 0.9,
            borderWidth: 1.5,
            borderColor: 'rgba(96,165,250,0.35)',
          },
        ]}
      />
      <Animated.View
        style={[
          ring1Style,
          {
            width: base,
            height: base,
            borderRadius: base / 2,
            backgroundColor: 'rgba(59,130,246,0.18)',
            borderWidth: 2,
            borderColor: 'rgba(59,130,246,0.7)',
          },
        ]}
      />
    </View>
  );
}

function MagicLoaderInner({ size = 280, particleCount = 3, speed = 1 }: MagicLoaderProps) {
  if (Platform.OS === 'web') {
    return <MagicLoaderWeb size={size} particleCount={particleCount} speed={speed} />;
  }
  return <MagicLoaderNative size={size} />;
}

export default MagicLoader;

export function MagicLoader(props: any) {
  return (
    <PageErrorBoundary pageName="magic-loader">
      <MagicLoaderInner {...props} />
    </PageErrorBoundary>
  );
}
