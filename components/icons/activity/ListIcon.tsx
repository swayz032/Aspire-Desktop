import React from 'react';
import Svg, { Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ListIconProps {
  size?: number;
  color?: string;
  glowColor?: string;
}

function ListIconInner({
  size = 24,
  color = '#FFFFFF',
  glowColor = '#3B82F6'
}: ListIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <RadialGradient id="listGlow" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={glowColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ListIcon(props: any) {
  return (
    <PageErrorBoundary pageName="list-icon">
      <ListIconInner {...props} />
    </PageErrorBoundary>
  );
}
