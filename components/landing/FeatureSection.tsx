import React from 'react';
import { motion } from 'framer-motion';
import { Feature } from './FeaturesData';

interface FeatureSectionProps {
  feature: Feature;
  index: number;
}

const featureIcons: Record<string, React.ReactNode> = {
  canvas: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="4" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="26" y="4" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="4" y="26" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="26" y="26" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  'ai-staff': (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  finance: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M6 34l10-10 8 6 10-12 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  authority: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M24 6l14 6v12c0 9-6 16-14 20C16 40 10 33 10 24V12L24 6z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M17 24l5 5 9-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  frontdesk: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M12 20a12 12 0 1 1 24 0c0 8-6 14-12 20C18 34 12 28 12 20z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  contracts: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="6" width="28" height="36" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="16" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="22" x2="32" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="28" x2="24" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function FeatureVisual({ feature }: { feature: Feature }) {
  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/10',
      background: `linear-gradient(135deg, rgba(14,14,22,0.95) 0%, rgba(18,18,28,0.9) 100%)`,
      border: `1px solid ${feature.accent}33`,
      borderRadius: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 0 60px ${feature.accent}18`,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: '60%', height: '60%',
        background: `radial-gradient(ellipse, ${feature.accentLight} 0%, transparent 70%)`,
        borderRadius: '50%',
      }} />

      {/* Icon */}
      <div style={{
        color: feature.accent,
        opacity: 0.9,
        position: 'relative',
        zIndex: 1,
      }}>
        {featureIcons[feature.id]}
      </div>

      {/* Mock UI elements */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, width: '60%',
        position: 'relative', zIndex: 1,
      }}>
        {[90, 70, 80].map((w, i) => (
          <div key={i} style={{
            height: 6, borderRadius: 3,
            background: i === 0 ? feature.accent : `${feature.accent}33`,
            width: `${w}%`,
            opacity: 1 - i * 0.2,
          }} />
        ))}
      </div>

      {/* Feature label */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        fontSize: 10, fontWeight: 700, color: feature.accent,
        letterSpacing: '0.08em', textTransform: 'uppercase' as const,
        background: `${feature.accentLight}`,
        border: `1px solid ${feature.accent}33`,
        padding: '4px 10px', borderRadius: 6,
      }}>
        {feature.eyebrow}
      </div>
    </div>
  );
}

export default function FeatureSection({ feature, index }: FeatureSectionProps) {
  const isEven = index % 2 === 0;

  return (
    <section style={{
      padding: '80px 80px',
      background: index % 2 === 0 ? '#050508' : '#070710',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 80,
        alignItems: 'center',
      }}>
        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ order: isEven ? 0 : 1 }}
        >
          <FeatureVisual feature={feature} />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ order: isEven ? 1 : 0 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, color: feature.accent,
            letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            {feature.eyebrow}
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 20px', lineHeight: 1.1,
          }}>
            {feature.title}
          </h2>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
            margin: '0 0 16px',
          }}>
            {feature.description1}
          </p>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7,
            margin: '0 0 32px',
          }}>
            {feature.description2}
          </p>
          <a
            href={feature.ctaHref}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 14, fontWeight: 600,
              color: feature.accent,
              textDecoration: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              background: `${feature.accentLight}`,
              border: `1px solid ${feature.accent}33`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = `${feature.accentLight.replace('0.12', '0.2')}`;
              el.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = `${feature.accentLight}`;
              el.style.transform = 'translateX(0)';
            }}
          >
            {feature.cta} →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
