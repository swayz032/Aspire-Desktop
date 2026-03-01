import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface PaidIconProps {
  size?: number;
  color?: string;
}

export function PaidIcon({
  size = 24,
  color = '#10B981'
}: PaidIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled circle */}
      <Circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      {/* Checkmark */}
      <Path
        d="M8 12l3 3 5-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
