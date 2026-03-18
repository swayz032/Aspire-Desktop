import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { teamMembers } from './TeamData';
import VideoModal from './VideoModal';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function MeetTheTeamInner() {
  const [modalMember, setModalMember] = useState<{ name: string; videoPath: string } | null>(null);

  return (
    <section id="ai-staff" style={{
      background: '#070710',
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
          style={{ textAlign: 'center', marginBottom: 72 }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9333EA', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, marginBottom: 16,
          }}>
            Meet the Team
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#ffffff',
            letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            Your AI staff is ready to work.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 520, margin: '0 auto' }}>
            Each AI staff member is specialized, trained on your business, and available 24/7.
            No onboarding. No sick days. No overhead.
          </p>
        </motion.div>

        {/* Team Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {teamMembers.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
            >
              <div style={{
                background: 'rgba(14,14,22,0.8)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'default',
              }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.border = `1px solid ${member.accent}33`;
                  el.style.boxShadow = `0 20px 50px rgba(0,0,0,0.4), 0 0 40px ${member.accent}12`;
                  el.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.border = '1px solid rgba(255,255,255,0.07)';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'translateY(0)';
                }}
              >
                {/* Avatar */}
                <div style={{
                  height: 200,
                  background: `linear-gradient(135deg, rgba(14,14,22,1) 0%, ${member.accentLight} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <img
                    src={member.avatarPath}
                    alt={member.name}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      objectPosition: 'top center',
                    }}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = `
                          width: 80px; height: 80px; border-radius: 50%;
                          background: ${member.accentLight};
                          border: 2px solid ${member.accent}44;
                          display: flex; align-items: center; justify-content: center;
                          font-size: 32px; font-weight: 700; color: ${member.accent};
                        `;
                        placeholder.textContent = member.name[0];
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                  {/* Gradient overlay */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                    background: 'linear-gradient(transparent, rgba(14,14,22,0.9))',
                  }} />
                  {/* Department badge */}
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 10, fontWeight: 700, color: member.accent,
                    background: `${member.accentLight}`,
                    border: `1px solid ${member.accent}33`,
                    padding: '3px 10px', borderRadius: 20,
                    letterSpacing: '0.05em',
                  }}>
                    {member.department}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px 24px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{
                      fontSize: 20, fontWeight: 700, color: '#ffffff',
                      letterSpacing: '-0.02em', margin: '0 0 4px',
                    }}>
                      {member.name}
                    </h3>
                    <div style={{ fontSize: 13, color: member.accent, fontWeight: 600 }}>
                      {member.role}
                    </div>
                  </div>

                  <p style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
                    margin: '0 0 16px',
                  }}>
                    {member.description}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    {member.bullets.map((bullet, bi) => (
                      <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 4, height: 4, borderRadius: '50%',
                          background: member.accent, marginTop: 6, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                          {bullet}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setModalMember({ name: member.name, videoPath: member.videoPath })}
                    style={{
                      width: '100%',
                      fontSize: 13, fontWeight: 600, color: member.accent,
                      background: member.accentLight,
                      border: `1px solid ${member.accent}33`,
                      borderRadius: 8, padding: '10px 0', cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = member.accentLight.replace('0.15', '0.25');
                      el.style.borderColor = `${member.accent}55`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = member.accentLight;
                      el.style.borderColor = `${member.accent}33`;
                    }}
                  >
                    <span style={{ fontSize: 14 }}>▶</span>
                    Watch Intro
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Video Modal */}
      {modalMember && (
        <VideoModal
          isOpen={!!modalMember}
          onClose={() => setModalMember(null)}
          videoPath={modalMember.videoPath}
          memberName={modalMember.name}
        />
      )}
    </section>
  );
}

export default function MeetTheTeam(props: any) {
  return (
    <PageErrorBoundary pageName="meet-the-team">
      <MeetTheTeamInner {...props} />
    </PageErrorBoundary>
  );
}
