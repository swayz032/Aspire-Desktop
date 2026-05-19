/**
 * ResidentialBlueprintMode — Wave 8.
 *
 * Simpler variant of CommercialBlueprintMode — same 4 cards + chip
 * structure but the symbol legend is pre-filtered to residential defaults
 * (the LEGEND entries flagged `residential: true` in symbolClasses).
 */
import React from 'react';
import type { BlueprintSheet } from '@/lib/api/blueprintsApi';
import { CommercialBlueprintMode } from './CommercialBlueprintMode';
import type { TakeoffSharedState } from './takeoffShared';

interface Props {
  state: TakeoffSharedState;
  sheets: BlueprintSheet[];
}

export function ResidentialBlueprintMode({ state, sheets }: Props): React.ReactElement {
  // Reuse the commercial mode body — residential differs only in the
  // legend filter (and, downstream, in default symbol palette which lives
  // in the legend).
  return <CommercialBlueprintMode state={state} sheets={sheets} residentialLegend />;
}
