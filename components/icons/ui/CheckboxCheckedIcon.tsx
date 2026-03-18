import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface CheckboxCheckedIconProps {
  size?: number;
  color?: string;
}

function CheckboxCheckedIconInner({
  size = 24,
  color = '#3B82F6'
}: CheckboxCheckedIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled rounded square */}
      <Rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        fill={color}
      />
      {/* White checkmark */}
      <Path
        d="M8 12l3 3 5-6"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckboxCheckedIcon(props: any) {
  return (
    <PageErrorBoundary pageName="checkbox-checked-icon">
      <CheckboxCheckedIconInner {...props} />
    </PageErrorBoundary>
  );
}
