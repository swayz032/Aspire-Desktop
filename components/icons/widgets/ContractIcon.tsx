import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface ContractIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function ContractIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: ContractIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Document */}
      <Path
        d="M6 2h8l4 4v16H6V2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Folded corner */}
      <Path
        d="M14 2v4h4"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Text lines */}
      <Line x1="9" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="9" y1="13" x2="15" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Signature pen */}
      <Path
        d="M8 18l3-3 3 3"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
