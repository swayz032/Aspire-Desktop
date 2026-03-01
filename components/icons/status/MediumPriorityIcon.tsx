import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

interface MediumPriorityIconProps {
  size?: number;
  color?: string;
}

export function MediumPriorityIcon({
  size = 24,
  color = '#F59E0B'
}: MediumPriorityIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled circle background */}
      <Circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
      {/* Circle outline */}
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      {/* Horizontal minus line */}
      <Line
        x1="8"
        y1="12"
        x2="16"
        y2="12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
