import React from 'react';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface CheckmarkIconProps {
  size?: number;
  color?: string;
}

function CheckmarkIconInner({
  size = 24,
  color = '#3B82F6'
}: CheckmarkIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <RadialGradient id="checkGlow" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="12" cy="12" r="10" fill="url(#checkGlow)" />
      <Path
        d="M7 12l3.5 3.5L17 9"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckmarkIcon(props: any) {
  return (
    <PageErrorBoundary pageName="checkmark-icon">
      <CheckmarkIconInner {...props} />
    </PageErrorBoundary>
  );
}
