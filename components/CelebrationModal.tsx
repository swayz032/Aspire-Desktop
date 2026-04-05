import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows, Spacing, Animation } from '@/constants/tokens';
import { ShinyText } from '@/components/ShinyText';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const ASPIRE_LOGO = require('@/assets/aspire-a-logo.png');

interface CelebrationModalProps {
  businessName: string;
  suiteDisplayId: string;
  officeDisplayId: string;
  ownerName?: string;
  onEnter: () => void;
}

// ---------------------------------------------------------------------------
// CSS keyframe injection (web only)
// ---------------------------------------------------------------------------

const STYLE_ID = '__aspire_celebration_styles__';

function injectCelebrationStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes cardFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    @keyframes celebFadeIn {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0px) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// 3D CSS EMV Chip
// ---------------------------------------------------------------------------

function EMVChip() {
  const chipStyle: React.CSSProperties = {
    position: 'absolute',
    top: 28,
    left: 28,
    width: 44,
    height: 34,
    borderRadius: 5,
    background: 'linear-gradient(135deg, #7a7a88 0%, #b0b0be 28%, #6a6a7a 52%, #9a9aaa 72%, #7a7a88 100%)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '2px',
    padding: '4px',
  };

  const padStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #888898, #aaaabc)',
    borderRadius: 2,
    border: '0.5px solid rgba(0,0,0,0.25)',
    boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.15)',
  };

  return (
    <div style={chipStyle}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={padStyle} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Engraved Aspire A (SVG, metal relief, no glow)
// ---------------------------------------------------------------------------

function EngravingMedallion() {
  const ovalStyle: React.CSSProperties = {
    width: 88,
    height: 88,
    borderRadius: '50%',
    background: 'linear-gradient(155deg, #0e0e1a 0%, #171724 55%, #111120 100%)',
    boxShadow: [
      'inset 0 4px 10px rgba(0,0,0,0.75)',
      'inset 0 1px 4px rgba(0,0,0,0.55)',
      'inset 0 -1px 0 rgba(255,255,255,0.04)',
      '0 1px 0 rgba(255,255,255,0.06)',
    ].join(', '),
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={ovalStyle}>
      {/* Engraved Aspire A — solid metal color, inset appearance */}
      <svg
        width="46"
        height="46"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' } as React.CSSProperties}
      >
        <defs>
          <filter id="engrave" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="rgba(255,255,255,0.14)" />
            <feDropShadow dx="0" dy="-1.5" stdDeviation="1.2" floodColor="rgba(0,0,0,0.9)" />
          </filter>
        </defs>
        {/* Aspire A shape — two outer legs + inner notch */}
        <path
          d="M50 8 L88 88 L70 88 L50 46 L30 88 L12 88 Z"
          fill="rgba(255,255,255,0.52)"
          filter="url(#engrave)"
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web 3D Titanium Card
// ---------------------------------------------------------------------------

function TitaniumCard3D({
  businessName,
  ownerName,
  suiteDisplayId,
  officeDisplayId,
}: {
  businessName: string;
  ownerName: string;
  suiteDisplayId: string;
  officeDisplayId: string;
}) {
  useEffect(() => { injectCelebrationStyles(); }, []);

  const [flipped, setFlipped] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(35);
  const [isHovering, setIsHovering] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotY = ((x - cx) / cx) * 14;
    const rotX = -((y - cy) / cy) * 10;
    setTiltX(rotX);
    setTiltY(rotY);
    setLightX((x / rect.width) * 100);
    setLightY((y / rect.height) * 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setTiltX(0);
      setTiltY(0);
      setLightX(50);
      setLightY(35);
    }, 100);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const CARD_W = 540;
  const CARD_H = 340;

  const titaniumBase: React.CSSProperties = {
    background: [
      'repeating-linear-gradient(88deg, transparent 0px, transparent 2px, rgba(255,255,255,0.016) 2px, rgba(255,255,255,0.016) 4px)',
      'linear-gradient(160deg, #16161e 0%, #2a2a36 18%, #3c3c4a 36%, #262636 54%, #18182a 70%, #2c2c3e 84%, #16161e 100%)',
    ].join(', '),
    boxShadow: [
      '0 60px 120px rgba(0,0,0,0.85)',
      '0 20px 40px rgba(0,0,0,0.6)',
      '0 0 0 1px rgba(255,255,255,0.08)',
      'inset 0 1px 0 rgba(255,255,255,0.14)',
      'inset 0 -1px 0 rgba(0,0,0,0.4)',
    ].join(', '),
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 18,
  };

  const wrapperStyle: React.CSSProperties = {
    width: CARD_W,
    height: CARD_H,
    perspective: '1200px',
    cursor: 'pointer',
    userSelect: 'none',
    animation: 'cardFloat 4s ease-in-out infinite',
  };

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d',
    transition: isHovering
      ? 'transform 0.08s ease-out'
      : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
    transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${flipped ? 180 + tiltY : tiltY}deg)`,
  };

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 18,
    overflow: 'hidden',
    ...titaniumBase,
  };

  const backFaceStyle: React.CSSProperties = {
    ...faceBase,
    transform: 'rotateY(180deg)',
  };

  const specularStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 18,
    background: `radial-gradient(ellipse at ${lightX}% ${lightY}%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 35%, transparent 65%)`,
    pointerEvents: 'none',
    transition: 'background 0.05s ease',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 300,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'monospace',
  };

  return (
    <div
      ref={cardRef}
      style={wrapperStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={handleFlip}
    >
      <div style={innerStyle}>

        {/* ── FRONT FACE ── */}
        <div style={faceBase}>
          <div style={specularStyle} />
          <EMVChip />

          {/* Center: company name + engraved medallion */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}>
            <div style={{
              fontSize: 17,
              fontWeight: 200,
              letterSpacing: 4,
              color: 'rgba(255,255,255,0.88)',
              textTransform: 'uppercase',
              textAlign: 'center',
              maxWidth: '70%',
              lineHeight: '1.3',
            }}>
              {businessName}
            </div>

            <EngravingMedallion />
          </div>

          {/* Bottom-left: owner name */}
          <div style={{
            position: 'absolute',
            bottom: 28,
            left: 28,
            fontSize: 12,
            fontWeight: 300,
            letterSpacing: 3,
            color: 'rgba(255,255,255,0.65)',
            textTransform: 'uppercase',
          }}>
            {ownerName}
          </div>

          {/* Bottom-right: ASPIRE brand + flip hint */}
          <div style={{
            position: 'absolute',
            bottom: 26,
            right: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 4.5,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
            }}>
              ASPIRE
            </span>
            <span style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.22)',
              letterSpacing: 1,
            }}>
              tap to reveal ↻
            </span>
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div style={backFaceStyle}>
          <div style={specularStyle} />

          {/* Magnetic strip */}
          <div style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            height: 46,
            background: 'linear-gradient(90deg, #080810, #141420, #080810)',
          }} />

          {/* Back content */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 36px',
            paddingTop: 40,
          }}>
            {suiteDisplayId ? (
              <div style={{ marginBottom: 22 }}>
                <div style={labelStyle}>Suite</div>
                <div style={valueStyle}>
                  {suiteDisplayId.match(/.{1,4}/g)?.join('  ·  ') ?? suiteDisplayId}
                </div>
              </div>
            ) : null}

            {officeDisplayId ? (
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Office</div>
                <div style={valueStyle}>
                  {officeDisplayId.match(/.{1,4}/g)?.join('  ·  ') ?? officeDisplayId}
                </div>
              </div>
            ) : null}

            <div style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: 1.5,
              marginTop: 8,
            }}>
              tap to return ↻
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web Celebration Screen
// ---------------------------------------------------------------------------

function CelebrationWeb({
  businessName,
  suiteDisplayId,
  officeDisplayId,
  onEnter,
  ownerName,
}: CelebrationModalProps & { ownerName: string }) {
  useEffect(() => { injectCelebrationStyles(); }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      overflow: 'hidden',
      animation: 'celebFadeIn 0.7s cubic-bezier(0.23, 1, 0.32, 1) both',
    }}>
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      >
        <source src="/videos/celebration-bg.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,4,10,0.58)',
        backdropFilter: 'blur(2px)',
        zIndex: 1,
      }} />

      {/* Top-left Aspire logo — no border, transparent, matches onboarding size */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 3,
        pointerEvents: 'none',
      } as React.CSSProperties}>
        <img
          src="/aspire-logo-full.png"
          alt="Aspire"
          style={{ height: 140, objectFit: 'contain', display: 'block' } as React.CSSProperties}
        />
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <TitaniumCard3D
          businessName={businessName}
          ownerName={ownerName ?? ''}
          suiteDisplayId={suiteDisplayId}
          officeDisplayId={officeDisplayId}
        />

        {/* Below-card text + Enter Aspire button */}
        <div style={{
          textAlign: 'center',
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <ShinyText
            style={{ fontSize: 22, fontWeight: '300' } as any}
            speed={4}
            baseColor="rgba(255,255,255,0.55)"
            shineColor="#ffffff"
          >
            Congratulations
          </ShinyText>
          <span style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}>
            Your AI-powered suite is ready
          </span>

          {/* Enter Aspire button */}
          <button
            onClick={onEnter}
            style={{
              marginTop: 10,
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 50,
              padding: '13px 36px',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 1.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(59,130,246,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(59,130,246,0.65), 0 0 0 1px rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(59,130,246,0.45), 0 0 0 1px rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            ENTER ASPIRE
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native Fallback
// ---------------------------------------------------------------------------

function CelebrationNative({
  businessName,
  suiteDisplayId,
  officeDisplayId,
  onEnter,
}: CelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: Animation.spring.damping,
        stiffness: Animation.spring.stiffness,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: Animation.slow,
        useNativeDriver: false,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={nativeStyles.overlay}>
      <Animated.View
        style={[nativeStyles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
      >
        <View style={nativeStyles.accentLine} />
        <View style={nativeStyles.logoContainer}>
          <Image source={ASPIRE_LOGO} style={nativeStyles.logo} resizeMode="contain" />
        </View>
        <Text style={nativeStyles.congratsText}>Congratulations!</Text>
        <Text style={nativeStyles.businessName}>{businessName}</Text>
        <View style={nativeStyles.divider} />
        <View style={nativeStyles.badgeRow}>
          {suiteDisplayId ? (
            <View style={nativeStyles.badge}>
              <Ionicons name="business-outline" size={14} color={Colors.accent.cyan} />
              <Text style={nativeStyles.badgeText}>Suite {suiteDisplayId}</Text>
            </View>
          ) : null}
          {officeDisplayId ? (
            <View style={nativeStyles.badge}>
              <Ionicons name="location-outline" size={14} color={Colors.accent.cyan} />
              <Text style={nativeStyles.badgeText}>Office {officeDisplayId}</Text>
            </View>
          ) : null}
        </View>
        <Text style={nativeStyles.welcomeText}>
          Your AI-powered business suite is ready.{'\n'}Ava and your team of agents are standing by.
        </Text>
        <View style={nativeStyles.buttonContainer}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={nativeStyles.enterButton} onPress={onEnter} activeOpacity={0.8}>
            <Text style={nativeStyles.enterButtonText}>Enter Aspire</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

function CelebrationModalInner(props: CelebrationModalProps) {
  const ownerName = props.ownerName ?? '';

  if (Platform.OS === 'web') {
    return <CelebrationWeb {...props} ownerName={ownerName} />;
  }
  return <CelebrationNative {...props} />;
}

// ---------------------------------------------------------------------------
// Native Styles
// ---------------------------------------------------------------------------

const nativeStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  card: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: Colors.surface.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.elevated,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.accent.blue,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  logo: {
    width: 44,
    height: 44,
  },
  congratsText: {
    ...Typography.h2,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  businessName: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface.tertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  welcomeText: {
    ...Typography.caption,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent.blue,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...Shadows.md,
  },
  enterButtonText: {
    ...Typography.bodyMedium,
    color: Colors.text.primary,
  },
});

export default CelebrationModal;

export function CelebrationModal(props: any) {
  return (
    <PageErrorBoundary pageName="celebration-modal">
      <CelebrationModalInner {...props} />
    </PageErrorBoundary>
  );
}
