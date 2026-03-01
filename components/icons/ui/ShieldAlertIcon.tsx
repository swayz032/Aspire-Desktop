import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ShieldAlertIconProps {
  size?: number;
  color?: string;
}

/**
 * Shield with exclamation mark.
 * Used in RED tier authority modal action titles.
 * Canvas Wave 17 — Risk Tier Modals.
 */
export function ShieldAlertIcon({
  size = 24,
  color = '#EF4444',
}: ShieldAlertIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outline */}
      <Path
        d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Exclamation line */}
      <Path
        d="M12 8v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Exclamation dot */}
      <Path
        d="M12 15.5a1 1 0 100-2 1 1 0 000 2z"
        fill={color}
      />
    </Svg>
  );
}
