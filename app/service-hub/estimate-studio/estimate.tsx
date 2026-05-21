/**
 * Estimate route — Wave 15.
 *
 * Mounts the EstimateTab orchestrator. The Tim Rail Context tab is mounted
 * separately by the Estimate Studio shell (TimRailContextTab.tsx) and
 * routes-detects this path to render EstimateContextPayload.
 */
import React from 'react';
import { EstimateTab } from '@/components/service-hub/estimate-studio/estimate/EstimateTab';

export default function EstimateRoute(): React.ReactElement {
  return <EstimateTab />;
}
