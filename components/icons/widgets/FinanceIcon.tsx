import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface FinanceIconProps {
  size?: number;
  color?: string;
}

function FinanceIconInner({ size = 28, color = '#FFFFFF' }: FinanceIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 20l4-6 4 3 6-10 4 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="3" cy="20" r="1.5" fill={color} />
      <Circle cx="7" cy="14" r="1.5" fill={color} />
      <Circle cx="11" cy="17" r="1.5" fill={color} />
      <Circle cx="17" cy="7" r="1.5" fill={color} />
      <Circle cx="21" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

export function FinanceIcon(props: any) {
  return (
    <PageErrorBoundary pageName="finance-icon">
      <FinanceIconInner {...props} />
    </PageErrorBoundary>
  );
}
