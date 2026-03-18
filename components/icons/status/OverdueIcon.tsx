import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface OverdueIconProps {
  size?: number;
  color?: string;
}

function OverdueIconInner({
  size = 24,
  color = '#EF4444'
}: OverdueIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled triangle */}
      <Path
        d="M12 2L2 20h20L12 2z"
        fill={color}
        opacity="0.2"
      />
      <Path
        d="M12 2L2 20h20L12 2z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Exclamation mark */}
      <Path
        d="M12 9v4"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="16" r="1" fill={color} />
    </Svg>
  );
}

export function OverdueIcon(props: any) {
  return (
    <PageErrorBoundary pageName="overdue-icon">
      <OverdueIconInner {...props} />
    </PageErrorBoundary>
  );
}
