import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface PhoneIconProps {
  size?: number;
  color?: string;
}

export function PhoneIcon({ size = 28, color = '#FFFFFF' }: PhoneIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.8 14.2l-1.7-.2a1.2 1.2 0 00-1 .33l-1.2 1.2a9.2 9.2 0 01-4.1-4.1l1.2-1.2a1.2 1.2 0 00.33-1l-.2-1.7A1.2 1.2 0 008.9 6.2H7.7A1.2 1.2 0 006.5 7.5 10.9 10.9 0 0017.5 18.5a1.2 1.2 0 001.2-1.2v-1.2a1.2 1.2 0 00-1.9-.9z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
