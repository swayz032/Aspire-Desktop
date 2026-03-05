import React from 'react';
import Svg, { Rect, Path, Text as SvgText } from 'react-native-svg';

interface CalendarIconProps {
  size?: number;
  color?: string;
}

export function CalendarIcon({ size = 28, color = '#FFFFFF' }: CalendarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 4h-1V2.5a.5.5 0 00-1 0V4H7V2.5a.5.5 0 00-1 0V4H5a3 3 0 00-3 3v12a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3z"
        fill={color}
      />
      <Path
        d="M2 9h20"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth="2"
      />
      <SvgText
        x="12"
        y="18"
        fill={color}
        fillOpacity={0.35}
        fontSize="8"
        fontWeight="800"
        textAnchor="middle"
      >
        31
      </SvgText>
    </Svg>
  );
}
