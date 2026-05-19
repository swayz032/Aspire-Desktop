import React from 'react';
import { ScopeTab } from '@/components/service-hub/estimate-studio/scope/ScopeTab';

/**
 * Scope tab route (Wave 7).
 *
 * Delegates to <ScopeTab /> — the canvas-card shell that hosts Story,
 * Included Work, Not in Base, Missing Inputs, Alternates, and Tariff
 * Exposure cards.
 */
export default function ScopeRoute(): React.ReactElement {
  return <ScopeTab />;
}
