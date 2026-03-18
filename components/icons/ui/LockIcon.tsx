import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface LockIconProps {
  size?: number;
  color?: string;
}

/**
 * Padlock icon for secure action indicators.
 * Used optionally in RED tier authority modals.
 * Canvas Wave 17 — Risk Tier Modals.
 */
function LockIconInner({
  size = 20,
  color = '#FFFFFF',
}: LockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lock body */}
      <Rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      {/* Lock shackle */}
      <Path
        d="M8 11V7a4 4 0 018 0v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockIcon(props: any) {
  return (
    <PageErrorBoundary pageName="lock-icon">
      <LockIconInner {...props} />
    </PageErrorBoundary>
  );
}
