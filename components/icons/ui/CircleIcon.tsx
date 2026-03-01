import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface CircleIconProps {
  size?: number;
  color?: string;
}

export function CircleIcon({
  size = 24,
  color = 'rgba(255,255,255,0.3)'
}: CircleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}
