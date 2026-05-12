/**
 * ProductGrid — responsive grid layout for product cards.
 *
 * Breakpoints (responsive via useWindowDimensions):
 *   mobile  (<768)         → 2 columns
 *   tablet  (768–1280)     → 3 columns
 *   laptop  (1280–1600)    → 3 columns
 *   desktop (>=1600)       → 4 columns
 *
 * Uses flex-wrap with calculated `flexBasis` per breakpoint — avoids native
 * `grid-template-columns` (not RN) while staying clean.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, type DimensionValue } from 'react-native';
import { ProductCard } from './ProductCard';
import type { Product } from '@/hooks/useMaterialsSearch';

interface Props {
  products: Product[];
  bundleIds: Set<string>;
  onAdd: (p: Product) => void;
  onCompare: (p: Product) => void;
}

const GAP = 12;

function colsForWidth(w: number): number {
  if (w >= 1600) return 4;
  if (w >= 768) return 3;
  return 2;
}

export function ProductGrid({ products, bundleIds, onAdd, onCompare }: Props) {
  const { width } = useWindowDimensions();
  const cols = colsForWidth(width);

  // We want each cell to take EXACTLY 1/cols of the available row width
  // minus the gutters between cells. On web we can use `calc()` directly
  // (RN-Web maps flexBasis through to CSS). On native, we approximate via
  // a percentage that is slightly under-sized so the gaps fit without wrap.
  const totalGap = (cols - 1) * GAP;
  let basis: DimensionValue;
  if (Platform.OS === 'web') {
    basis = `calc((100% - ${totalGap}px) / ${cols})` as unknown as DimensionValue;
  } else {
    // Native fallback — slight under-sizing to leave room for the 12px gap.
    const approxPct = (100 - (totalGap / 4)) / cols; // gentle reduction
    basis = `${approxPct.toFixed(4)}%` as `${number}%`;
  }

  return (
    <View style={styles.grid} testID="materials-product-grid">
      {products.map((p) => (
        <View key={p.id} style={[styles.cell, { flexBasis: basis }]}>
          <ProductCard
            product={p}
            onAdd={() => onAdd(p)}
            onCompare={() => onCompare(p)}
            isInBundle={bundleIds.has(p.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    minWidth: 0,
  },
});
