import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    icon: '✦',
    title: 'Draft',
    description: 'Ava and your AI staff create invoices, contracts, communications, and actions based on your business data and context.',
    accent: '#3B82F6',
  },
  {
    number: '02',
    icon: '◎',
    title: 'Approve',
    description: 'Every AI action surfaces in your Authority Queue before execution. You review, approve, or deny — with full context and zero guesswork.',
    accent: '#F97316',
  },
  {
    number: '03',
    icon: '⚡',
    title: 'Execute',
    description: 'Approved actions are carried out instantly. Payments sent. Contracts signed. Emails delivered. All with a complete audit trail.',
    accent: '#10B981',
  },
  {
    number: '04',
    icon: '◆',
    title: 'Receipt',
    description: 'Every action is logged, categorized, and available for review. Your books stay clean, your records complete, your compliance assured.',
    accent: '#8B5CF6',
  },
];

export default function HowItWorks() {
  return (
    <section id="features" style={{
      background: '#050508',
      padding: '120px 80px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 80 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            How It Works
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            Governed execution in four steps.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto' }}>
            Every business action follows the same secure, transparent flow — from AI draft to confirmed execution.
          </p>
        </motion.div>

        {/* Steps */}
        <div style={{ position: 'relative' }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute',
            top: 52,
            left: 'calc(12.5% + 24px)',
            right: 'calc(12.5% + 24px)',
            height: 1,
            background: 'linear-gradient(90deg, rgba(59,130,246,0.4), rgba(249,115,22,0.4), rgba(16,185,129,0.4), rgba(139,92,246,0.4))',
            zIndex: 0,
          }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, position: 'relative', zIndex: 1 }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}>
                  {/* Icon circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: `rgba(${step.accent === '#3B82F6' ? '59,130,246' : step.accent === '#F97316' ? '249,115,22' : step.accent === '#10B981' ? '16,185,129' : '139,92,246'},0.12)`,
                    border: `1px solid ${step.accent}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, marginBottom: 24,
                    boxShadow: `0 0 20px ${step.accent}22`,
                  }}>
                    <span style={{ color: step.accent }}>{step.icon}</span>
                  </div>

                  <div style={{
                    fontSize: 10, fontWeight: 700, color: step.accent,
                    letterSpacing: '0.1em', marginBottom: 8,
                  }}>
                    STEP {step.number}
                  </div>

                  <h3 style={{
                    fontSize: 22, fontWeight: 700, color: '#ffffff',
                    letterSpacing: '-0.02em', margin: '0 0 12px',
                  }}>
                    {step.title}
                  </h3>

                  <p style={{
                    fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65,
                    margin: 0,
                  }}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
