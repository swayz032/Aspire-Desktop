import React from 'react';
import Svg, { Rect, Path, Text as SvgText } from 'react-native-svg';

interface CalendarIconProps {
  size?: number;
  color?: string;
}

export function CalendarIcon({ size = 28, color = '#FFFFFF' }: CalendarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="3" fill={color} fillOpacity={0.15} />
      <Rect x="3" y="4" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" />
      <Path d="M3 9h18" stroke={color} strokeWidth="1.5" />
      <Path d="M8 2.5v3M16 2.5v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <SvgText
        x="12"
        y="17.5"
        fill={color}
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
      >
        17
      </SvgText>
    </Svg>
  );
}
