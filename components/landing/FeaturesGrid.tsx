import React from 'react';
import { motion } from 'framer-motion';
import { features } from './FeaturesData';

export default function FeaturesGrid() {
  return (
    <section id="product" style={{
      background: '#050508',
      padding: '120px 80px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
      borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            Everything You Need
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            Built for how businesses actually run.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto' }}>
            Every feature in Aspire is designed around real business workflows — not generic automation.
          </p>
        </motion.div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {features.map((feature, i) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  borderRadius: 16,
                  padding: '28px 24px',
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = `${feature.accentLight}`;
                  el.style.borderColor = `${feature.accent}44`;
                  el.style.transform = 'translateY(-4px)';
                  el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.3), 0 0 40px ${feature.accent}15`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = 'rgba(255,255,255,0.025)';
                  el.style.borderColor = 'rgba(255,255,255,0.07)';
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                {/* Accent dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: feature.accent,
                  marginBottom: 16,
                  boxShadow: `0 0 12px ${feature.accent}80`,
                }} />

                <div style={{
                  fontSize: 10, fontWeight: 700, color: feature.accent,
                  letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8,
                }}>
                  {feature.eyebrow}
                </div>

                <h3 style={{
                  fontSize: 18, fontWeight: 700, color: '#ffffff',
                  letterSpacing: '-0.02em', margin: '0 0 10px', lineHeight: 1.25,
                }}>
                  {feature.title}
                </h3>

                <p style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65,
                  margin: '0 0 20px',
                }}>
                  {feature.description1}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {feature.description2.split('. ').slice(0, 3).map((bullet, bi) => (
                    <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%', background: feature.accent,
                        marginTop: 6, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        {bullet.trim()}.
                      </span>
                    </div>
                  ))}
                </div>

                <a
                  href="/login"
                  style={{
                    fontSize: 12, fontWeight: 600, color: feature.accent,
                    textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    transition: 'gap 0.2s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.gap = '8px'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.gap = '4px'; }}
                >
                  Learn more →
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
