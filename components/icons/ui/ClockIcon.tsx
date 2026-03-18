import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ClockIconProps {
  size?: number;
  color?: string;
}

function ClockIconInner({
  size = 24,
  color = '#FBB924'
}: ClockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M12 6v6l4 2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon(props: any) {
  return (
    <PageErrorBoundary pageName="clock-icon">
      <ClockIconInner {...props} />
    </PageErrorBoundary>
  );
}
