import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface DragHandleIconProps {
  size?: number;
  color?: string;
}

export function DragHandleIcon({
  size = 24,
  color = '#6B7280'
}: DragHandleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 6 dots in 2 rows of 3 */}
      <Circle cx="8" cy="9" r="1.5" fill={color} />
      <Circle cx="12" cy="9" r="1.5" fill={color} />
      <Circle cx="16" cy="9" r="1.5" fill={color} />
      <Circle cx="8" cy="15" r="1.5" fill={color} />
      <Circle cx="12" cy="15" r="1.5" fill={color} />
      <Circle cx="16" cy="15" r="1.5" fill={color} />
    </Svg>
  );
}
