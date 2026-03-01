import React from 'react';
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SearchIconProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export function SearchIcon({
  size = 24,
  color = '#FFFFFF',
  accentColor = '#3B82F6'
}: SearchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="searchAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity="1" />
          <Stop offset="100%" stopColor={accentColor} stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      <Circle
        cx="10"
        cy="10"
        r="6"
        stroke={color}
        strokeWidth="2"
      />
      <Line
        x1="14.5"
        y1="14.5"
        x2="19"
        y2="19"
        stroke="url(#searchAccent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
