import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface StepIconProps {
  size?: number;
  color?: string;
}

export function StepIcon({
  size = 24,
  color = '#3B82F6'
}: StepIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="stepGradient" x1="0%" y1="50%" x2="100%" y2="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {/* Arrow shaft with gradient */}
      <Path
        d="M5 12h14"
        stroke="url(#stepGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Arrow head */}
      <Path
        d="M15 8l4 4-4 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
