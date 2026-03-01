import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SignedIconProps {
  size?: number;
  color?: string;
}

export function SignedIcon({
  size = 24,
  color = '#10B981'
}: SignedIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Signature curve */}
      <Path
        d="M3 15c2-4 4-6 6-5 2 1 1 4 3 5 2 1 4-1 6-3 2-2 3-3 3-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark accent */}
      <Path
        d="M17 17l2 2 3-3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
