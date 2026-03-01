import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface WarningTriangleIconProps {
  size?: number;
  color?: string;
}

/**
 * Warning triangle with exclamation mark.
 * Used in YELLOW tier confirmation modal headers.
 * Canvas Wave 17 — Risk Tier Modals.
 */
export function WarningTriangleIcon({
  size = 24,
  color = '#F59E0B',
}: WarningTriangleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Triangle outline */}
      <Path
        d="M12 2L1 21h22L12 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Exclamation line */}
      <Path
        d="M12 9v5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Exclamation dot */}
      <Path
        d="M12 17.5a1 1 0 100-2 1 1 0 000 2z"
        fill={color}
      />
    </Svg>
  );
}
