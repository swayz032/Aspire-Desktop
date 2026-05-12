import React from 'react';
import { Slot } from 'expo-router';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { EstimateStudioShell } from '@/components/service-hub/estimate-studio/EstimateStudioShell';

// Wraps all 6 Estimate Studio tab routes with the persistent workspace chrome
// (top pill nav, header, address bar, tab bar, Tim rail). Each tab route
// renders its own content into <Slot/>.
export default function EstimateStudioLayout() {
  return (
    <ServiceHubShell>
      <EstimateStudioShell>
        <Slot />
      </EstimateStudioShell>
    </ServiceHubShell>
  );
}
