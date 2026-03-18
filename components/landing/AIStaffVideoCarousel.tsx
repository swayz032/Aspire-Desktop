import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const videos = [
  {
    src: '/videos/ava-demo.mp4',
    name: 'Ava',
    role: 'AI Operations Director',
    accent: '#9333EA',
    rgb: '147,51,234',
  },
  {
    src: '/videos/finn-demo.mp4',
    name: 'Finn',
    role: 'AI Front Desk Manager',
    accent: '#06B6D4',
    rgb: '6,182,212',
  },
  {
    src: '/videos/eli-demo.mp4',
    name: 'Eli',
    role: 'AI Chief Financial Officer',
    accent: '#10B981',
    rgb: '16,185,129',
  },
];

function AIStaffVideoCarouselInner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (!entry.isIntersecting) {
          videoRefs.current.forEach((vid) => {
            if (vid) { vid.pause(); vid.currentTime = 0; }
          });
        } else {
          const active = videoRefs.current[activeIndex];
          if (active) active.play().catch(() => {});
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [activeIndex]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (i === activeIndex && isVisibleRef.current) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [activeIndex]);

  const navigate = (dir: 1 | -1) => {
    setDirection(dir);
    setActiveIndex((prev) => (prev + dir + 3) % 3);
  };

  const video = videos[activeIndex];

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '105%' : '-105%', opacity: 0 }),
    center: { x: '0%', opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-105%' : '105%', opacity: 0 }),
  };

  return (
    <div ref={sectionRef} style={{ width: '100%', userSelect: 'none' }}>
      {/* Single card filling full column width */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#000',
          border: `1px solid rgba(${video.rgb}, 0.45)`,
          boxShadow: `0 28px 70px rgba(0,0,0,0.7), 0 0 60px rgba(${video.rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.07)`,
          transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.8 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <video
              ref={(el) => { videoRefs.current[activeIndex] = el; }}
              src={video.src}
              loop
              playsInline
              preload="metadata"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                background: '#000',
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '38%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 65%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 5,
        }} />

        {/* Name badge */}
        <div style={{
          position: 'absolute', bottom: 18, left: 18,
          display: 'flex', alignItems: 'center', gap: 9,
          pointerEvents: 'none', zIndex: 6,
        }}>
          <div style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: video.accent, boxShadow: `0 0 6px ${video.accent}`,
            }} />
            <motion.div
              animate={{ scale: [1, 2.2], opacity: [0.9, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: video.accent }}
            />
          </div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: '#fff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {video.name}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: video.accent,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>
              {video.role}
            </div>
          </div>
        </div>

        {/* Arrow buttons */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 6, fontSize: 14, backdropFilter: 'blur(6px)',
          }}
        >
          ‹
        </button>
        <button
          onClick={() => navigate(1)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 6, fontSize: 14, backdropFilter: 'blur(6px)',
          }}
        >
          ›
        </button>
      </div>

      {/* Nav dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 7, marginTop: 16,
      }}>
        {videos.map((v, i) => (
          <motion.button
            key={i}
            onClick={() => { setDirection(i > activeIndex ? 1 : -1); setActiveIndex(i); }}
            animate={{
              width: i === activeIndex ? 22 : 7,
              background: i === activeIndex ? v.accent : 'rgba(255,255,255,0.22)',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AIStaffVideoCarousel(props: any) {
  return (
    <PageErrorBoundary pageName="a-i-staff-video-carousel">
      <AIStaffVideoCarouselInner {...props} />
    </PageErrorBoundary>
  );
}
