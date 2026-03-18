import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface InfoIconProps {
  size?: number;
  color?: string;
}

function InfoIconInner({
  size = 24,
  color = '#3B82F6'
}: InfoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Circle border */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="2"
      />
      {/* Dot on top */}
      <Circle
        cx="12"
        cy="8"
        r="1"
        fill={color}
      />
      {/* Vertical line */}
      <Line
        x1="12"
        y1="11"
        x2="12"
        y2="16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function InfoIcon(props: any) {
  return (
    <PageErrorBoundary pageName="info-icon">
      <InfoIconInner {...props} />
    </PageErrorBoundary>
  );
}
