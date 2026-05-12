/**
 * SupplierGrid — Pass E layout for Supplier-mode results.
 *
 * Renders SupplierCard instances in a responsive grid:
 *   mobile  (<768)         → 1 column
 *   tablet  (768–1280)     → 2 columns
 *   desktop (>=1280)       → 2 columns (suppliers are wider cards than
 *                           retail products; we keep 2 cols to preserve
 *                           density without cramping address lines)
 *
 * States:
 *   - Loading: shimmer skeleton cards with cross-fade-in (CLS=0).
 *   - Empty:   dashed-border premium message with subtle storefront icon.
 *   - Loaded:  grid of SupplierCard.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierCard } from './SupplierCard';
import type { Supplier } from '@/hooks/useMaterialsSearch';

interface Props {
  suppliers: Supplier[] | null;
  isLoading?: boolean;
  onDraftRfq?: (supplier: Supplier) => void;
}

const GAP = 12;

function colsForWidth(w: number): number {
  if (w >= 768) return 2;
  return 1;
}

function basisFor(cols: number): DimensionValue {
  const totalGap = (cols - 1) * GAP;
  if (Platform.OS === 'web') {
    return `calc((100% - ${totalGap}px) / ${cols})` as unknown as DimensionValue;
  }
  const approxPct = (100 - totalGap / 4) / cols;
  return `${approxPct.toFixed(4)}%` as `${number}%`;
}

export function SupplierGrid({ suppliers, isLoading, onDraftRfq }: Props) {
  const { width } = useWindowDimensions();
  const cols = colsForWidth(width);
  const basis = basisFor(cols);

  // Loading skeleton: 4 placeholder cards
  if (isLoading || suppliers === null) {
    return <SupplierGridSkeleton cols={cols} basis={basis} />;
  }

  if (suppliers.length === 0) {
    return (
      <View style={styles.emptyState} testID="materials-supplier-empty">
        <View style={styles.emptyIconWrap}>
          <Ionicons name="storefront-outline" size={22} color="rgba(251,191,36,0.55)" />
        </View>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          No specialty suppliers nearby
        </Text>
        <Text style={styles.emptySub}>
          Search returned no specialty suppliers — try a broader category like
          “concrete” or “lumber wholesale”.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid} testID="materials-supplier-grid">
      {suppliers.map((s) => (
        <View key={s.id} style={[styles.cell, { flexBasis: basis }]}>
          <SupplierCard supplier={s} onDraftRfq={onDraftRfq} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

interface SkeletonProps {
  cols: number;
  basis: DimensionValue;
}

function SupplierGridSkeleton({ cols: _cols, basis }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.75] });

  return (
    <View style={styles.grid} testID="materials-supplier-grid-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.cell, { flexBasis: basis }]}>
          <View style={styles.skelCard}>
            <View style={styles.skelTopRow}>
              <Animated.View style={[styles.skelIconTile, { opacity }]} />
              <View style={styles.skelIdentity}>
                <Animated.View style={[styles.skelLine, { width: '60%', opacity }]} />
                <Animated.View style={[styles.skelLineSm, { width: '85%', opacity }]} />
                <View style={styles.skelChipRow}>
                  <Animated.View style={[styles.skelChip, { opacity }]} />
                  <Animated.View style={[styles.skelChip, { opacity }]} />
                </View>
              </View>
              <View style={styles.skelStats}>
                <Animated.View style={[styles.skelStat, { opacity }]} />
                <Animated.View style={[styles.skelStat, { opacity }]} />
              </View>
            </View>
            <Animated.View style={[styles.skelCta, { opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const WEB_FADE_IN: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'opacity 200ms ease' } as unknown) as ViewStyle)
    : {};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    ...WEB_FADE_IN,
  },
  cell: {
    minWidth: 0,
  },

  // Empty state
  emptyState: {
    padding: 28,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    backgroundColor: 'rgba(251,191,36,0.02)',
    ...(Platform.OS === 'web'
      ? (({ borderStyle: 'dashed' } as unknown) as ViewStyle)
      : {}),
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  emptySub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 16,
  },

  // Skeleton
  skelCard: {
    minHeight: 120,
    padding: 14,
    gap: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.14)',
  },
  skelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  skelIconTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  skelIdentity: {
    flex: 1,
    gap: 6,
  },
  skelLine: {
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skelLineSm: {
    height: 9,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skelChipRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  skelChip: {
    width: 60,
    height: 14,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skelStats: {
    flexDirection: 'row',
    gap: 8,
  },
  skelStat: {
    width: 40,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  skelCta: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
});
