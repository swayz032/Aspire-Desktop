import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface TrendDownIconProps {
  size?: number;
  color?: string;
}

export function TrendDownIcon({
  size = 24,
  color = '#EF4444'
}: TrendDownIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Descending trend line */}
      <Path
        d="M7 7l5 5 3-3 5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head at bottom-right */}
      <Path
        d="M16 14h4v-4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
