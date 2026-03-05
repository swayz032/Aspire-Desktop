import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEP = 360 / 7;
const RADIUS = 260;

const staff = [
  { name: 'Ava',   role: 'AI Operations Director',      img: '/images/staff/ava.png',   accent: '#9333EA', rgb: '147,51,234' },
  { name: 'Finn',  role: 'AI Front Desk Manager',       img: '/images/staff/finn.png',  accent: '#06B6D4', rgb: '6,182,212'  },
  { name: 'Eli',   role: 'AI Chief Financial Officer',  img: '/images/staff/eli.png',   accent: '#10B981', rgb: '16,185,129' },
  { name: 'Clara', role: 'AI Contract Specialist',      img: '/images/staff/clara.png', accent: '#F97316', rgb: '249,115,22' },
  { name: 'Nora',  role: 'AI HR & Compliance Lead',     img: '/images/staff/nora.png',  accent: '#EC4899', rgb: '236,72,153' },
  { name: 'Sarah', role: 'AI Client Success Manager',   img: '/images/staff/sarah.png', accent: '#EAB308', rgb: '234,179,8'  },
  { name: 'Quinn', role: 'AI Strategy Advisor',         img: '/images/staff/quinn.png', accent: '#3B82F6', rgb: '59,130,246' },
];

function getAngularDistance(i: number, activeIndex: number, total: number): number {
  const diff = Math.abs(i - activeIndex);
  return Math.min(diff, total - diff);
}

function getBrightness(dist: number): number {
  if (dist === 0) return 1;
  if (dist === 1) return 0.72;
  if (dist === 2) return 0.5;
  return 0.35;
}

export default function AIStaffPhotoCarousel() {
  const [rotationAngle, setRotationAngle] = useState(0);
  const pauseRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeIndex = Math.round(rotationAngle / STEP) % staff.length;
  const active = staff[((activeIndex % staff.length) + staff.length) % staff.length];

  const startAutoRotate = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pauseRef.current) {
        setRotationAngle((prev) => prev + STEP);
      }
    }, 2800);
  };

  useEffect(() => {
    startAutoRotate();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleCardClick = (i: number) => {
    // Calculate shortest rotation path to bring card i to front
    const current = ((activeIndex % staff.length) + staff.length) % staff.length;
    let diff = i - current;
    if (diff > staff.length / 2) diff -= staff.length;
    if (diff < -staff.length / 2) diff += staff.length;
    setRotationAngle((prev) => prev + diff * STEP);

    // Pause auto-rotation for 5s
    pauseRef.current = true;
    setTimeout(() => { pauseRef.current = false; }, 5000);
  };

  return (
    <div style={{
      width: '100%',
      minHeight: 580,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* 3D Stage */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 480,
        perspective: '1000px',
        perspectiveOrigin: '50% 48%',
      }}>
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Rotor */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 0,
              height: 0,
              transformStyle: 'preserve-3d',
              transform: `rotateY(${-rotationAngle}deg)`,
              transition: 'transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {staff.map((member, i) => {
              const cardAngle = i * STEP;
              const dist = getAngularDistance(
                i,
                ((activeIndex % staff.length) + staff.length) % staff.length,
                staff.length
              );
              const isActive = dist === 0;
              const brightness = getBrightness(dist);
              const cardScale = isActive ? 1.12 : 1;

              return (
                <div
                  key={member.name}
                  onClick={() => handleCardClick(i)}
                  style={{
                    position: 'absolute',
                    width: 210,
                    height: 290,
                    marginLeft: -105,
                    marginTop: -145,
                    borderRadius: 24,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transform: `rotateY(${cardAngle}deg) translateZ(${RADIUS}px) scale(${cardScale})`,
                    background: isActive
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: isActive
                      ? `1.5px solid rgba(${active.rgb}, 0.7)`
                      : '1px solid rgba(255,255,255,0.09)',
                    boxShadow: isActive
                      ? `0 28px 70px rgba(0,0,0,0.65), 0 0 55px rgba(${active.rgb},0.3), inset 0 1px 0 rgba(255,255,255,0.15)`
                      : '0 12px 40px rgba(0,0,0,0.5)',
                    filter: `brightness(${brightness})`,
                    transition: 'border 0.4s ease, box-shadow 0.4s ease, filter 0.4s ease',
                  }}
                >
                  {/* Portrait */}
                  <img
                    src={member.img}
                    alt={member.name}
                    style={{
                      width: '100%',
                      height: 224,
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      display: 'block',
                    }}
                  />

                  {/* Name strip */}
                  <div style={{
                    padding: '14px 16px 16px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.82))',
                  }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: '#fff',
                      letterSpacing: '-0.02em', lineHeight: 1.2,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    }}>
                      {member.name}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 500,
                      color: member.accent,
                      marginTop: 4,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {member.role}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Active staff label */}
      <div style={{ height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ textAlign: 'center' }}
          >
            <div style={{
              fontSize: 22, fontWeight: 800, color: '#fff',
              letterSpacing: '-0.03em', lineHeight: 1.1,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>
              {active.name}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: active.accent,
              marginTop: 4,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>
              {active.role}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
