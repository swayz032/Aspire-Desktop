import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ToolCallIconProps {
  size?: number;
  color?: string;
}

export function ToolCallIcon({
  size = 24,
  color = '#3B82F6'
}: ToolCallIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Code brackets */}
      <Path
        d="M7 8l-4 4 4 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 8l4 4-4 4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center slash */}
      <Path
        d="M14 6l-4 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </Svg>
  );
}
