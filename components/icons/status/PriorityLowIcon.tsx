import React from 'react';
import Svg, { Line } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface PriorityLowIconProps {
  size?: number;
  color?: string;
}

function PriorityLowIconInner({
  size = 24,
  color = '#6B7280'
}: PriorityLowIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Horizontal line */}
      <Line
        x1="6"
        y1="12"
        x2="18"
        y2="12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PriorityLowIcon(props: any) {
  return (
    <PageErrorBoundary pageName="priority-low-icon">
      <PriorityLowIconInner {...props} />
    </PageErrorBoundary>
  );
}
