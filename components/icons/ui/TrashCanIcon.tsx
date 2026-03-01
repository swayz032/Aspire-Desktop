/**
 * TrashCanIcon -- Premium animated trash can SVG for Canvas Mode.
 *
 * Features:
 * - `lidOpen` prop (0-1) interpolates lid rotation (-5deg to -30deg)
 *   and vertical lift (0px to -8px) for smooth state transitions.
 * - 24x24 viewBox matching existing icon conventions.
 * - Stroke-only rendering for consistent visual weight.
 *
 * Wave 19 -- Canvas drag-delete zone icon.
 */

import React from 'react';
import Svg, { Path, Line, G, Rect } from 'react-native-svg';

interface TrashCanIconProps {
  /** Icon width and height in px (default 24) */
  size?: number;
  /** Stroke color */
  color?: string;
  /** Lid animation factor: 0 = closed (resting), 1 = fully open */
  lidOpen?: number;
  /** Stroke width (default 1.5 for canvas-scale rendering) */
  strokeWidth?: number;
}

export function TrashCanIcon({
  size = 24,
  color = '#FFFFFF',
  lidOpen = 0,
  strokeWidth = 1.5,
}: TrashCanIconProps) {
  // Interpolate lid rotation: -5deg (closed) to -30deg (open)
  const lidRotation = -5 - lidOpen * 25;
  // Interpolate lid vertical lift: 0 (closed) to -3 (open) within viewBox units
  const lidLift = lidOpen * -3;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lid -- rotates around its left-center anchor, lifts on open */}
      <G
        transform={`translate(0, ${lidLift}) rotate(${lidRotation}, 12, 5)`}
      >
        {/* Lid bar */}
        <Rect
          x="6"
          y="3"
          width="12"
          height="3"
          rx="1"
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Lid handle nub */}
        <Line
          x1="10"
          y1="3"
          x2="14"
          y2="3"
          stroke={color}
          strokeWidth={strokeWidth + 0.5}
          strokeLinecap="round"
        />
      </G>

      {/* Can body -- tapered slightly for premium feel */}
      <Path
        d="M7 8h10l-1 13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill="none"
      />

      {/* Vertical delete lines (3 lines for trash indicator) */}
      <Line
        x1="10"
        y1="11"
        x2="10"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="11"
        x2="12"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="14"
        y1="11"
        x2="14"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
