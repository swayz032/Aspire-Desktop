import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface NoteIconProps {
  size?: number;
  color?: string;
}

export function NoteIcon({ size = 28, color = '#FFFFFF' }: NoteIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 3a1 1 0 011-1h14a1 1 0 011 1v14l-5 5H5a1 1 0 01-1-1V3z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path d="M15 17v5l5-5h-5z" fill={color} fillOpacity={0.35} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M8 7h8M8 11h6M8 15h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
