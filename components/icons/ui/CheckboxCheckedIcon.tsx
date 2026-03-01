import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

interface CheckboxCheckedIconProps {
  size?: number;
  color?: string;
}

export function CheckboxCheckedIcon({
  size = 24,
  color = '#3B82F6'
}: CheckboxCheckedIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled rounded square */}
      <Rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        fill={color}
      />
      {/* White checkmark */}
      <Path
        d="M8 12l3 3 5-6"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
