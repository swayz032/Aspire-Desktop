import React from 'react';
import Svg, { Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface CheckboxCheckedIconProps {
  size?: number;
  color?: string;
}

export function CheckboxCheckedIcon({
  size = 24,
  color = '#3B82F6',
}: CheckboxCheckedIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="cbFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </LinearGradient>
      </Defs>
      {/* Filled rounded square */}
      <Rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        fill="url(#cbFill)"
      />
      {/* Checkmark */}
      <Path
        d="M8 12l3 3 5-5"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
