import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ResizeIconProps {
  size?: number;
  color?: string;
}

function ResizeIconInner({
  size = 24,
  color = '#3B82F6'
}: ResizeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Diagonal arrows */}
      <Path
        d="M15 3h6v6M3 9V3h6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 21H3v-6M21 15v6h-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corner connectors */}
      <Path
        d="M21 3l-7 7M3 21l7-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </Svg>
  );
}

export function ResizeIcon(props: any) {
  return (
    <PageErrorBoundary pageName="resize-icon">
      <ResizeIconInner {...props} />
    </PageErrorBoundary>
  );
}
