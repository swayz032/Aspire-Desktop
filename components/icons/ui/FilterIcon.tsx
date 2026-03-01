import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FilterIconProps {
  size?: number;
  color?: string;
}

export function FilterIcon({
  size = 24,
  color = '#3B82F6'
}: FilterIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Funnel shape */}
      <Path
        d="M4 4h16l-6 8v6l-4 2v-8L4 4z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
