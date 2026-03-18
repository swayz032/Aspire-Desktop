import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface PaidIconProps {
  size?: number;
  color?: string;
}

function PaidIconInner({
  size = 24,
  color = '#10B981'
}: PaidIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled circle */}
      <Circle cx="12" cy="12" r="9" fill={color} opacity="0.2" />
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      {/* Checkmark */}
      <Path
        d="M8 12l3 3 5-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PaidIcon(props: any) {
  return (
    <PageErrorBoundary pageName="paid-icon">
      <PaidIconInner {...props} />
    </PageErrorBoundary>
  );
}
