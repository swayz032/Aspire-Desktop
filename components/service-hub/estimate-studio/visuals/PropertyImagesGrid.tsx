/**
 * PropertyImagesGrid — bottom card row that drives the hero state machine.
 *
 * Renders 5 PhotoLaneCards in a responsive flex row:
 *   Interior · Exterior · Roof · Street View · Aerial 3D
 *
 * Folding rule: the aggregator already merges Adam-uncategorized photos into
 * the exterior lane server-side, so we use lane counts as-is. The streetView
 * lane on PropertyData carries the static fallback URL only — the live mode
 * uses Maps JS so we surface it as a count-less switcher.
 *
 * Aspire Law #7: pure render. Click → onLaneClick(mode) → parent owns state.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PhotoLaneCard } from './PhotoLaneCard';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';
import type { HeroMode } from '@/hooks/useHeroMode';

interface Props {
  photos?: PropertyData['photos'];
  activeMode?: HeroMode;
  onLaneClick: (mode: HeroMode) => void;
  loading: boolean;
}

export function PropertyImagesGrid({
  photos,
  activeMode = 'streetview',
  onLaneClick,
  loading,
}: Props) {
  return (
    <View style={styles.row} testID="property-images-grid">
      <PhotoLaneCard
        label="Interior"
        icon="bed-outline"
        count={photos?.interior.count}
        thumbnailUrl={photos?.interior.thumbnailUrl}
        onPress={() => onLaneClick('interior')}
        isActive={activeMode === 'interior'}
        loading={loading}
        testID="lane-interior"
      />
      <PhotoLaneCard
        label="Exterior"
        icon="home-outline"
        count={photos?.exterior.count}
        thumbnailUrl={photos?.exterior.thumbnailUrl}
        onPress={() => onLaneClick('exterior')}
        isActive={activeMode === 'exterior'}
        loading={loading}
        testID="lane-exterior"
      />
      <PhotoLaneCard
        label="Roof"
        icon="triangle-outline"
        count={photos?.roof.count}
        thumbnailUrl={photos?.roof.thumbnailUrl}
        onPress={() => onLaneClick('roof')}
        isActive={activeMode === 'roof'}
        loading={loading}
        testID="lane-roof"
      />
      <PhotoLaneCard
        label="Street View"
        icon="walk-outline"
        thumbnailUrl={photos?.streetView.thumbnailUrl}
        onPress={() => onLaneClick('streetview')}
        isActive={activeMode === 'streetview'}
        loading={loading}
        testID="lane-streetview"
      />
      <PhotoLaneCard
        label="Aerial 3D"
        icon="map-outline"
        onPress={() => onLaneClick('aerial')}
        isActive={activeMode === 'aerial'}
        loading={loading}
        testID="lane-aerial"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
