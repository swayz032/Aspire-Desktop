import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const navLinks = ['Product', 'Features', 'AI Staff', 'Pricing'];

// Inject hover/active CSS gated by pointer media query so touch devices get
// a tap-feedback :active state instead of a sticky :hover. The inline
// onMouseEnter/Leave handlers below remain for fine-pointer browsers, but
// the CSS rules here ensure links visibly respond to taps on iPad/Android.
const NAV_CSS_ID = 'aspire-landing-nav-touch-css';
function ensureNavCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(NAV_CSS_ID)) return;
  const style = document.createElement('style');
  style.id = NAV_CSS_ID;
  style.textContent = `
    .aspire-nav-link, .aspire-nav-cta {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    /* Touch / coarse-pointer devices: visible press feedback */
    @media (hover: none), (pointer: coarse) {
      .aspire-nav-link:active {
        color: #ffffff !important;
        background: rgba(255,255,255,0.08) !important;
      }
      .aspire-nav-cta:active {
        background: #2563EB !important;
        transform: translateY(0) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function LandingNavInner() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { scrollY } = useScroll();

  useEffect(() => { ensureNavCss(); }, []);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const prev = lastScrollY.current;
    setScrolled(latest > 40);
    setHidden(latest > prev && latest > 100);
    lastScrollY.current = latest;
  });

  return (
    <motion.nav
      animate={{ y: hidden ? -80 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Fluid horizontal padding so nav doesn't overflow on iPad portrait.
        // Caps at 48px above 1200px viewport -> desktop unchanged.
        padding: '0 clamp(16px, 4vw, 48px)',
        height: 64,
        backdropFilter: scrolled ? 'blur(24px)' : 'blur(0px)',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'blur(0px)',
        background: scrolled ? 'rgba(5,5,8,0.82)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img
          src="/aspire-logo-full.png"
          alt="Aspire"
          style={{
            height: 140,
            objectFit: 'contain',
          } as React.CSSProperties}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </a>

      {/* Nav Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {navLinks.map((link) => (
          <a
            key={link}
            className="aspire-nav-link"
            href={`#${link.toLowerCase().replace(' ', '-')}`}
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.6)',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              transition: 'color 0.2s ease, background 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              // Expand hit area to 44pt vertical without changing visible padding
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)';
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            }}
          >
            {link}
          </a>
        ))}
      </div>

      {/* CTA Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a
          href="/login"
          className="aspire-nav-link"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            transition: 'color 0.2s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)'; }}
        >
          Sign In
        </a>
        <a
          href="/login"
          className="aspire-nav-cta"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            textDecoration: 'none',
            padding: '9px 20px',
            borderRadius: 24,
            background: '#3B82F6',
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            boxShadow: '0 0 20px rgba(59,130,246,0.4)',
            transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#2563EB';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 30px rgba(59,130,246,0.6)';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#3B82F6';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 20px rgba(59,130,246,0.4)';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
          }}
        >
          Get Started
        </a>
      </div>
    </motion.nav>
  );
}

export default function LandingNav(props: any) {
  return (
    <PageErrorBoundary pageName="landing-nav">
      <LandingNavInner {...props} />
    </PageErrorBoundary>
  );
}
