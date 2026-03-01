import React from 'react';
import Svg, { Line } from 'react-native-svg';

interface PriorityLowIconProps {
  size?: number;
  color?: string;
}

export function PriorityLowIcon({
  size = 24,
  color = '#6B7280'
}: PriorityLowIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Horizontal line */}
      <Line
        x1="6"
        y1="12"
        x2="18"
        y2="12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
