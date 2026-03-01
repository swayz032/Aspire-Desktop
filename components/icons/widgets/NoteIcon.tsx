import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface NoteIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function NoteIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#F59E0B'
}: NoteIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Note body */}
      <Path
        d="M4 2h16v16l-4 4H4V2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Folded corner */}
      <Path
        d="M16 18v4l4-4h-4z"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Text lines */}
      <Line x1="7" y1="7" x2="17" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="7" y1="11" x2="14" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
