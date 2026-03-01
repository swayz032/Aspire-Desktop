import React from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';

interface MediumPriorityIconProps {
  size?: number;
  color?: string;
}

export function MediumPriorityIcon({
  size = 24,
  color = '#FBB924',
}: MediumPriorityIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Circle outline */}
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
      />
      {/* Minus bar */}
      <Rect
        x="7"
        y="11"
        width="10"
        height="2"
        rx="1"
        fill={color}
      />
    </Svg>
  );
}
