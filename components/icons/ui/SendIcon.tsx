import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface SendIconProps {
  size?: number;
  color?: string;
}

function SendIconInner({
  size = 24,
  color = '#3B82F6'
}: SendIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2L11 13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SendIcon(props: any) {
  return (
    <PageErrorBoundary pageName="send-icon">
      <SendIconInner {...props} />
    </PageErrorBoundary>
  );
}
