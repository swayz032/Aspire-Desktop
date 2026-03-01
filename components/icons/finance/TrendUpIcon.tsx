import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface TrendUpIconProps {
  size?: number;
  color?: string;
}

export function TrendUpIcon({
  size = 24,
  color = '#10B981',
}: TrendUpIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="trendUpGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {/* Upward trend line */}
      <Path
        d="M4 18L10 12L14 16L20 6"
        stroke="url(#trendUpGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head */}
      <Path
        d="M16 6H20V10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
