import React from 'react';
import { motion } from 'framer-motion';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const addOns = [
  { label: 'Team Member Seat', price: '$299', period: '/mo' },
  { label: 'Additional Suite', price: '$349', period: '/mo' },
];

const included = [
  'Ava, Eli, Finn, Sarah, Clara, Nora & Quinn',
  'Unlimited Canvas workspace',
  'Finance Hub + Bank sync via Plaid',
  'Authority Queue with full audit trail',
  'Contracts, eSign & Invoice management',
  'Scheduling, conference calls & messaging',
  'Priority onboarding & dedicated support',
];

function PricingCTAInner() {
  return (
    <section id="pricing" style={{
      background: '#050508',
      padding: '120px 80px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
      borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: 56 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            Pricing
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            One plan. Your entire executive team.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto' }}>
            Aspire replaces a full executive team for less than the cost of one junior hire.
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ position: 'relative', marginBottom: 40 }}
        >
          {/* Animated border glow */}
          <div style={{
            position: 'absolute', inset: -1, borderRadius: 25,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(139,92,246,0.3), rgba(6,182,212,0.4), rgba(59,130,246,0.5))',
            backgroundSize: '300% 300%',
            animation: 'gradientBorder 4s ease infinite',
            zIndex: 0,
          }} />
          <style>{`
            @keyframes gradientBorder {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>

          <div style={{
            position: 'relative', zIndex: 1,
            background: '#0a0a12',
            borderRadius: 24,
            padding: '56px 64px',
            overflow: 'hidden',
          }}>
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
              width: 400, height: 400,
              background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 20, padding: '4px 14px', marginBottom: 24,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.04em' }}>Owner Plan</span>
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                <span style={{
                  fontSize: 72, fontWeight: 800, color: '#ffffff',
                  letterSpacing: '-0.04em', lineHeight: 1,
                }}>$399</span>
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>/mo</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                Everything included. No per-feature pricing. No surprises.
              </p>
            </div>

            {/* Included features */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px 40px', marginBottom: 40, textAlign: 'left',
            }}>
              {included.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2, fontSize: 9, color: '#10B981',
                  }}>✓</div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a
              href="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 16, fontWeight: 700, color: '#ffffff',
                textDecoration: 'none', padding: '16px 40px', borderRadius: 32,
                background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                boxShadow: '0 0 40px rgba(59,130,246,0.5), 0 8px 24px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = '0 0 60px rgba(59,130,246,0.7), 0 12px 32px rgba(0,0,0,0.5)';
                el.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = '0 0 40px rgba(59,130,246,0.5), 0 8px 24px rgba(0,0,0,0.4)';
                el.style.transform = 'translateY(0)';
              }}
            >
              Subscribe and turn on your office
            </a>
          </div>
        </motion.div>

        {/* Add-ons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center' }}
        >
          {addOns.map((addon) => (
            <div key={addon.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 24px',
              textAlign: 'left',
              minWidth: 200,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Add-on</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>{addon.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#3B82F6' }}>{addon.price}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{addon.period}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default function PricingCTA(props: any) {
  return (
    <PageErrorBoundary pageName="pricing-c-t-a">
      <PricingCTAInner {...props} />
    </PageErrorBoundary>
  );
}
