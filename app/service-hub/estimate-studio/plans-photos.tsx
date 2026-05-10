import React from 'react';
import { TabPlaceholder } from '@/components/service-hub/estimate-studio/TabPlaceholder';

export default function PlansPhotosTab() {
  return (
    <TabPlaceholder
      tabName="Plans & Photos"
      phaseN={4}
      icon="document-attach-outline"
      description="Evidence intake — plans, sheets, photos, submittals. Discipline auto-detection. Push to Scope or Takeoff. Phase 4."
    />
  );
}
