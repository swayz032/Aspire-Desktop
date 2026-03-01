import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

interface TaskIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function TaskIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: TaskIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Checkboxes */}
      <Rect x="4" y="5" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.5" />
      <Rect x="4" y="11" width="3" height="3" rx="0.5" stroke={color} strokeWidth="1.5" />
      <Rect x="4" y="17" width="3" height="3" rx="0.5" stroke={accentColor} strokeWidth="1.5" />

      {/* Text lines */}
      <Path d="M9 6.5h11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M9 12.5h11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M9 18.5h11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

      {/* Check in third box */}
      <Path
        d="M4.5 18l.7.7L6.5 17"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
