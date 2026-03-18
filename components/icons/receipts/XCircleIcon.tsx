import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface XCircleIconProps {
  size?: number;
  color?: string;
}

function XCircleIconInner({
  size = 24,
  color = '#EF4444',
}: XCircleIconProps) {
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
        d="M9 9l6 6M15 9l-6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function XCircleIcon(props: any) {
  return (
    <PageErrorBoundary pageName="x-circle-icon">
      <XCircleIconInner {...props} />
    </PageErrorBoundary>
  );
}
