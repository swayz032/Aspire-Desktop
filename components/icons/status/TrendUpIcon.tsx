import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface TrendUpIconProps {
  size?: number;
  color?: string;
}

export function TrendUpIcon({
  size = 24,
  color = '#10B981'
}: TrendUpIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Ascending trend line */}
      <Path
        d="M7 17l5-5 3 3 5-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head at top-right */}
      <Path
        d="M16 10h4v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
