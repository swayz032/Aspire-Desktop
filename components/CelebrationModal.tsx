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
    @keyframes cardFlip {
      from { transform: rotateY(0deg); }
      to   { transform: rotateY(180deg); }
    }
    @keyframes cardFlipBack {
      from { transform: rotateY(180deg); }
      to   { transform: rotateY(0deg); }
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
// Web 3D Titanium Card
// ---------------------------------------------------------------------------

function TitaniumCard3D({
  businessName,
  ownerName,
  suiteDisplayId,
  officeDisplayId,
  onEnter,
}: {
  businessName: string;
  ownerName: string;
  suiteDisplayId: string;
  officeDisplayId: string;
  onEnter: () => void;
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

  // Specular highlight overlay
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
          {/* Specular */}
          <div style={specularStyle} />

          {/* EMV Chip */}
          <EMVChip />

          {/* Center: company + logo */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
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

            {/* Aspire "A" medallion */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, rgba(59,130,246,0.18) 0%, rgba(10,10,20,0.6) 70%)',
              border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              <img
                src="/aspire-icon-glow.png"
                alt="Aspire"
                style={{
                  width: 50,
                  height: 50,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 14px rgba(59,130,246,0.95))',
                }}
              />
            </div>
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
              tap to activate ↻
            </span>
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div style={backFaceStyle}>
          {/* Specular */}
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
            paddingTop: 30,
          }}>
            {/* Suite ID */}
            {suiteDisplayId ? (
              <div style={{ marginBottom: 22 }}>
                <div style={labelStyle}>Suite</div>
                <div style={valueStyle}>
                  {suiteDisplayId.match(/.{1,4}/g)?.join('  ·  ') ?? suiteDisplayId}
                </div>
              </div>
            ) : null}

            {/* Office ID */}
            {officeDisplayId ? (
              <div style={{ marginBottom: 32 }}>
                <div style={labelStyle}>Office</div>
                <div style={valueStyle}>
                  {officeDisplayId.match(/.{1,4}/g)?.join('  ·  ') ?? officeDisplayId}
                </div>
              </div>
            ) : null}

            {/* Enter Aspire button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEnter(); }}
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 50,
                  padding: '13px 30px',
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
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(59,130,246,0.65), 0 0 0 1px rgba(255,255,255,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
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

          {/* Back Aspire icon top-right */}
          <img
            src="/aspire-icon-glow.png"
            alt=""
            style={{
              position: 'absolute',
              top: 20,
              right: 24,
              width: 28,
              height: 28,
              objectFit: 'contain',
              opacity: 0.5,
              filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))',
            }}
          />
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

      {/* Card */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <TitaniumCard3D
          businessName={businessName}
          ownerName={ownerName}
          suiteDisplayId={suiteDisplayId}
          officeDisplayId={officeDisplayId}
          onEnter={onEnter}
        />

        {/* Congratulations text below card */}
        <div style={{
          textAlign: 'center',
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
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
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: Animation.slow,
        useNativeDriver: true,
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

export function CelebrationModal(props: CelebrationModalProps) {
  const ownerName = props.ownerName ?? '';

  if (Platform.OS === 'web') {
    return <CelebrationWeb {...props} ownerName={ownerName} />;
  }
  return <CelebrationNative {...props} />;
}

// ---------------------------------------------------------------------------
// Native Styles
// ---------------------------------------------------------------------------

const CARD_PADDING = Spacing.xxxl + Spacing.sm;

const nativeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    maxWidth: 520,
    width: '100%',
    backgroundColor: Colors.surface.premium,
    borderWidth: 1,
    borderColor: Colors.border.premium,
    borderRadius: BorderRadius.xl,
    padding: CARD_PADDING,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.accent.cyan,
    opacity: 0.4,
  },
  logoContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  logo: { width: 48, height: 48 },
  congratsText: {
    ...Typography.display,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  businessName: {
    ...Typography.title,
    color: Colors.accent.cyan,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.xl,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 44,
    ...Shadows.glow(Colors.accent.cyan),
  },
  badgeText: { ...Typography.captionMedium, color: Colors.accent.cyan },
  welcomeText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  buttonContainer: { flexDirection: 'row', alignItems: 'center' },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    minHeight: 44,
    borderRadius: BorderRadius.lg,
    ...Shadows.glow(Colors.accent.cyan),
  },
  enterButtonText: { ...Typography.bodyMedium, color: Colors.text.primary },
});

export default CelebrationModal;
