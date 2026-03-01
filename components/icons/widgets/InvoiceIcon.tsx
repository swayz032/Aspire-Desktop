import React from 'react';
import Svg, { Path, Line, Circle } from 'react-native-svg';

interface InvoiceIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function InvoiceIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#F59E0B'
}: InvoiceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Document outline */}
      <Path
        d="M6 2h12v20H6V2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Lines */}
      <Line x1="9" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="9" y1="11" x2="15" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Dollar sign */}
      <Path
        d="M12 14v1.5M12 14c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5M12 20v-1.5"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
