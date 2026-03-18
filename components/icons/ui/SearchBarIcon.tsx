import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface SearchBarIconProps {
  size?: number;
  color?: string;
}

function SearchBarIconInner({
  size = 24,
  color = '#6B7280'
}: SearchBarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="10"
        cy="10"
        r="6"
        stroke={color}
        strokeWidth="2"
      />
      <Line
        x1="14.5"
        y1="14.5"
        x2="19"
        y2="19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SearchBarIcon(props: any) {
  return (
    <PageErrorBoundary pageName="search-bar-icon">
      <SearchBarIconInner {...props} />
    </PageErrorBoundary>
  );
}
