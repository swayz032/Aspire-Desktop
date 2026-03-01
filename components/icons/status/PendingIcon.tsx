import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface PendingIconProps {
  size?: number;
  color?: string;
}

export function PendingIcon({
  size = 24,
  color = '#F59E0B'
}: PendingIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled circle */}
      <Circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      {/* Clock hands */}
      <Path
        d="M12 7v5l3 3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
