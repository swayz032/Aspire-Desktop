/**
 * BlueprintModeFeed — Wave 14.
 *
 * Top-level surface rendered when MaterialsMode === 'blueprint'. Three states:
 *
 *   1. No active blueprint project →
 *        Empty state CTA → navigate to Plans & Photos.
 *   2. Project active, materials loading →
 *        Skeleton grid (CLS = 0).
 *   3. Project active, materials present →
 *        Filter chip row + responsive tile grid using BlueprintModeTile
 *        (which wraps the existing ProductCard).
 *
 * Hard contract:
 *   - Reuses `useBlueprintProjectPoll(projectId)` ALREADY mounted by Plans &
 *     Photos. Does NOT re-fetch.
 *   - Drew-typed materials are projected into the ProductCardExtended shape
 *     by BlueprintModeTile — Tool tile shape is preserved verbatim.
 *   - Filter chip row mirrors the Tool-mode filtersBar styling for cohesion.
 *
 * Aspire Law compliance:
 *   - Law #7: render only. Bundle add routes through the existing
 *     MaterialsBundle API via `onAdd` prop wiring in MaterialsTab.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import type { TakeoffMaterial } from '@/lib/api/blueprintsApi';
import { BlueprintModeTile, type BlueprintTileMaterial } from './BlueprintModeTile';
import { BlueprintModeSidePanel } from './BlueprintModeSidePanel';
import { KNOWN_DISCIPLINES, getDisciplineStyle } from '../plans-photos/disciplines';

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

type TradeFilter =
  | 'all'
  | 'electrical'
  | 'plumbing'
  | 'mechanical'
  | 'architectural'
  | 'civil';

type SortMode = 'cost_desc' | 'cost_asc';

interface FilterState {
  trade: TradeFilter;
  tariffOnly: boolean;
  confirmedOnly: boolean;
  sort: SortMode;
}

const DEFAULT_FILTERS: FilterState = {
  trade: 'all',
  tariffOnly: false,
  confirmedOnly: false,
  sort: 'cost_desc',
};

const TRADE_OPTIONS: { value: TradeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'civil', label: 'Civil' },
];

// ---------------------------------------------------------------------------
// Responsive grid
// ---------------------------------------------------------------------------

const GAP = 12;
function colsForWidth(w: number): number {
  if (w >= 1600) return 4;
  if (w >= 1200) return 4;
  if (w >= 900) return 3;
  if (w >= 600) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BlueprintModeFeedProps {
  /** Hook into the existing materials-bundle add flow. */
  onAddToBundle?: (m: BlueprintTileMaterial) => void;
  /** Which material IDs are already in the bundle (visual reflection). */
  bundleMaterialIds?: ReadonlySet<string>;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BlueprintModeFeed({
  onAddToBundle,
  bundleMaterialIds,
  testID,
}: BlueprintModeFeedProps): React.ReactElement {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cols = colsForWidth(width);

  const snap = useBlueprintUploadSnapshot();
  const projectId = snap.projectId ?? snap.response?.project_id ?? null;
  const { materials, isLoading, error, endpointMissing } = useTakeoffMaterials(projectId);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [detail, setDetail] = useState<BlueprintTileMaterial | null>(null);

  // ---- No-project empty state ---------------------------------------------
  if (!projectId) {
    return (
      <View
        style={styles.emptyHost}
        testID={testID ?? 'blueprint-mode-feed-empty'}
      >
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="hammer-outline" size={28} color="#fbbf24" />
          </View>
          <Text style={styles.emptyTitle}>No blueprint loaded</Text>
          <Text style={styles.emptyBody}>
            Upload plans on Plans & Photos to see Drew’s curated material list here. The
            feed populates automatically as Drew identifies materials from each sheet.
          </Text>
          <Pressable
            onPress={() => router.push('/service-hub/estimate-studio/plans-photos')}
            accessibilityRole="button"
            accessibilityLabel="Open Plans and Photos to upload a blueprint"
            style={({ hovered, pressed }: any) => [
              styles.emptyCta,
              hovered && styles.emptyCtaHover,
              pressed && styles.emptyCtaPressed,
            ]}
            testID="blueprint-mode-feed-empty-cta"
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#0A0A0F" />
            <Text style={styles.emptyCtaText}>OPEN PLANS & PHOTOS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Error / endpoint-missing -------------------------------------------
  if (endpointMissing || error) {
    return (
      <View
        style={styles.emptyHost}
        testID={testID ?? 'blueprint-mode-feed-error'}
      >
        <View style={styles.emptyCard}>
          <View style={[styles.emptyIconCircle, styles.errorIconCircle]}>
            <Ionicons name="alert-circle-outline" size={26} color="#ef4444" />
          </View>
          <Text style={styles.emptyTitle}>
            {endpointMissing ? 'Drew procurement not yet deployed' : 'Could not load picks'}
          </Text>
          <Text style={styles.emptyBody}>
            {endpointMissing
              ? 'Wave 2.7 backend reads must ship before Blueprint Mode populates.'
              : (error?.message ?? 'Unknown error')}
          </Text>
        </View>
      </View>
    );
  }

  // ---- Filter & sort -------------------------------------------------------
  const filtered = applyFilters(materials, filters);

  // ---- Materialise into tile shape ----------------------------------------
  const tiles: BlueprintTileMaterial[] = filtered.map(materialToTile);

  // ---- Loading skeleton — CLS = 0 -----------------------------------------
  const showSkeleton = isLoading && materials.length === 0;

  // ---- Grid math ----------------------------------------------------------
  const totalGap = (cols - 1) * GAP;
  let basis: DimensionValue;
  if (Platform.OS === 'web') {
    basis = `calc((100% - ${totalGap}px) / ${cols})` as unknown as DimensionValue;
  } else {
    const approxPct = (100 - totalGap / 4) / cols;
    basis = `${approxPct.toFixed(4)}%` as `${number}%`;
  }

  const handleTileAdd = useCallback(
    (m: BlueprintTileMaterial) => {
      if (onAddToBundle) onAddToBundle(m);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.info('[blueprint-feed] addToBundle', m.material_id);
      }
    },
    [onAddToBundle],
  );

  const handleTileOpen = useCallback((m: BlueprintTileMaterial) => {
    setDetail(m);
  }, []);

  const handleTileAlternates = useCallback((m: BlueprintTileMaterial) => {
    setDetail(m);
  }, []);

  const handleTruthClick = useCallback((m: BlueprintTileMaterial) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[blueprint-feed] truth-dropdown', m.material_id, m.truth);
    }
  }, []);

  const handleClose = useCallback(() => setDetail(null), []);

  return (
    <View style={styles.host} testID={testID ?? 'blueprint-mode-feed'}>
      <FilterRow filters={filters} onChange={setFilters} count={filtered.length} />

      {showSkeleton ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.cell,
                { flexBasis: basis },
                styles.skeletonCell,
                { opacity: 0.85 - i * 0.08 },
              ]}
            />
          ))}
        </View>
      ) : tiles.length === 0 ? (
        <View style={styles.noMatchHost} testID="blueprint-mode-feed-no-match">
          <Ionicons name="leaf-outline" size={20} color="rgba(255,255,255,0.40)" />
          <Text style={styles.noMatchTitle}>No picks match these filters</Text>
          <Text style={styles.noMatchBody}>
            Clear filters above to see Drew’s full pick list.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {tiles.map((m) => (
              <View
                key={m.material_id}
                style={[styles.cell, { flexBasis: basis }]}
              >
                <BlueprintModeTile
                  material={m}
                  onAdd={handleTileAdd}
                  onOpenDetail={handleTileOpen}
                  onOpenAlternates={handleTileAlternates}
                  onTruthClick={handleTruthClick}
                  isInBundle={bundleMaterialIds?.has(m.material_id) ?? false}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <BlueprintModeSidePanel
        visible={detail !== null}
        material={detail}
        onClose={handleClose}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface FilterRowProps {
  filters: FilterState;
  count: number;
  onChange: (next: FilterState) => void;
}

function FilterRow({ filters, count, onChange }: FilterRowProps): React.ReactElement {
  return (
    <View style={styles.filterRow} testID="blueprint-filter-row">
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>TRADE</Text>
        <View style={styles.filterChipRow}>
          {TRADE_OPTIONS.map((opt) => {
            const active = filters.trade === opt.value;
            const disc = opt.value === 'all' ? null : getDisciplineStyle(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange({ ...filters, trade: opt.value })}
                accessibilityRole="button"
                accessibilityLabel={`Filter by trade: ${opt.label}`}
                accessibilityState={{ selected: active }}
                testID={`blueprint-filter-trade-${opt.value}`}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                  active && disc
                    ? { borderColor: disc.fg + '88', backgroundColor: disc.bg }
                    : null,
                ]}
              >
                {disc ? (
                  <View style={[styles.tradeDot, { backgroundColor: disc.fg }]} />
                ) : null}
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                    active && disc ? { color: disc.fg } : null,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>FLAGS</Text>
        <View style={styles.filterChipRow}>
          <Pressable
            onPress={() => onChange({ ...filters, tariffOnly: !filters.tariffOnly })}
            accessibilityRole="button"
            accessibilityLabel="Toggle tariff-only filter"
            accessibilityState={{ selected: filters.tariffOnly }}
            testID="blueprint-filter-tariff"
            style={[styles.filterChip, filters.tariffOnly && styles.filterChipActive]}
          >
            <Text style={styles.filterChipIcon}>🏷</Text>
            <Text
              style={[
                styles.filterChipText,
                filters.tariffOnly && styles.filterChipTextActive,
              ]}
            >
              Tariff flagged
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onChange({ ...filters, confirmedOnly: !filters.confirmedOnly })}
            accessibilityRole="button"
            accessibilityLabel="Toggle confirmed-only filter"
            accessibilityState={{ selected: filters.confirmedOnly }}
            testID="blueprint-filter-confirmed"
            style={[styles.filterChip, filters.confirmedOnly && styles.filterChipActive]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={11}
              color={filters.confirmedOnly ? '#86efac' : 'rgba(255,255,255,0.65)'}
            />
            <Text
              style={[
                styles.filterChipText,
                filters.confirmedOnly && styles.filterChipTextActive,
              ]}
            >
              Confirmed only
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>SORT</Text>
        <View style={styles.filterChipRow}>
          <Pressable
            onPress={() =>
              onChange({
                ...filters,
                sort: filters.sort === 'cost_desc' ? 'cost_asc' : 'cost_desc',
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Sort by cost ${filters.sort === 'cost_desc' ? 'descending' : 'ascending'}`}
            testID="blueprint-filter-sort"
            style={[styles.filterChip, styles.filterChipActive]}
          >
            <Ionicons
              name={filters.sort === 'cost_desc' ? 'arrow-down' : 'arrow-up'}
              size={11}
              color="#fbbf24"
            />
            <Text style={[styles.filterChipText, styles.filterChipTextActive]}>
              Cost
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.countWrap}>
        <Text style={styles.countText} testID="blueprint-filter-count">
          {count} pick{count === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFilters(
  materials: TakeoffMaterial[],
  filters: FilterState,
): TakeoffMaterial[] {
  let list = materials;
  if (filters.trade !== 'all') {
    list = list.filter((m) => inferDiscipline(m) === filters.trade);
  }
  if (filters.tariffOnly) {
    list = list.filter((m) => m.tariff_flag !== 'none');
  }
  if (filters.confirmedOnly) {
    list = list.filter((m) => m.truth === 'asserted');
  }
  // Sort by approximate cost — quantity proxy when no unit_price.
  list = [...list].sort((a, b) => {
    const ax = (a as BlueprintTileMaterial).unit_price ?? a.quantity;
    const bx = (b as BlueprintTileMaterial).unit_price ?? b.quantity;
    return filters.sort === 'cost_desc' ? bx - ax : ax - bx;
  });
  return list;
}

/**
 * Best-effort discipline inference when backend hasn't tagged the material.
 * Recognises common AIA trade keywords inside the line_item string.
 */
function inferDiscipline(m: TakeoffMaterial): string {
  const explicit = (m as BlueprintTileMaterial).discipline;
  if (explicit) return explicit.toLowerCase();
  const lo = m.line_item.toLowerCase();
  if (/(romex|wire|breaker|panel|outlet|conduit|fixture light)/.test(lo)) {
    return 'electrical';
  }
  if (/(pipe|fitting|valve|drain|water|toilet|sink|copper)/.test(lo)) {
    return 'plumbing';
  }
  if (/(duct|hvac|rtu|ahu|register|damper|coil)/.test(lo)) {
    return 'mechanical';
  }
  if (/(rebar|column|beam|concrete|cmu|footing)/.test(lo)) {
    return 'structural';
  }
  if (/(drywall|paint|tile|trim|door|window|flooring|cabinet)/.test(lo)) {
    return 'architectural';
  }
  if (/(asphalt|grading|stormwater|curb|catch basin|manhole)/.test(lo)) {
    return 'civil';
  }
  return KNOWN_DISCIPLINES[0];
}

function materialToTile(m: TakeoffMaterial): BlueprintTileMaterial {
  const tile = m as BlueprintTileMaterial;
  // Fill in inferred discipline when backend hasn't supplied one — purely
  // local UI projection, NEVER persisted back.
  if (!tile.discipline) {
    return { ...tile, discipline: inferDiscipline(m) };
  }
  return tile;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'background-color 150ms ease, border-color 150ms ease' } as unknown) as ViewStyle)
    : {};

const styles = StyleSheet.create({
  host: {
    flex: 1,
    gap: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 18,
    paddingVertical: 4,
  },
  filterGroup: {
    gap: 5,
  },
  filterGroupLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...WEB_TRANSITION,
  },
  filterChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  filterChipText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  filterChipTextActive: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  filterChipIcon: {
    fontSize: 10,
  },
  tradeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countWrap: {
    marginLeft: 'auto',
    alignSelf: 'flex-end',
    paddingBottom: 4,
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    minWidth: 0,
  },
  skeletonCell: {
    height: 320,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Empty / error
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyCard: {
    maxWidth: 480,
    alignItems: 'center',
    gap: 12,
    padding: 26,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconCircle: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.30)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    marginTop: 4,
    ...WEB_TRANSITION,
  },
  emptyCtaHover: {
    backgroundColor: '#fcd34d',
  },
  emptyCtaPressed: {
    opacity: 0.82,
  },
  emptyCtaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A0A0F',
    letterSpacing: 0.8,
  },

  // No-match
  noMatchHost: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  noMatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  noMatchBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 16,
  },
});
