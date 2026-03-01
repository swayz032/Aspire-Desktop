import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface ReceiptIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function ReceiptIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: ReceiptIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Receipt body with torn edge */}
      <Path
        d="M6 2h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20V2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Text lines */}
      <Line x1="9" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="9" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="9" y1="13" x2="12" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Total line */}
      <Line x1="9" y1="16" x2="15" y2="16" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
