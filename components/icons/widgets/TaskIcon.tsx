import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface TaskIconProps {
  size?: number;
  color?: string;
}

function TaskIconInner({ size = 28, color = '#FFFFFF' }: TaskIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="5" height="5" rx="1.5" fill={color} fillOpacity={0.2} stroke={color} strokeWidth="1.2" />
      <Rect x="4" y="10" width="5" height="5" rx="1.5" fill={color} fillOpacity={0.2} stroke={color} strokeWidth="1.2" />
      <Rect x="4" y="16" width="5" height="5" rx="1.5" fill={color} stroke={color} strokeWidth="1.2" />
      <Path d="M5 18l1.5 1.5L8.5 17" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11 6.5h9M11 12.5h9M11 18.5h7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function TaskIcon(props: any) {
  return (
    <PageErrorBoundary pageName="task-icon">
      <TaskIconInner {...props} />
    </PageErrorBoundary>
  );
}
