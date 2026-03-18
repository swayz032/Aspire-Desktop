import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface QuoteIconProps {
  size?: number;
  color?: string;
}

function QuoteIconInner({ size = 28, color = '#FFFFFF' }: QuoteIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-4l-4 4v-4H6a2 2 0 01-2-2V5z"
        stroke={color}
        strokeWidth="1.5"
      />
      <Path
        d="M8.5 8.5c0-.83.67-1.5 1.5-1.5v2c-.83 0-1.5-.17-1.5-.5zM8.5 11v1"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M13.5 8.5c0-.83.67-1.5 1.5-1.5v2c-.83 0-1.5-.17-1.5-.5zM13.5 11v1"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function QuoteIcon(props: any) {
  return (
    <PageErrorBoundary pageName="quote-icon">
      <QuoteIconInner {...props} />
    </PageErrorBoundary>
  );
}
