import React, { useMemo, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import type { CSSProperties } from 'react';
import { Colors } from '@/constants/tokens';

/**
 * ShimmeringText — a living status indicator for AI processing states.
 *
 * Uses CSS `background-clip: text` with an animated gradient position
 * to create a luminous shimmer effect that sweeps across the text.
 * Web-only (Expo web / Electron). Falls back to static text on native.
 *
 * Design tokens:
 *   Base color:    Colors.text.muted (#6e6e73)
 *   Shimmer color: Colors.accent.cyan (#3B82F6)
 */

interface ShimmeringTextProps {
  /** The text content to render with the shimmer effect */
  text: string;
  /** Duration of one shimmer sweep in seconds (default: 2) */
  duration?: number;
  /** Delay before first animation in seconds (default: 0) */
  delay?: number;
  /** Whether the shimmer repeats infinitely (default: true) */
  repeat?: boolean;
  /** Pause between repeats in seconds (default: 0.5) */
  repeatDelay?: number;
  /** Additional CSS class name(s) */
  className?: string;
  /** Only animate when the element scrolls into view (default: true) */
  startOnView?: boolean;
  /** Fire the in-view trigger only once (default: false) */
  once?: boolean;
  /** Viewport margin for in-view detection */
  inViewMargin?: string;
  /** Shimmer width multiplier per character (default: 2) */
  spread?: number;
  /** Base text color when not shimmering (default: Colors.text.muted) */
  color?: string;
  /** Color of the shimmer highlight sweep (default: Colors.accent.cyan) */
  shimmerColor?: string;
  /** Additional inline styles for font size, weight, etc. */
  style?: CSSProperties;
}

export function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
  style: extraStyle,
}: ShimmeringTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, margin: inViewMargin as any });

  // Scale shimmer width to text length for consistent visual density
  const dynamicSpread = useMemo(() => text.length * spread, [text, spread]);
  const shouldAnimate = !startOnView || isInView;

  const baseColor = color || Colors.text.muted;
  const highlightColor = shimmerColor || Colors.accent.cyan;

  const combinedStyle: CSSProperties = {
    // Token-driven CSS custom properties
    '--spread': `${dynamicSpread}px`,
    '--base-color': baseColor,
    '--shimmer-color': highlightColor,
    // Gradient: a narrow bright band over a solid base fill
    backgroundImage: [
      `linear-gradient(90deg, transparent calc(50% - var(--spread)), var(--shimmer-color), transparent calc(50% + var(--spread)))`,
      `linear-gradient(var(--base-color), var(--base-color))`,
    ].join(', '),
    backgroundSize: '250% 100%, auto',
    backgroundRepeat: 'no-repeat, padding-box',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    display: 'inline-block',
    position: 'relative',
    // Merge any caller-provided styles (fontSize, fontWeight, etc.)
    ...extraStyle,
  } as CSSProperties;

  return (
    <motion.span
      ref={ref}
      className={className}
      style={combinedStyle}
      initial={{ backgroundPosition: '100% center', opacity: 0 }}
      animate={shouldAnimate ? { backgroundPosition: '0% center', opacity: 1 } : {}}
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: 'linear',
        },
        opacity: { duration: 0.3, delay },
      }}
      aria-label={text}
      role="status"
    >
      {text}
    </motion.span>
  );
}
