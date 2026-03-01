import React from 'react';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

interface DoneIconProps {
  size?: number;
  color?: string;
}

export function DoneIcon({
  size = 24,
  color = '#10B981'
}: DoneIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <RadialGradient id="doneGlow" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* Outer glow */}
      <Circle cx="12" cy="12" r="11" fill="url(#doneGlow)" />
      {/* Circle border */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Checkmark */}
      <Path
        d="M8 12l2.5 2.5L16 9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
