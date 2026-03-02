import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ContractIconProps {
  size?: number;
  color?: string;
}

export function ContractIcon({ size = 28, color = '#FFFFFF' }: ContractIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2h8l4 4v16H6V2z"
        fill={color}
        fillOpacity={0.15}
      />
      <Path
        d="M6 2h8l4 4v16H6V2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path d="M14 2v4h4" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M9 10h6M9 13h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path
        d="M9 17.5c1 .8 2.5-1 3.5 0s2-.8 2.5 0"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
