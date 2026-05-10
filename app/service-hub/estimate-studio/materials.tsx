import React from 'react';
import { TabPlaceholder } from '@/components/service-hub/estimate-studio/TabPlaceholder';

export default function MaterialsTab() {
  return (
    <TabPlaceholder
      tabName="Materials"
      phaseN={5}
      icon="cube-outline"
      description="Product cards, supplier matching, RFQ packets. Every price has source + timestamp + location. Phase 5."
    />
  );
}
