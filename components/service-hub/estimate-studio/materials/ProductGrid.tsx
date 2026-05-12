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
import { View, StyleSheet, useWindowDimensions } from 'react-native';
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
  // Subtract (cols-1) gaps from 100%, distribute remaining width into cols.
  // flexBasis = `calc((100% - (cols-1)*GAP) / cols)`. RN flex-wrap respects px-based flexBasis
  // when expressed as a percentage; we approximate by leaving small margin.
  const basisPct = `${(100 / cols).toFixed(4)}%`;

  return (
    <View style={styles.grid} testID="materials-product-grid">
      {products.map((p) => (
        <View
          key={p.id}
          style={[styles.cell, { flexBasis: basisPct as `${number}%` }]}
        >
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
    // Use negative margin trick to simulate uniform gap inside flex-wrap.
    marginHorizontal: -GAP / 2,
    marginVertical: -GAP / 2,
  },
  cell: {
    paddingHorizontal: GAP / 2,
    paddingVertical: GAP / 2,
    minWidth: 0,
  },
});
