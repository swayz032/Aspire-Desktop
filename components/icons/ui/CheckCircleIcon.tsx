import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface CheckCircleIconProps {
  size?: number;
  color?: string;
}

export function CheckCircleIcon({
  size = 24,
  color = '#10B981'
}: CheckCircleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M8 12l2 2 4-4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
