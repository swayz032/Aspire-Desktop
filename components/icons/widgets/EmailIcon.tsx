import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface EmailIconProps {
  size?: number;
  color?: string;
}

export function EmailIcon({ size = 28, color = '#FFFFFF' }: EmailIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.5 6.72A3.5 3.5 0 0019 4H5A3.5 3.5 0 001.5 6.72l9.67 6.04a1 1 0 001.06 0L22.5 6.72z"
        fill={color}
      />
      <Path
        d="M1.5 8.86V17A3.5 3.5 0 005 20.5h14A3.5 3.5 0 0022.5 17V8.86l-9.11 5.69a2.5 2.5 0 01-2.78 0L1.5 8.86z"
        fill={color}
      />
    </Svg>
  );
}
