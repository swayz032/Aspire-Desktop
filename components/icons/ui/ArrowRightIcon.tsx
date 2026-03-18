import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface ArrowRightIconProps {
  size?: number;
  color?: string;
}

function ArrowRightIconInner({
  size = 24,
  color = 'rgba(255,255,255,0.3)'
}: ArrowRightIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M12 5l7 7-7 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ArrowRightIcon(props: any) {
  return (
    <PageErrorBoundary pageName="arrow-right-icon">
      <ArrowRightIconInner {...props} />
    </PageErrorBoundary>
  );
}
