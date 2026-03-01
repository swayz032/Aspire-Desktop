import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface FinanceIconProps {
  size?: number;
  color?: string;
}

export function FinanceIcon({
  size = 24,
  color = '#10B981'
}: FinanceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="financeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      {/* Ascending graph line */}
      <Path
        d="M3 17l4-4 4 2 6-8 4 3"
        stroke="url(#financeGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Data points */}
      <Path
        d="M3 17a1 1 0 1 0 0 .01M7 13a1 1 0 1 0 0 .01M11 15a1 1 0 1 0 0 .01M17 7a1 1 0 1 0 0 .01M21 10a1 1 0 1 0 0 .01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
