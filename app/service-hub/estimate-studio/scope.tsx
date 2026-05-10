import React from 'react';
import { TabPlaceholder } from '@/components/service-hub/estimate-studio/TabPlaceholder';

export default function ScopeTab() {
  return (
    <TabPlaceholder
      tabName="Scope"
      phaseN={7}
      icon="list-outline"
      description="Package decision board — Included Work, Not in Base Scope, Missing Inputs, Alternates. Delivery model alignment. Phase 7."
    />
  );
}
