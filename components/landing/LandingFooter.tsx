import React from 'react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const footerLinks = {
  Product: ['Features', 'Canvas', 'AI Staff', 'Finance Hub', 'Authority Queue'],
  Company: ['About', 'Pricing', 'Blog', 'Careers', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Security', 'Cookie Policy'],
};

function LandingFooterInner() {
  return (
    <footer style={{
      background: '#050508',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '64px 80px 40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 48, marginBottom: 64 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img src="/aspire-logo.png" alt="Aspire" style={{ height: 22, objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>Aspire</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 240, margin: '0 0 24px' }}>
              Governed AI execution for modern business. Think it, govern it, execute it.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {['𝕏', 'in', '⬡'].map((icon, i) => (
                <a key={i} href="#" style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'rgba(255,255,255,0.4)',
                  textDecoration: 'none',
                  transition: 'background 0.2s, color 0.2s',
                }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(59,130,246,0.1)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#3B82F6';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)';
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 20,
              }}>
                {category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map((link) => (
                  <a key={link} href="#" style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'; }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            © 2026 Aspire. All rights reserved.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingFooter(props: any) {
  return (
    <PageErrorBoundary pageName="landing-footer">
      <LandingFooterInner {...props} />
    </PageErrorBoundary>
  );
}
