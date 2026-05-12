/**
 * MaterialsSlotBar — fills the EstimateStudio contextual slot when the
 * active tab is Materials.
 *
 * Scope (per user spec, 2026-05-12 cleanup):
 *   - Single search input ONLY. No closest-store chip, no route card.
 *   - Drive-time + route map live in the Tim Rail's Context tab
 *     (see MaterialsRouteContextCard).
 *   - To set/change the project address, the user goes back to the
 *     Visuals tab.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialsSearchBar } from './MaterialsSearchBar';
import { useMaterialsSearchContext } from './MaterialsSearchContext';

export function MaterialsSlotBar() {
  const { search } = useMaterialsSearchContext();

  return (
    <View style={styles.wrap} testID="materials-slot-bar">
      <MaterialsSearchBar
        value={search.query}
        onChange={search.setQuery}
        onSubmit={search.submitSearch}
        onClear={search.clearSearch}
        // Closest-store chip suppressed here — that affordance now lives
        // in the Tim Rail Context tab (MaterialsRouteContextCard).
        closestStore={null}
        isLoading={search.isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
});
