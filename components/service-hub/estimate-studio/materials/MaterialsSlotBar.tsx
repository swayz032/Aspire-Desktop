/**
 * MaterialsSlotBar — fills the EstimateStudio contextual slot when the
 * active tab is Materials.
 *
 * Pass E additions:
 *   - MaterialsModeToggle (Tool ↔ Supplier) renders to the LEFT of the
 *     search input on >= 1100px viewports, and wraps BELOW on tablets.
 *   - Search placeholder adapts to mode (tool vs supplier).
 *   - When an auto-flip was just triggered by a keyword match, render a
 *     one-line chip below the slot bar offering "switch back to Tool".
 *
 * Scope:
 *   - Single search input ONLY. No closest-store chip, no route card.
 *   - Drive-time + route map live in the Tim Rail's Context tab.
 *   - To set/change the project address, the user goes back to Visuals.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialsSearchBar } from './MaterialsSearchBar';
import { MaterialsModeToggle } from './MaterialsModeToggle';
import { useMaterialsSearchContext } from './MaterialsSearchContext';

const TOOL_PLACEHOLDER = 'Search materials — paint, drywall, romex, shingles…';
const SUPPLIER_PLACEHOLDER = 'Search suppliers — precast, concrete by yard, lumber wholesale…';

const TABLET_BREAKPOINT = 1100;

export function MaterialsSlotBar() {
  const { search, mode, autoFlipKeyword, clearAutoFlip } = useMaterialsSearchContext();
  const { width } = useWindowDimensions();
  const stackVertical = width < TABLET_BREAKPOINT;

  const placeholder = mode === 'supplier' ? SUPPLIER_PLACEHOLDER : TOOL_PLACEHOLDER;

  return (
    <View style={styles.wrap} testID="materials-slot-bar">
      <View style={[styles.row, stackVertical && styles.rowStacked]}>
        <View style={stackVertical ? styles.toggleRowStacked : styles.toggleRow}>
          <MaterialsModeToggle />
        </View>
        <View style={styles.searchRow}>
          <MaterialsSearchBar
            value={search.query}
            onChange={search.setQuery}
            onSubmit={search.submitSearch}
            onClear={search.clearSearch}
            closestStore={null}
            isLoading={search.isLoading}
            placeholder={placeholder}
          />
        </View>
      </View>

      {autoFlipKeyword && (
        <Pressable
          onPress={clearAutoFlip}
          style={({ hovered, pressed }: any) => [
            styles.autoFlipChip,
            hovered && styles.autoFlipChipHovered,
            pressed && styles.autoFlipChipPressed,
            Platform.OS === 'web'
              ? ({ transition: 'all 200ms ease' } as any)
              : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Auto-switched to Supplier mode after detecting ${autoFlipKeyword}. Tap to switch back to Tool mode.`}
          testID="materials-mode-autoflip-chip"
        >
          <Ionicons name="sparkles-outline" size={11} color="#fbbf24" />
          <Text style={styles.autoFlipChipText}>
            Supplier mode (<Text style={styles.autoFlipChipKeyword}>{autoFlipKeyword}</Text> detected)
          </Text>
          <View style={styles.autoFlipChipDivider} />
          <Text style={styles.autoFlipChipRevert}>switch back to Tool</Text>
          <Ionicons name="close" size={11} color="rgba(255,255,255,0.55)" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  toggleRow: {
    flexShrink: 0,
    paddingTop: 1,
  },
  toggleRowStacked: {
    flexShrink: 0,
    alignItems: 'flex-start',
  },
  searchRow: {
    flex: 1,
    minWidth: 0,
  },
  autoFlipChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  autoFlipChipHovered: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.36)',
  },
  autoFlipChipPressed: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  autoFlipChipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },
  autoFlipChipKeyword: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  autoFlipChipDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  autoFlipChipRevert: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
