import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface XCircleIconProps {
  size?: number;
  color?: string;
}

export function XCircleIcon({
  size = 24,
  color = '#EF4444',
}: XCircleIconProps) {
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
        d="M9 9l6 6M15 9l-6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
