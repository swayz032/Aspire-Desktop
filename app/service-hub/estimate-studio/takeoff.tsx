import React from 'react';
import { TabPlaceholder } from '@/components/service-hub/estimate-studio/TabPlaceholder';

export default function TakeoffTab() {
  return (
    <TabPlaceholder
      tabName="Takeoff"
      phaseN={6}
      icon="grid-outline"
      description="Four modes — Commercial Blueprint, Residential Blueprint, Smart Room Reconstruction, Roofing Mode (Phase 8 deepest workstream). Phase 6."
    />
  );
}
