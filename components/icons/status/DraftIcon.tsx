import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface DraftIconProps {
  size?: number;
  color?: string;
}

function DraftIconInner({
  size = 24,
  color = '#3B82F6'
}: DraftIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Pencil body */}
      <Path
        d="M16 3l5 5-12 12H4v-5L16 3z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Pencil tip detail */}
      <Path
        d="M13 6l5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Dot for emphasis */}
      <Circle cx="7" cy="17" r="1" fill={color} />
    </Svg>
  );
}

export function DraftIcon(props: any) {
  return (
    <PageErrorBoundary pageName="draft-icon">
      <DraftIconInner {...props} />
    </PageErrorBoundary>
  );
}
