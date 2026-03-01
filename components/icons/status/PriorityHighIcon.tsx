import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface PriorityHighIconProps {
  size?: number;
  color?: string;
}

export function PriorityHighIcon({
  size = 24,
  color = '#EF4444'
}: PriorityHighIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="priorityGradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      {/* Exclamation line */}
      <Path
        d="M12 4v10"
        stroke="url(#priorityGradient)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Exclamation dot */}
      <Circle cx="12" cy="18" r="1.5" fill={color} />
    </Svg>
  );
}
