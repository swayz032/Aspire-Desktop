import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface InvoiceIconProps {
  size?: number;
  color?: string;
}

export function InvoiceIcon({ size = 28, color = '#FFFFFF' }: InvoiceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"
        stroke={color}
        strokeWidth="1.5"
      />
      <Path d="M14 2v6h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M9 13h6M9 16h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path
        d="M12 7.5v1M12 12v-1m0 0c-.83 0-1.5-.45-1.5-1s.67-1 1.5-1 1.5.45 1.5 1-.67 1-1.5 1z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
