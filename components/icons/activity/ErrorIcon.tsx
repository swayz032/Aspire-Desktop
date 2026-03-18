import React from 'react';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ErrorIconProps {
  size?: number;
  color?: string;
}

function ErrorIconInner({
  size = 24,
  color = '#EF4444'
}: ErrorIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <RadialGradient id="errorGlow" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="12" cy="12" r="10" fill="url(#errorGlow)" />
      <Path
        d="M8 8l8 8M16 8l-8 8"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ErrorIcon(props: any) {
  return (
    <PageErrorBoundary pageName="error-icon">
      <ErrorIconInner {...props} />
    </PageErrorBoundary>
  );
}
