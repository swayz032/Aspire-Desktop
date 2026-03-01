import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface ThinkingIconProps {
  size?: number;
  color?: string;
}

export function ThinkingIcon({
  size = 24,
  color = '#3B82F6'
}: ThinkingIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="thinkingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
      </Defs>
      {/* Brain outline with curves */}
      <Path
        d="M12 3c-2.5 0-4.5 1.5-5.5 3.5C5.5 7 5 8 5 9.5c0 1 .3 2 1 2.8 0 .7.2 1.4.5 2 .3.6.7 1.2 1.2 1.7.5.5 1 .8 1.6 1 .6.2 1.2.3 1.9.3h1.6c.7 0 1.3-.1 1.9-.3.6-.2 1.1-.5 1.6-1 .5-.5.9-1.1 1.2-1.7.3-.6.5-1.3.5-2 .7-.8 1-1.8 1-2.8 0-1.5-.5-2.5-1.5-3C17.5 4.5 15.5 3 13 3h-1z"
        stroke="url(#thinkingGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner detail curves */}
      <Path
        d="M9 10c.5-.5 1-.8 1.5-.8M14 10c-.5-.5-1-.8-1.5-.8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </Svg>
  );
}
