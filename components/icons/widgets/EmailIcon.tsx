import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface EmailIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function EmailIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: EmailIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Envelope body */}
      <Rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      {/* Envelope flap */}
      <Path
        d="M3 7l9 6 9-6"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
