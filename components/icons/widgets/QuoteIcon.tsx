import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface QuoteIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function QuoteIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: QuoteIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Chat bubble */}
      <Path
        d="M3 6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-3l-4 4-4-4H5c-1.1 0-2-.9-2-2V6z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Opening quote */}
      <Path
        d="M8 10c0-1 .5-1.5 1-1.5s1 .5 1 1.5-.5 1.5-1 1.5v1.5"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Closing quote */}
      <Path
        d="M14 10c0-1 .5-1.5 1-1.5s1 .5 1 1.5-.5 1.5-1 1.5v1.5"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
