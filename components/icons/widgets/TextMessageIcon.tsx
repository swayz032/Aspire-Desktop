import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface TextMessageIconProps {
  size?: number;
  color?: string;
}

export function TextMessageIcon({ size = 28, color = '#FFFFFF' }: TextMessageIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="14" rx="4" fill={color} fillOpacity={0.15} />
      <Path
        d="M7 9h10M7 12h7M9 18l-3 2v-2.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="3" y="4" width="18" height="14" rx="4" stroke={color} strokeWidth="1.4" />
    </Svg>
  );
}

