import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface TextMessageIconProps {
  size?: number;
  color?: string;
}

export function TextMessageIcon({ size = 28, color = '#FFFFFF' }: TextMessageIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 2H4a2 2 0 00-2 2v12a2 2 0 002 2h3v4l5-4h8a2 2 0 002-2V4a2 2 0 00-2-2z"
        fill={color}
      />
      <Path
        d="M7 9h10M7 12.5h6"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
