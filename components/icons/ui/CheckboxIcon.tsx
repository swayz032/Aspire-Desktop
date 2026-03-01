import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface CheckboxIconProps {
  size?: number;
  color?: string;
}

export function CheckboxIcon({
  size = 24,
  color = 'rgba(255,255,255,0.3)'
}: CheckboxIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Empty rounded square */}
      <Rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}
