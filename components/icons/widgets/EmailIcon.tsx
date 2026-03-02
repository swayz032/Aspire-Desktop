import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface EmailIconProps {
  size?: number;
  color?: string;
}

export function EmailIcon({ size = 28, color = '#FFFFFF' }: EmailIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="4" width="20" height="16" rx="3" fill={color} fillOpacity={0.15} />
      <Rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="1.5" />
      <Path
        d="M2 7.5l8.9 5.3a2 2 0 002.2 0L22 7.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
