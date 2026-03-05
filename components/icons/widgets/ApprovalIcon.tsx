import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ApprovalIconProps {
  size?: number;
  color?: string;
}

export function ApprovalIcon({ size = 28, color = '#FFFFFF' }: ApprovalIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L3 6.5V12c0 5.25 3.83 10.15 9 11.35C17.17 22.15 21 17.25 21 12V6.5L12 2z"
        fill={color}
      />
      <Path
        d="M8.5 12l2.5 2.5 4.5-5"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
