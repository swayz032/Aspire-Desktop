/**
 * FromBlueprintCard — Wave 5.1a-5.
 *
 * The "From Blueprint" canvas view for the Materials tab. Renders Drew's
 * PROCURE-stage material picks grouped by category (commodity / commercial
 * plumbing / appliance finish / local trade / specialty hardware) with three
 * per-row actions: Confirm · Override · Skip.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Header: "From Blueprint · N picks · M overridden"            │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ ▾ Commodity (steel/aluminum/copper/lumber)                    │
 *   │   ├─ Row: spec · qty + truth chip · supplier $price · tariff │
 *   │   │      ⟶ [Confirm] [Override] [Skip]                       │
 *   │   ├─ Row …                                                   │
 *   │ ▾ Commercial Plumbing                                         │
 *   │   ├─ Row …                                                   │
 *   │ …                                                            │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Aspire Law compliance:
 *   Law #7 — render layer only. All mutations go through useMaterialOverride
 *           which calls server-side proxy that mints capability tokens.
 *   Law #4 — Override panel acts as the YELLOW UX gate before the override
 *           hits the network (mounted by parent: MaterialsTab).
 *   Law #2 — Skip + Override emit receipts server-side (Drew handles).
 *
 * Visual: matches flat-premium Estimate Studio aesthetic (dark fills + yellow
 * accent on truth/active states). CLS = 0 — empty + loading states share the
 * 320px minHeight footprint.
 */
import React, { useMemo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TakeoffMaterial, TakeoffTariffFlag } from '@/lib/api/blueprintsApi';
import type { UseMaterialOverrideResult } from '@/hooks/useMaterialOverride';

// ---------------------------------------------------------------------------
// Category mapping — Drew's PROCURE stage emits one of five buckets. We use
// the tariff_flag as a proxy when no explicit bucket is provided (steel,
// aluminum, softwood, hardwood, copper → commodity; none → fallback by
// inspecting line_item keywords).
// ---------------------------------------------------------------------------

type Category =
  | 'commodity'
  | 'commercial_plumbing'
  | 'appliance_finish'
  | 'local_trade'
  | 'specialty_hardware';

const CATEGORY_LABEL: Record<Category, string> = {
  commodity: 'Commodity',
  commercial_plumbing: 'Commercial Plumbing',
  appliance_finish: 'Appliance & Finish',
  local_trade: 'Local Trade',
  specialty_hardware: 'Specialty Hardware',
};

const CATEGORY_ICON: Record<Category, React.ComponentProps<typeof Ionicons>['name']> = {
  commodity: 'cube-outline',
  commercial_plumbing: 'water-outline',
  appliance_finish: 'color-palette-outline',
  local_trade: 'hammer-outline',
  specialty_hardware: 'construct-outline',
};

const COMMODITY_TARIFFS: ReadonlySet<TakeoffTariffFlag> = new Set([
  'steel',
  'aluminum',
  'softwood',
  'hardwood',
  'copper',
]);

const PLUMBING_KEYWORDS = ['pipe', 'fitting', 'valve', 'fixture', 'drain', 'water heater'];
const APPLIANCE_KEYWORDS = ['paint', 'tile', 'fixture', 'cabinet', 'countertop', 'flooring', 'appliance'];
const SPECIALTY_KEYWORDS = ['rebar', 'precast', 'lift station', 'transformer', 'manhole'];

function classifyMaterial(m: TakeoffMaterial): Category {
  if (COMMODITY_TARIFFS.has(m.tariff_flag)) return 'commodity';
  const lo = (m.line_item ?? '').toLowerCase();
  if (PLUMBING_KEYWORDS.some((k) => lo.includes(k))) return 'commercial_plumbing';
  if (SPECIALTY_KEYWORDS.some((k) => lo.includes(k))) return 'specialty_hardware';
  if (APPLIANCE_KEYWORDS.some((k) => lo.includes(k))) return 'appliance_finish';
  return 'local_trade';
}

const TRUTH_STYLE: Record<
  TakeoffMaterial['truth'],
  { bg: string; fg: string; label: string }
> = {
  asserted: {
    bg: 'rgba(74,222,128,0.10)',
    fg: '#86efac',
    label: 'observed',
  },
  derived: {
    bg: 'rgba(96,165,250,0.10)',
    fg: '#93c5fd',
    label: 'derived',
  },
  assumed: {
    bg: 'rgba(251,191,36,0.10)',
    fg: '#fbbf24',
    label: 'assumed',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FromBlueprintCardProps {
  /** Drew-derived materials (already filtered for the active project). */
  materials: TakeoffMaterial[];
  /** Pipeline / fetch state — drives loading + empty + error renders. */
  isLoading: boolean;
  error: { code: string; message: string } | null;
  /** True when the backend GET /materials route is unavailable
   *  (Wave 2.7 backend not yet deployed). */
  endpointMissing: boolean;
  /** Whether PROCURE has finished (drives "still procuring" sub-state). */
  procureDone: boolean;
  /** Override controller — same instance used by the override panel. */
  controller: UseMaterialOverrideResult;
  /** Open the override panel for a material. */
  onOpenOverride: (material: TakeoffMaterial) => void;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FromBlueprintCard({
  materials,
  isLoading,
  error,
  endpointMissing,
  procureDone,
  controller,
  onOpenOverride,
  testID,
}: FromBlueprintCardProps): React.ReactElement {
  const { confirmedIds, skippedIds, overriddenIds, statusById, errorById, confirm, skip } =
    controller;

  // Group by category, preserving Drew's order within each group.
  const grouped = useMemo<Array<{ category: Category; items: TakeoffMaterial[] }>>(() => {
    const buckets: Record<Category, TakeoffMaterial[]> = {
      commodity: [],
      commercial_plumbing: [],
      appliance_finish: [],
      local_trade: [],
      specialty_hardware: [],
    };
    for (const m of materials) {
      buckets[classifyMaterial(m)].push(m);
    }
    const order: Category[] = [
      'commodity',
      'commercial_plumbing',
      'appliance_finish',
      'specialty_hardware',
      'local_trade',
    ];
    return order
      .map((c) => ({ category: c, items: buckets[c] }))
      .filter((g) => g.items.length > 0);
  }, [materials]);

  const overriddenCount = overriddenIds.size;
  const reviewedCount = confirmedIds.size + skippedIds.size + overriddenIds.size;

  // -------- Loading state (CLS-safe — same minHeight as content) ----------
  if (isLoading && materials.length === 0) {
    return (
      <View
        style={[styles.host, styles.hostMinHeight]}
        testID={testID ?? 'from-blueprint-card'}
      >
        <View style={styles.headerRow}>
          <Ionicons name="hammer-outline" size={15} color="#fbbf24" />
          <Text style={styles.headerTitle}>From Blueprint</Text>
          <View style={styles.headerStatusPill}>
            <View style={styles.headerStatusDot} />
            <Text style={styles.headerStatusText}>Drew is procuring…</Text>
          </View>
        </View>
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeletonRow, { opacity: 0.95 - i * 0.18 }]} />
          ))}
        </View>
      </View>
    );
  }

  // -------- Endpoint-missing state (Wave 2.7 pending) ---------------------
  if (endpointMissing) {
    return (
      <View
        style={[styles.host, styles.hostMinHeight]}
        testID={testID ?? 'from-blueprint-card'}
      >
        <View style={styles.headerRow}>
          <Ionicons name="hammer-outline" size={15} color="rgba(255,255,255,0.55)" />
          <Text style={styles.headerTitle}>From Blueprint</Text>
        </View>
        <View style={styles.emptyHost}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="construct-outline"
              size={26}
              color="rgba(255,255,255,0.45)"
            />
          </View>
          <Text style={styles.emptyTitle}>Procurement endpoint not deployed</Text>
          <Text style={styles.emptyBody}>
            Drew picks become available once Wave 2.7 backend reads ship.
          </Text>
        </View>
      </View>
    );
  }

  // -------- Error state ---------------------------------------------------
  if (error) {
    return (
      <View
        style={[styles.host, styles.hostMinHeight]}
        testID={testID ?? 'from-blueprint-card'}
      >
        <View style={styles.headerRow}>
          <Ionicons name="hammer-outline" size={15} color="#ef4444" />
          <Text style={styles.headerTitle}>From Blueprint</Text>
        </View>
        <View style={styles.errorHost}>
          <Ionicons name="alert-circle-outline" size={22} color="#ef4444" />
          <Text style={styles.errorTitle}>Could not load Drew&apos;s picks</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      </View>
    );
  }

  // -------- Empty state (no picks but procure done) -----------------------
  if (materials.length === 0) {
    return (
      <View
        style={[styles.host, styles.hostMinHeight]}
        testID={testID ?? 'from-blueprint-card'}
      >
        <View style={styles.headerRow}>
          <Ionicons name="hammer-outline" size={15} color="rgba(255,255,255,0.55)" />
          <Text style={styles.headerTitle}>From Blueprint</Text>
        </View>
        <View style={styles.emptyHost}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="leaf-outline" size={26} color="rgba(255,255,255,0.45)" />
          </View>
          <Text style={styles.emptyTitle}>
            {procureDone ? 'No materials inferred from the plans yet' : 'Drew is still procuring…'}
          </Text>
          <Text style={styles.emptyBody}>
            {procureDone
              ? 'Use the search bar to add materials manually, or re-run procurement after resolving open Missing Inputs.'
              : 'This card will populate as Drew identifies materials from the symbols on each sheet.'}
          </Text>
        </View>
      </View>
    );
  }

  // -------- Populated content --------------------------------------------
  return (
    <View style={styles.host} testID={testID ?? 'from-blueprint-card'}>
      <View style={styles.headerRow}>
        <Ionicons name="hammer-outline" size={15} color="#fbbf24" />
        <Text style={styles.headerTitle}>From Blueprint</Text>
        <Text style={styles.headerMeta}>
          {materials.length} pick{materials.length === 1 ? '' : 's'}
          {overriddenCount > 0 ? ` · ${overriddenCount} overridden` : ''}
          {reviewedCount > 0 ? ` · ${reviewedCount}/${materials.length} reviewed` : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(({ category, items }) => (
          <CategorySection
            key={category}
            category={category}
            items={items}
            confirmedIds={confirmedIds}
            skippedIds={skippedIds}
            overriddenIds={overriddenIds}
            statusById={statusById}
            errorById={errorById}
            onConfirm={confirm}
            onOverride={onOpenOverride}
            onSkip={skip}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CategorySection
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: Category;
  items: TakeoffMaterial[];
  confirmedIds: Set<string>;
  skippedIds: Set<string>;
  overriddenIds: Set<string>;
  statusById: Record<string, 'idle' | 'pending' | 'success' | 'error'>;
  errorById: Record<string, { code: string; message: string } | null>;
  onConfirm: (id: string) => void;
  onOverride: (m: TakeoffMaterial) => void;
  onSkip: (id: string, reason?: string) => Promise<boolean>;
}

function CategorySection({
  category,
  items,
  confirmedIds,
  skippedIds,
  overriddenIds,
  statusById,
  errorById,
  onConfirm,
  onOverride,
  onSkip,
}: CategorySectionProps): React.ReactElement {
  return (
    <View style={styles.section} testID={`from-blueprint-section-${category}`}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={CATEGORY_ICON[category]}
          size={12}
          color="rgba(255,255,255,0.55)"
        />
        <Text style={styles.sectionLabel}>{CATEGORY_LABEL[category].toUpperCase()}</Text>
        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>
      <View style={styles.rowList}>
        {items.map((m) => (
          <MaterialRow
            key={m.material_id}
            material={m}
            confirmed={confirmedIds.has(m.material_id)}
            skipped={skippedIds.has(m.material_id)}
            overridden={overriddenIds.has(m.material_id)}
            status={statusById[m.material_id] ?? 'idle'}
            error={errorById[m.material_id] ?? null}
            onConfirm={onConfirm}
            onOverride={onOverride}
            onSkip={onSkip}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MaterialRow
// ---------------------------------------------------------------------------

interface MaterialRowProps {
  material: TakeoffMaterial;
  confirmed: boolean;
  skipped: boolean;
  overridden: boolean;
  status: 'idle' | 'pending' | 'success' | 'error';
  error: { code: string; message: string } | null;
  onConfirm: (id: string) => void;
  onOverride: (m: TakeoffMaterial) => void;
  onSkip: (id: string, reason?: string) => Promise<boolean>;
}

function MaterialRow({
  material,
  confirmed,
  skipped,
  overridden,
  status,
  error,
  onConfirm,
  onOverride,
  onSkip,
}: MaterialRowProps): React.ReactElement {
  const truth = TRUTH_STYLE[material.truth];
  const reviewed = confirmed || skipped || overridden;
  const isPending = status === 'pending';

  const handleConfirm = useCallback(() => {
    onConfirm(material.material_id);
  }, [onConfirm, material.material_id]);

  const handleOverride = useCallback(() => {
    onOverride(material);
  }, [onOverride, material]);

  const handleSkip = useCallback(() => {
    void onSkip(material.material_id, 'user_skipped');
  }, [onSkip, material.material_id]);

  return (
    <View
      style={[styles.row, reviewed && styles.rowReviewed, skipped && styles.rowSkipped]}
      testID={`from-blueprint-row-${material.material_id}`}
    >
      {/* Top line: spec + truth chip */}
      <View style={styles.rowTopLine}>
        <Text style={styles.rowSpec} numberOfLines={2}>
          {material.line_item}
        </Text>
        <View style={[styles.truthChip, { backgroundColor: truth.bg }]}>
          <View style={[styles.truthDot, { backgroundColor: truth.fg }]} />
          <Text style={[styles.truthLabel, { color: truth.fg }]}>{truth.label}</Text>
        </View>
      </View>

      {/* Quantity + supplier + tariff row */}
      <View style={styles.rowMetaLine}>
        <Text style={styles.qtyText}>
          {material.quantity.toLocaleString()} {material.unit}
        </Text>
        {material.supplier_name ? (
          <>
            <Text style={styles.metaSep}>·</Text>
            <Ionicons
              name="storefront-outline"
              size={11}
              color="rgba(255,255,255,0.55)"
            />
            <Text style={styles.supplierText} numberOfLines={1}>
              {material.supplier_name}
            </Text>
          </>
        ) : null}
        {material.tariff_flag !== 'none' ? (
          <>
            <Text style={styles.metaSep}>·</Text>
            <View style={styles.tariffPill}>
              <Ionicons name="warning-outline" size={9} color="#fbbf24" />
              <Text style={styles.tariffText}>
                {tariffLabel(material.tariff_flag)}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Action row */}
      <View style={styles.rowActions}>
        {overridden ? (
          <View style={[styles.reviewedPill, styles.overridePill]}>
            <Ionicons name="swap-horizontal" size={11} color="#fbbf24" />
            <Text style={styles.overridePillText}>Overridden</Text>
          </View>
        ) : skipped ? (
          <View style={[styles.reviewedPill, styles.skipPill]}>
            <Ionicons name="close" size={11} color="rgba(255,255,255,0.55)" />
            <Text style={styles.skipPillText}>Skipped</Text>
          </View>
        ) : confirmed ? (
          <View style={[styles.reviewedPill, styles.confirmPill]}>
            <Ionicons name="checkmark" size={11} color="#86efac" />
            <Text style={styles.confirmPillText}>Confirmed</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={handleConfirm}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Confirm ${material.line_item}`}
              style={({ hovered, pressed }: any) => [
                styles.actionBtn,
                styles.confirmBtn,
                hovered && styles.confirmBtnHover,
                pressed && styles.actionBtnPressed,
              ]}
              testID={`from-blueprint-confirm-${material.material_id}`}
            >
              <Ionicons name="checkmark" size={12} color="#86efac" />
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </Pressable>
            <Pressable
              onPress={handleOverride}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Override ${material.line_item}`}
              style={({ hovered, pressed }: any) => [
                styles.actionBtn,
                styles.overrideBtn,
                hovered && styles.overrideBtnHover,
                pressed && styles.actionBtnPressed,
              ]}
              testID={`from-blueprint-override-${material.material_id}`}
            >
              <Ionicons name="swap-horizontal-outline" size={12} color="#fbbf24" />
              <Text style={styles.overrideBtnText}>Override</Text>
            </Pressable>
            <Pressable
              onPress={handleSkip}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Skip ${material.line_item}`}
              style={({ hovered, pressed }: any) => [
                styles.actionBtn,
                styles.skipBtn,
                hovered && styles.skipBtnHover,
                pressed && styles.actionBtnPressed,
              ]}
              testID={`from-blueprint-skip-${material.material_id}`}
            >
              <Ionicons name="close" size={12} color="rgba(255,255,255,0.70)" />
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          </>
        )}
        {isPending ? (
          <Text style={styles.pendingText} testID={`from-blueprint-pending-${material.material_id}`}>
            …
          </Text>
        ) : null}
      </View>

      {error ? (
        <View
          style={styles.rowError}
          testID={`from-blueprint-row-error-${material.material_id}`}
        >
          <Ionicons name="alert-circle" size={11} color="#ef4444" />
          <Text style={styles.rowErrorText} numberOfLines={2}>
            {error.message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function tariffLabel(flag: TakeoffTariffFlag): string {
  switch (flag) {
    case 'steel':
      return 'Section 232 steel';
    case 'aluminum':
      return 'Section 232 aluminum';
    case 'softwood':
      return 'Softwood lumber duty';
    case 'hardwood':
      return 'Hardwood';
    case 'copper':
      return 'Copper';
    case 'none':
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Styles — flat premium, matches Estimate Studio tokens
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    gap: 14,
  },
  hostMinHeight: {
    minHeight: 320,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  headerMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    flex: 1,
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  headerStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#fbbf24',
  },
  headerStatusText: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 14, paddingBottom: 20 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
  },
  sectionCount: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.40)',
    fontVariant: ['tabular-nums'],
  },
  rowList: { gap: 6 },
  row: {
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  rowReviewed: {
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowSkipped: {
    opacity: 0.55,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowSpec: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  truthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  truthDot: { width: 4, height: 4, borderRadius: 4 },
  truthLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  qtyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  metaSep: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.30)',
  },
  supplierText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
    maxWidth: 220,
  },
  tariffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.07)',
  },
  tariffText: {
    fontSize: 9.5,
    color: 'rgba(251,191,36,0.92)',
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnPressed: {
    opacity: 0.78,
  },
  confirmBtn: {
    backgroundColor: 'rgba(74,222,128,0.05)',
    borderColor: 'rgba(74,222,128,0.30)',
  },
  confirmBtnHover: {
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderColor: 'rgba(74,222,128,0.55)',
  },
  confirmBtnText: {
    fontSize: 10.5,
    color: '#86efac',
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  overrideBtn: {
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderColor: 'rgba(251,191,36,0.30)',
  },
  overrideBtnHover: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  overrideBtnText: {
    fontSize: 10.5,
    color: '#fbbf24',
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  skipBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  skipBtnText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  reviewedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  confirmPill: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.40)',
  },
  confirmPillText: {
    fontSize: 10,
    color: '#86efac',
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  overridePill: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  overridePillText: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  skipPill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  skipPillText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  pendingText: {
    fontSize: 12,
    color: 'rgba(251,191,36,0.85)',
    fontWeight: '700',
  },
  rowError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  rowErrorText: {
    flex: 1,
    fontSize: 10.5,
    color: '#fca5a5',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  skeletonWrap: { gap: 8, paddingHorizontal: 4 },
  skeletonRow: {
    height: 64,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
    paddingHorizontal: 24,
    minHeight: 240,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
  errorHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 28,
    minHeight: 240,
  },
  errorTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fca5a5',
    letterSpacing: -0.1,
  },
  errorBody: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 15,
  },
});
