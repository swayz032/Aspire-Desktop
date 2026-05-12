/**
 * MaterialsSlotBar — fills the EstimateStudio contextual slot when the active
 * tab is Materials. Renders the warehouse search input + the closest-store
 * card stacked directly under it. The canvas below has no search bar — just
 * results / filters / bundle.
 *
 * Lives in the shell, NOT the canvas. State comes from MaterialsSearchContext.
 *
 * Per user spec: to set or change the project address, the user goes back to
 * the Visuals tab. The Materials tab's slot exposes the warehouse search only.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialsSearchBar } from './MaterialsSearchBar';
import { ClosestStoreCard } from './ClosestStoreCard';
import { RouteMapModal } from './RouteMapModal';
import { useMaterialsSearchContext } from './MaterialsSearchContext';

export function MaterialsSlotBar() {
  const { search } = useMaterialsSearchContext();
  const [routeOpen, setRouteOpen] = useState(false);

  return (
    <View style={styles.wrap} testID="materials-slot-bar">
      <MaterialsSearchBar
        value={search.query}
        onChange={search.setQuery}
        onSubmit={search.submitSearch}
        onClear={search.clearSearch}
        closestStore={search.closestStore}
        onClosestStorePress={() => setRouteOpen(true)}
        isLoading={search.isLoading}
      />
      {search.closestStore && (
        <ClosestStoreCard
          store={search.closestStore}
          onOpenRoute={() => setRouteOpen(true)}
        />
      )}
      <RouteMapModal
        visible={routeOpen}
        onClose={() => setRouteOpen(false)}
        store={search.closestStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
});
