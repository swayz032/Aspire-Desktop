import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ShieldXIconProps {
  size?: number;
  color?: string;
}

export function ShieldXIcon({
  size = 24,
  color = '#EF4444'
}: ShieldXIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outline */}
      <Path
        d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* X cross inside shield */}
      <Path
        d="M9.5 9.5l5 5M14.5 9.5l-5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
