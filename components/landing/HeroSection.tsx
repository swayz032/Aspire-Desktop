import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CockpitMockup from './CockpitMockup';

const tabs = ['1. Cockpit Command', '2. AI Staff', '3. Governed Execution'];

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setIsTouchDevice(navigator.maxTouchPoints > 0);
  }, []);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 25 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 25 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || isTouchDevice || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      background: '#050508',
      paddingTop: 48,
      paddingBottom: 0,
    }}>
      {/* Atmospheric background layers */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      }}>
        {/* Primary blue glow at bottom */}
        <div style={{
          position: 'absolute', bottom: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '100%', height: '70%',
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 40%, transparent 70%)',
        }} />
        {/* Secondary purple accent */}
        <div style={{
          position: 'absolute', bottom: '10%', left: '20%',
          width: '40%', height: '40%',
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)',
        }} />
        {/* Cyan accent right */}
        <div style={{
          position: 'absolute', bottom: '5%', right: '15%',
          width: '35%', height: '35%',
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(6,182,212,0.05) 0%, transparent 70%)',
        }} />
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 70%)',
        }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 1200, padding: '0 48px' }}>

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 24, padding: '6px 16px',
            marginBottom: 20,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px rgba(59,130,246,0.8)' }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#60A5FA',
            letterSpacing: '0.04em', textTransform: 'uppercase' as const,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}>
            Governed AI Execution
          </span>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{ textAlign: 'center', marginBottom: 16 }}
        >
          <h1 style={{
            fontSize: 'clamp(48px, 6vw, 76px)',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}>
            Think it. Govern it.{' '}
            <span style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Execute it.
            </span>
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.55,
            textAlign: 'center',
            maxWidth: 560,
            margin: '0 0 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        >
          Simple enough to run in hours. Sophisticated enough to scale.
          Aspire gives your business a governed AI executive team — without the overhead.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}
        >
          <a
            href="/login"
            style={{
              fontSize: 15, fontWeight: 600, color: '#ffffff',
              textDecoration: 'none', padding: '13px 28px', borderRadius: 28,
              background: '#3B82F6',
              boxShadow: '0 0 30px rgba(59,130,246,0.45), 0 4px 16px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = '#2563EB';
              el.style.boxShadow = '0 0 50px rgba(59,130,246,0.6), 0 8px 24px rgba(0,0,0,0.4)';
              el.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = '#3B82F6';
              el.style.boxShadow = '0 0 30px rgba(59,130,246,0.45), 0 4px 16px rgba(0,0,0,0.3)';
              el.style.transform = 'translateY(0)';
            }}
          >
            Get Started Free
          </a>
          <a
            href="#features"
            style={{
              fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none', padding: '12px 28px', borderRadius: 28,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              transition: 'all 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = '#ffffff';
              el.style.background = 'rgba(255,255,255,0.08)';
              el.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = 'rgba(255,255,255,0.7)';
              el.style.background = 'rgba(255,255,255,0.04)';
              el.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          >
            Watch Overview →
          </a>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 4,
            gap: 2,
            marginBottom: 20,
          }}
        >
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                fontSize: 13, fontWeight: 600,
                color: activeTab === i ? '#ffffff' : 'rgba(255,255,255,0.45)',
                background: activeTab === i ? 'rgba(59,130,246,0.18)' : 'transparent',
                border: activeTab === i ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}
            >
              {tab}
            </button>
          ))}
        </motion.div>

        {/* Tilting Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{ width: '100%', position: 'relative' }}
        >
          {/* Glow reflection below */}
          <div style={{
            position: 'absolute',
            bottom: -40,
            left: '15%',
            width: '70%',
            height: 80,
            background: 'rgba(59,130,246,0.2)',
            filter: 'blur(40px)',
            borderRadius: '50%',
            zIndex: 0,
          }} />

          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: '1200px', width: '100%', position: 'relative', zIndex: 1 }}
          >
            <motion.div
              style={{
                rotateX: reducedMotion || isTouchDevice ? -4 : rotateX,
                rotateY: reducedMotion || isTouchDevice ? 0 : rotateY,
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center',
              }}
              animate={reducedMotion ? {} : { y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
            >
              <CockpitMockup />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
