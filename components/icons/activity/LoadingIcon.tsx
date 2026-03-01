import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LoadingIconProps {
  size?: number;
  color?: string;
}

export function LoadingIcon({
  size = 24,
  color = '#3B82F6'
}: LoadingIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="loadingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </LinearGradient>
      </Defs>
      {/* Spinning arc - 270 degrees */}
      <Path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="url(#loadingGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tail arc for depth */}
      <Path
        d="M22 12a10 10 0 0 1-2 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </Svg>
  );
}
