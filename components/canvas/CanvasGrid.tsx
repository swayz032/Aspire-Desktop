/**
 * CanvasGrid — Premium dot grid background for Canvas Mode workspace.
 *
 * Creates a subtle, fixed-position dot pattern that appears painted ON the
 * #2A2A2A gray canvas surface. Dots are slightly more visible than on black
 * to achieve a premium drafting surface / graph paper feel.
 * Widgets scroll OVER this grid. Responsive grid spacing adjusts per
 * viewport breakpoint for consistent visual density.
 *
 * Quality Standard: $10,000 UI/UX agency grade — Figma workspace / drafting table.
 */

import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Canvas } from '@/constants/tokens';
import Svg, { Defs, Pattern, Rect, Circle } from 'react-native-svg';

interface CanvasGridProps {
  /** Grid dot spacing in pixels — overrides responsive defaults */
  spacing?: number;
  /** Dot color — defaults to Canvas.workspace.dotGridOpacity */
  dotColor?: string;
  /** Dot size in pixels — defaults to 2px diameter */
  dotSize?: number;
}

/**
 * Premium dot grid background — creates the illusion of a physical surface.
 * Grid is fixed to viewport, content scrolls over it.
 */
export function CanvasGrid({
  spacing,
  dotColor = `rgba(255, 255, 255, ${Canvas.workspace.dotGridOpacity})`,
  dotSize = 2,
}: CanvasGridProps): React.ReactElement {
  // Responsive grid spacing (desktop > laptop > tablet)
  const gridSpacing = spacing ?? Canvas.workspace.dotGridSpacing;

  if (Platform.OS === 'web') {
    // Web: Use CSS background-image for performance (no DOM nodes)
    const webGridStyle: ViewStyle = {
      backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize / 2}px, transparent ${dotSize / 2}px)`,
      backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
      backgroundPosition: 'center center',
    } as unknown as ViewStyle;

    return (
      <View
        style={[styles.container, webGridStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  // Native: Use react-native-svg for dot pattern
  return (
    <View
      style={styles.container}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="canvasDotGrid"
            width={gridSpacing}
            height={gridSpacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={gridSpacing / 2}
              cy={gridSpacing / 2}
              r={dotSize / 2}
              fill={dotColor}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#canvasDotGrid)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    // Grid appears fixed to viewport — widgets scroll OVER it
    // z-index 2 sits above base (0) and edge vignette (1)
    position: 'absolute',
  },
});
