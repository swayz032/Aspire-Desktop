import React, { useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';

const navLinks = ['Product', 'Features', 'AI Staff', 'Pricing'];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { scrollY } = useScroll();

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
        padding: '0 48px',
        height: 64,
        backdropFilter: scrolled ? 'blur(24px)' : 'blur(0px)',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'blur(0px)',
        background: scrolled ? 'rgba(5,5,8,0.82)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      {/* Logo */}
      <a href="/landing" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
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
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            transition: 'color 0.2s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)'; }}
        >
          Sign In
        </a>
        <a
          href="/login"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            textDecoration: 'none',
            padding: '9px 20px',
            borderRadius: 24,
            background: '#3B82F6',
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
