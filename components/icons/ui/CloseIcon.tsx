import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface CloseIconProps {
  size?: number;
  color?: string;
}

function CloseIconInner({
  size = 24,
  color = '#FFFFFF'
}: CloseIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon(props: any) {
  return (
    <PageErrorBoundary pageName="close-icon">
      <CloseIconInner {...props} />
    </PageErrorBoundary>
  );
}
