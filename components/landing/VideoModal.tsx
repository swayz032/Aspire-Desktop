import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoPath: string;
  memberName: string;
}

function VideoModalInner({ isOpen, onClose, videoPath, memberName }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '90%',
              maxWidth: 800,
              borderRadius: 20,
              overflow: 'hidden',
              background: '#0e0e12',
              border: '1px solid rgba(59,130,246,0.2)',
              boxShadow: '0 0 80px rgba(59,130,246,0.15), 0 40px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ color: '#ffffff', fontSize: 15, fontWeight: 600 }}>
                {memberName} — Introduction
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#a1a1a6',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  lineHeight: 1,
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <video
              ref={videoRef}
              src={videoPath}
              controls
              autoPlay
              style={{
                width: '100%',
                display: 'block',
                maxHeight: '70vh',
                objectFit: 'cover',
                background: '#000',
              }}
              preload="auto"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function VideoModal(props: any) {
  return (
    <PageErrorBoundary pageName="video-modal">
      <VideoModalInner {...props} />
    </PageErrorBoundary>
  );
}
