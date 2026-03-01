import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface TrashIconProps {
  size?: number;
  color?: string;
  activeColor?: string;
  isActive?: boolean;
}

export function TrashIcon({
  size = 24,
  color = '#6B7280',
  activeColor = '#EF4444',
  isActive = false
}: TrashIconProps) {
  const currentColor = isActive ? activeColor : color;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Trash lid */}
      <Path
        d="M3 6h18"
        stroke={currentColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Trash can body */}
      <Path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        stroke={currentColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <Path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={currentColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Vertical lines */}
      <Line x1="10" y1="10" x2="10" y2="16" stroke={currentColor} strokeWidth="2" strokeLinecap="round" />
      <Line x1="14" y1="10" x2="14" y2="16" stroke={currentColor} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
