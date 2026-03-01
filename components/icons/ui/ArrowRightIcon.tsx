import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ArrowRightIconProps {
  size?: number;
  color?: string;
}

export function ArrowRightIcon({
  size = 24,
  color = 'rgba(255,255,255,0.3)'
}: ArrowRightIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M12 5l7 7-7 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
