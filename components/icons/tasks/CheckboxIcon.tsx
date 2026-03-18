import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface CheckboxIconProps {
  size?: number;
  color?: string;
}

function CheckboxIconInner({
  size = 24,
  color = 'rgba(255,255,255,0.4)',
}: CheckboxIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}

export function CheckboxIcon(props: any) {
  return (
    <PageErrorBoundary pageName="checkbox-icon">
      <CheckboxIconInner {...props} />
    </PageErrorBoundary>
  );
}
