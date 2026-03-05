import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Draft',
    description: 'Ava and your AI staff create invoices, contracts, communications, and actions based on your business data and context.',
    accent: '#3B82F6',
    rgb: '59,130,246',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M6 20h8.5l7-7L18 9.5l-7 7H6v3.5z" fill="currentColor" opacity="0.15"/>
        <path d="M18 9.5l-1.5-1.5a1.5 1.5 0 0 0-2.12 0L5.5 16.88V20H9l8.88-8.88a1.5 1.5 0 0 0 0-2.12l-1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.5 11l2 2M6 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Approve',
    description: 'Every AI action surfaces in your Authority Queue before execution. You review, approve, or deny — with full context and zero guesswork.',
    accent: '#F97316',
    rgb: '249,115,22',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 3.5L5 7v6c0 4.97 3.42 9.62 8 10.73C18.58 22.62 22 17.97 22 13V7l-9-3.5z" fill="currentColor" opacity="0.12"/>
        <path d="M13 3.5L5 7v6c0 4.97 3.42 9.62 8 10.73C18.58 22.62 22 17.97 22 13V7l-9-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M9.5 13l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Execute',
    description: 'Approved actions are carried out instantly. Payments sent. Contracts signed. Emails delivered. All with a complete audit trail.',
    accent: '#10B981',
    rgb: '16,185,129',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M14.5 4L6 15h7.5L11.5 22 20 11h-7.5L14.5 4z" fill="currentColor" opacity="0.15"/>
        <path d="M14.5 4L6 15h7.5L11.5 22 20 11h-7.5L14.5 4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: '04',
    title: 'Receipt',
    description: 'Every action is logged, categorized, and available for review. Your books stay clean, your records complete, your compliance assured.',
    accent: '#8B5CF6',
    rgb: '139,92,246',
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M7 3.5h12a1 1 0 0 1 1 1v17l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2v-17a1 1 0 0 1 1-1z" fill="currentColor" opacity="0.12"/>
        <path d="M7 3.5h12a1 1 0 0 1 1 1v17l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2v-17a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 9.5h6M10 13h6M10 16.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const NODE_POSITIONS = ['12.5%', '37.5%', '62.5%', '87.5%'];

export default function HowItWorks() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'how-it-works-keyframes';
    style.textContent = `
      @keyframes shimmer-flow {
        0% { left: -35%; }
        100% { left: 115%; }
      }
      @keyframes node-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
        50% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
      }
    `;
    if (!document.getElementById('how-it-works-keyframes')) {
      document.head.appendChild(style);
    }
    return () => document.getElementById('how-it-works-keyframes')?.remove();
  }, []);

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
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, color: '#3B82F6',
            letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            <div style={{ width: 24, height: 1, background: '#3B82F6', opacity: 0.6 }} />
            How It Works
            <div style={{ width: 24, height: 1, background: '#3B82F6', opacity: 0.6 }} />
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            Governed execution in four steps.
          </h2>
          <p style={{
            fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto',
          }}>
            Every business action follows the same secure, transparent flow — from AI draft to confirmed execution.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div style={{ position: 'relative' }}>

          {/* Connecting line — spans icon center to icon center */}
          <div style={{
            position: 'absolute',
            top: 44,
            left: '12.5%',
            right: '12.5%',
            height: 2,
            background: 'linear-gradient(90deg, #3B82F6 0%, #F97316 33%, #10B981 66%, #8B5CF6 100%)',
            borderRadius: 2,
            overflow: 'hidden',
            zIndex: 0,
          }}>
            {/* Traveling shimmer */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0,
              width: '30%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
              animation: 'shimmer-flow 3s ease-in-out infinite',
            }} />
          </div>

          {/* Node dots — one per step, on the line */}
          {steps.map((step, i) => {
            const isHovered = hoveredStep === i;
            return (
              <div key={i} style={{
                position: 'absolute',
                top: 44,
                left: NODE_POSITIONS[i],
                zIndex: 2,
                pointerEvents: 'none',
              }}>
                {/* Outer pulse ring */}
                <div style={{
                  position: 'absolute',
                  width: isHovered ? 24 : 16,
                  height: isHovered ? 24 : 16,
                  borderRadius: '50%',
                  border: `1.5px solid rgba(${step.rgb},${isHovered ? 0.7 : 0.45})`,
                  transform: 'translate(-50%, -50%)',
                  animation: `node-pulse ${isHovered ? '1.2s' : '2.4s'} ease-out ${i * 0.3}s infinite`,
                  transition: 'width 0.3s ease, height 0.3s ease, border-color 0.3s ease',
                }} />
                {/* Solid center dot */}
                <div style={{
                  position: 'absolute',
                  width: isHovered ? 10 : 8,
                  height: isHovered ? 10 : 8,
                  borderRadius: '50%',
                  background: step.accent,
                  boxShadow: isHovered
                    ? `0 0 18px rgba(${step.rgb},1), 0 0 36px rgba(${step.rgb},0.5)`
                    : `0 0 10px rgba(${step.rgb},0.7)`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'width 0.3s ease, height 0.3s ease, box-shadow 0.3s ease',
                }} />
              </div>
            );
          })}

          {/* Step columns — no card background, original open layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
            position: 'relative',
            zIndex: 1,
          }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                onHoverStart={() => setHoveredStep(i)}
                onHoverEnd={() => setHoveredStep(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'default',
                }}
              >
                {/* 3-layer icon circle */}
                <motion.div
                  animate={{ scale: hoveredStep === i ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  style={{ position: 'relative', width: 88, height: 88, marginBottom: 24, flexShrink: 0 }}
                >
                  {/* Outer ring */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: `1px solid rgba(${step.rgb},${hoveredStep === i ? 0.35 : 0.15})`,
                    transition: 'border-color 0.3s ease',
                  }} />
                  {/* Glass disc */}
                  <div style={{
                    position: 'absolute', inset: 10,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, rgba(${step.rgb},${hoveredStep === i ? 0.22 : 0.12}) 0%, rgba(${step.rgb},0.05) 100%)`,
                    border: `1px solid rgba(${step.rgb},${hoveredStep === i ? 0.45 : 0.28})`,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: hoveredStep === i
                      ? `0 0 48px rgba(${step.rgb},0.5), 0 0 80px rgba(${step.rgb},0.15), inset 0 1px 0 rgba(255,255,255,0.18)`
                      : `0 0 28px rgba(${step.rgb},0.2), inset 0 1px 0 rgba(255,255,255,0.1)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  } as React.CSSProperties}>
                    <div style={{ color: step.accent }}>
                      {step.icon}
                    </div>
                  </div>
                </motion.div>

                {/* Step label */}
                <div style={{
                  fontSize: 10, fontWeight: 700, color: step.accent,
                  letterSpacing: '0.1em', marginBottom: 8,
                  opacity: hoveredStep === i ? 1 : 0.75,
                  transition: 'opacity 0.3s ease',
                }}>
                  STEP {step.number}
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: 22, fontWeight: 700, color: '#ffffff',
                  letterSpacing: '-0.02em', margin: '0 0 12px',
                }}>
                  {step.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65,
                  margin: 0,
                }}>
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
