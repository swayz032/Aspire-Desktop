import React from 'react';
import { Platform } from 'react-native';
import { GreetingCard } from './GreetingCard';
import { HealthScoreRing } from './HealthScoreRing';
import { FinnDailyBrief } from './FinnDailyBrief';
import type { StoryModeId } from './StoryModeCarousel';

interface FinanceRightRailProps {
  ownerName: string;
  connectedCount: number;
  mismatchCount: number;
  cashRunwayDays: number;
  activeMode: StoryModeId;
  accentColor: string;
  imageUrl?: string;
  onAskFinn: () => void;
}

export function FinanceRightRail({
  ownerName,
  connectedCount,
  mismatchCount,
  cashRunwayDays,
  activeMode,
  accentColor,
  imageUrl,
  onAskFinn,
}: FinanceRightRailProps) {
  if (Platform.OS !== 'web') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <GreetingCard
        ownerName={ownerName}
        accentColor={accentColor}
        imageUrl={imageUrl}
      />
      <HealthScoreRing
        connectedCount={connectedCount}
        mismatchCount={mismatchCount}
        cashRunwayDays={cashRunwayDays}
        accentColor={accentColor}
      />
      <FinnDailyBrief
        activeMode={activeMode}
        accentColor={accentColor}
        onAskFinn={onAskFinn}
      />
    </div>
  );
}
