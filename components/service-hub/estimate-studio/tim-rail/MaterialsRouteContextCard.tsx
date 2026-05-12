/**
 * MaterialsRouteContextCard — Tim Rail Context-tab card that surfaces the
 * closest Home Depot + drive time + route-map preview for the active
 * project address.
 *
 * Mounted unconditionally inside TimRailContextTab. Returns null when the
 * Materials tab is not active (i.e. the MaterialsSearchProvider is not in
 * the tree above this component) — so it only renders on the Materials
 * route, never on Visuals / Roofing / other tabs.
 *
 * Per user spec (2026-05-12): the closest-store chip and route card were
 * removed from the contextual slot to declutter the search bar. The
 * affordance now lives here, in ambient context territory where Tim's
 * other situational data lives.
 *
 * Aspire Law #7: pure render. Closest store + project address come from
 * the existing useMaterialsSearch + useProjectAddress hooks (read via
 * MaterialsSearchContext + useProjectAddress).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMaterialsSearchContextOptional } from '../materials/MaterialsSearchContext';
import { ClosestStoreCard } from '../materials/ClosestStoreCard';
import { RouteMapModal } from '../materials/RouteMapModal';
import { useProjectAddress } from '@/hooks/useProjectAddress';

export function MaterialsRouteContextCard() {
  const ctx = useMaterialsSearchContextOptional();
  const { address } = useProjectAddress();
  const [routeOpen, setRouteOpen] = useState(false);

  // Off-route: provider not mounted (Visuals / Roofing / other tabs).
  if (!ctx) return null;

  const closestStore = ctx.search.closestStore;

  return (
    <View style={styles.section} testID="tim-context-materials-route">
      <View style={styles.header}>
        <Ionicons name="navigate-circle-outline" size={13} color="rgba(251,191,36,0.85)" />
        <Text style={styles.title}>TODAY&rsquo;S ROUTE</Text>
      </View>

      {closestStore ? (
        <>
          <ClosestStoreCard
            store={closestStore}
            onRoutePress={() => setRouteOpen(true)}
          />
          <Pressable
            onPress={() => setRouteOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open route map"
            testID="tim-context-open-route-map"
            style={({ hovered, pressed }: any) => [
              styles.openMapBtn,
              hovered && styles.openMapBtnHover,
              pressed && styles.openMapBtnPressed,
            ]}
          >
            <Ionicons name="map-outline" size={12} color="rgba(251,191,36,0.92)" />
            <Text style={styles.openMapBtnText}>Open route map</Text>
          </Pressable>
          <RouteMapModal
            visible={routeOpen}
            onClose={() => setRouteOpen(false)}
            projectAddress={address ?? ''}
            store={closestStore}
          />
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.45)" />
          <Text style={styles.emptyText}>
            Run a search to surface the closest Home Depot + drive time.
          </Text>
        </View>
      )}
    </View>
  );
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 180ms ease' } as unknown) as ViewStyle)
    : {};

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.24)',
    ...WEB_TRANSITION,
  },
  openMapBtnHover: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.36)',
  },
  openMapBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  openMapBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(251,191,36,0.95)',
    letterSpacing: -0.1,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  emptyText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 15,
  },
});
