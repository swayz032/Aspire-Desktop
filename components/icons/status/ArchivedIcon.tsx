import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ArchivedIconProps {
  size?: number;
  color?: string;
}

function ArchivedIconInner({
  size = 24,
  color = '#6B7280'
}: ArchivedIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Box body */}
      <Rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="1"
        stroke={color}
        strokeWidth="2"
      />
      {/* Box lid */}
      <Path
        d="M2 4h20v3H2V4z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Archive slot */}
      <Path
        d="M10 13h4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ArchivedIcon(props: any) {
  return (
    <PageErrorBoundary pageName="archived-icon">
      <ArchivedIconInner {...props} />
    </PageErrorBoundary>
  );
}
