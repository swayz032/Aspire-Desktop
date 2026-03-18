import React, { useEffect, useRef } from 'react';
import { Platform, Text, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { motion } from 'motion/react';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const STYLE_ID = '__aspire_shiny_text_styles__';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes aspireShimmer {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
  `;
  document.head.appendChild(style);
}

interface ShinyTextProps {
  children: React.ReactNode;
  speed?: number;
  style?: TextStyle;
  baseColor?: string;
  shineColor?: string;
  disabled?: boolean;
}

function ShinyTextWeb({
  children,
  speed = 3,
  style,
  baseColor = 'rgba(255,255,255,0.5)',
  shineColor = '#ffffff',
  disabled = false,
}: ShinyTextProps) {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!injectedRef.current) {
      injectKeyframes();
      injectedRef.current = true;
    }
  }, []);

  const fontSize = style?.fontSize ?? 14;
  const fontWeight = (style?.fontWeight as string | undefined) ?? '400';
  const letterSpacing = style?.letterSpacing ?? 0;
  const textTransform = (style as React.CSSProperties | undefined)?.textTransform ?? 'none';

  if (disabled) {
    return (
      <span
        style={{
          fontSize,
          fontWeight,
          letterSpacing,
          color: baseColor,
          textTransform: textTransform as React.CSSProperties['textTransform'],
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.span
      style={{
        fontSize,
        fontWeight,
        letterSpacing,
        textTransform: textTransform as React.CSSProperties['textTransform'],
        backgroundImage: `linear-gradient(90deg, ${baseColor} 0%, ${baseColor} 35%, ${shineColor} 50%, rgba(147,197,253,0.9) 55%, ${baseColor} 70%, ${baseColor} 100%)`,
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        display: 'inline-block',
        animation: `aspireShimmer ${speed}s linear infinite`,
      } as React.CSSProperties}
    >
      {children}
    </motion.span>
  );
}

function ShinyTextNative({
  children,
  speed = 3,
  style,
  baseColor = 'rgba(255,255,255,0.5)',
  shineColor = '#ffffff',
  disabled = false,
}: ShinyTextProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (disabled) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: (speed * 1000) / 2 }),
        withTiming(0.5, { duration: (speed * 1000) / 2 }),
      ),
      -1,
      false,
    );
  }, [opacity, speed, disabled]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[style, animStyle, { color: disabled ? baseColor : shineColor }]}>
      {children}
    </Animated.Text>
  );
}

function ShinyTextInner(props: ShinyTextProps) {
  if (Platform.OS === 'web') {
    return <ShinyTextWeb {...props} />;
  }
  return <ShinyTextNative {...props} />;
}

export default ShinyText;

export function ShinyText(props: any) {
  return (
    <PageErrorBoundary pageName="shiny-text">
      <ShinyTextInner {...props} />
    </PageErrorBoundary>
  );
}
