import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ReceiptIconProps {
  size?: number;
  color?: string;
}

export function ReceiptIcon({ size = 28, color = '#FFFFFF' }: ReceiptIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 2h14v20l-2.5-1.5L14 22l-2-1.5L10 22l-2.5-1.5L5 22V2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path d="M8 7h8M8 10.5h8M8 14h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M14 14h2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
