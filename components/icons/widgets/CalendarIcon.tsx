import React from 'react';
import Svg, { Rect, Line, Circle } from 'react-native-svg';

interface CalendarIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function CalendarIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: CalendarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Calendar body */}
      <Rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      {/* Top bar */}
      <Line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="2" />
      {/* Hangers */}
      <Line x1="7" y1="3" x2="7" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="17" y1="3" x2="17" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Today dot */}
      <Circle cx="12" cy="15" r="2" fill={accentColor} />
    </Svg>
  );
}
