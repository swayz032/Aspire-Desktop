/**
 * QuantityTable — Wave 8.
 *
 * Table of `blueprint_materials` (PROCURE stage). Columns:
 *   Select | Line Item | Quantity | Unit | Truth | Tariff | Supplier | Actions
 *
 * Per-row action: "Push to Materials Bundle" → triggers YELLOW capability
 * round-trip via `usePushToMaterials`. After success the row shows a green
 * "in bundle" badge (optimistic local update).
 *
 * Bulk: "Push All Flagged" button at top action bar — selects every row
 * with tariff_flag != 'none' that isn't already in the bundle.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  TakeoffMaterial,
  TakeoffSymbolTruth,
  TakeoffTariffFlag,
} from '@/lib/api/blueprintsApi';
import type { UsePushToMaterialsResult } from '@/hooks/usePushToMaterials';

interface Props {
  materials: TakeoffMaterial[];
  isLoading?: boolean;
  endpointMissing?: boolean;
  push: UsePushToMaterialsResult;
  /** Local optimistic helper. */
  onPushedIds?: (ids: string[]) => void;
}

const TARIFF_STYLES: Record<TakeoffTariffFlag, { fg: string; bg: string; label: string }> = {
  steel: { fg: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'Steel' },
  aluminum: { fg: '#fb923c', bg: 'rgba(251,146,60,0.10)', label: 'Aluminum' },
  softwood: { fg: '#b08968', bg: 'rgba(176,137,104,0.10)', label: 'Softwood' },
  hardwood: { fg: '#92400e', bg: 'rgba(146,64,14,0.18)', label: 'Hardwood' },
  copper: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)', label: 'Copper' },
  none: { fg: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.03)', label: '—' },
};

const TRUTH_LABEL: Record<TakeoffSymbolTruth, { fg: string; label: string }> = {
  asserted: { fg: '#34d399', label: 'Asserted' },
  derived: { fg: '#fbbf24', label: 'Derived' },
  assumed: { fg: '#fbbf24', label: 'Assumed' },
};

export function QuantityTable({
  materials,
  isLoading,
  endpointMissing,
  push,
  onPushedIds,
}: Props): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const flaggedIds = useMemo(
    () =>
      materials
        .filter((m) => m.tariff_flag !== 'none' && !m.in_bundle)
        .map((m) => m.material_id),
    [materials],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPushRow = useCallback(
    (id: string) => {
      push.request([id]);
    },
    [push],
  );

  const onPushSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    push.request(Array.from(selectedIds));
  }, [push, selectedIds]);

  const onPushAllFlagged = useCallback(() => {
    if (flaggedIds.length === 0) return;
    push.request(flaggedIds);
  }, [push, flaggedIds]);

  // After a successful push, clear selection and let parent mark items.
  React.useEffect(() => {
    if (push.phase === 'success' && push.result?.added_material_ids?.length) {
      onPushedIds?.(push.result.added_material_ids);
      setSelectedIds(new Set());
    }
  }, [push.phase, push.result, onPushedIds]);

  return (
    <View style={styles.host} testID="quantity-table">
      <View style={styles.tableHeader}>
        <View>
          <Text style={styles.title}>Quantities & Materials</Text>
          <Text style={styles.subtitle}>
            {materials.length} line item{materials.length === 1 ? '' : 's'}
            {flaggedIds.length > 0 ? ` · ${flaggedIds.length} tariff-flagged` : ''}
          </Text>
        </View>
        <View style={styles.actionBar}>
          {selectedIds.size > 0 ? (
            <Pressable
              onPress={onPushSelected}
              accessibilityRole="button"
              accessibilityLabel={`Push ${selectedIds.size} selected to materials bundle`}
              testID="quantity-push-selected"
              style={({ hovered }: any) => [
                styles.bulkBtn,
                styles.bulkBtnPrimary,
                hovered && styles.bulkBtnHover,
              ]}
            >
              <Ionicons name="cart-outline" size={13} color="#0b0b0b" />
              <Text style={styles.bulkBtnTextPrimary}>
                Push selected ({selectedIds.size})
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPushAllFlagged}
            disabled={flaggedIds.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Push all tariff-flagged to materials"
            testID="quantity-push-all-flagged"
            style={({ hovered }: any) => [
              styles.bulkBtn,
              flaggedIds.length === 0 && styles.bulkBtnDisabled,
              hovered && flaggedIds.length > 0 && styles.bulkBtnHover,
            ]}
          >
            <Ionicons
              name="flag-outline"
              size={13}
              color={flaggedIds.length === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)'}
            />
            <Text
              style={[
                styles.bulkBtnText,
                flaggedIds.length === 0 && styles.bulkBtnTextDisabled,
              ]}
            >
              Push all flagged
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.headerRow}>
        <View style={[styles.col, { flex: 0.35 }]} />
        <View style={[styles.col, { flex: 2.4 }]}>
          <Text style={styles.headerText}>Line Item</Text>
        </View>
        <View style={[styles.col, { flex: 0.75, alignItems: 'flex-end' }]}>
          <Text style={styles.headerText}>Qty</Text>
        </View>
        <View style={[styles.col, { flex: 0.55 }]}>
          <Text style={styles.headerText}>Unit</Text>
        </View>
        <View style={[styles.col, { flex: 0.8 }]}>
          <Text style={styles.headerText}>Truth</Text>
        </View>
        <View style={[styles.col, { flex: 0.95 }]}>
          <Text style={styles.headerText}>Tariff</Text>
        </View>
        <View style={[styles.col, { flex: 1.1 }]}>
          <Text style={styles.headerText}>Supplier</Text>
        </View>
        <View style={[styles.col, { flex: 1.1, alignItems: 'flex-end' }]}>
          <Text style={styles.headerText}>Action</Text>
        </View>
      </View>

      <ScrollView style={styles.body} testID="quantity-table-body">
        {isLoading ? (
          <Empty icon="hourglass-outline" title="Loading materials…" />
        ) : endpointMissing ? (
          <Empty
            icon="warning-outline"
            title="Materials require Wave 2.7"
            body="The backend endpoint for derived materials has not landed yet. UI is wired; data flows once Wave 2.7 PR merges."
            tone="warning"
          />
        ) : materials.length === 0 ? (
          <Empty
            icon="cube-outline"
            title="No materials yet"
            body="PROCURE pass generates per-material line items once the plan set classifies."
          />
        ) : (
          materials.map((m) => {
            const tariff = TARIFF_STYLES[m.tariff_flag];
            const truth = TRUTH_LABEL[m.truth];
            const isSelected = selectedIds.has(m.material_id);
            return (
              <View
                key={m.material_id}
                style={[styles.row, m.in_bundle && styles.rowInBundle]}
                testID={`material-row-${m.material_id}`}
              >
                <View style={[styles.col, { flex: 0.35 }]}>
                  <Pressable
                    onPress={() => toggleSelect(m.material_id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Select ${m.line_item}`}
                    testID={`material-select-${m.material_id}`}
                    disabled={m.in_bundle}
                    style={[styles.checkbox, isSelected && styles.checkboxOn, m.in_bundle && styles.checkboxDisabled]}
                  >
                    {isSelected ? (
                      <Ionicons name="checkmark" size={11} color="#0b0b0b" />
                    ) : null}
                  </Pressable>
                </View>
                <View style={[styles.col, { flex: 2.4 }]}>
                  <Text style={styles.cellLineItem} numberOfLines={2}>
                    {m.line_item}
                  </Text>
                </View>
                <View style={[styles.col, { flex: 0.75, alignItems: 'flex-end' }]}>
                  <Text style={styles.cellNumber}>{m.quantity.toLocaleString()}</Text>
                </View>
                <View style={[styles.col, { flex: 0.55 }]}>
                  <Text style={styles.cellMuted}>{m.unit}</Text>
                </View>
                <View style={[styles.col, { flex: 0.8 }]}>
                  <Text style={[styles.cellMuted, { color: truth.fg }]}>{truth.label}</Text>
                </View>
                <View style={[styles.col, { flex: 0.95 }]}>
                  <View
                    style={[
                      styles.tariffChip,
                      { backgroundColor: tariff.bg, borderColor: tariff.fg + '55' },
                    ]}
                  >
                    <Text style={[styles.tariffText, { color: tariff.fg }]}>{tariff.label}</Text>
                  </View>
                </View>
                <View style={[styles.col, { flex: 1.1 }]}>
                  <Text style={styles.cellMuted} numberOfLines={1}>
                    {m.supplier_name ?? '—'}
                  </Text>
                </View>
                <View style={[styles.col, { flex: 1.1, alignItems: 'flex-end' }]}>
                  {m.in_bundle ? (
                    <View style={styles.inBundleBadge} testID={`material-in-bundle-${m.material_id}`}>
                      <Ionicons name="checkmark-circle" size={12} color="#34d399" />
                      <Text style={styles.inBundleText}>In bundle</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onPushRow(m.material_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Push ${m.line_item} to materials bundle`}
                      testID={`material-push-${m.material_id}`}
                      style={({ hovered }: any) => [
                        styles.pushBtn,
                        hovered && styles.pushBtnHover,
                      ]}
                    >
                      <Ionicons name="add-circle-outline" size={12} color="#fbbf24" />
                      <Text style={styles.pushBtnText}>Push</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function Empty({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  tone?: 'warning';
}): React.ReactElement {
  return (
    <View style={styles.empty}>
      <Ionicons
        name={icon}
        size={28}
        color={tone === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.40)'}
      />
      <Text style={[styles.emptyTitle, tone === 'warning' && { color: '#fbbf24' }]}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bulkBtnPrimary: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  bulkBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bulkBtnDisabled: {
    opacity: 0.4,
  },
  bulkBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  bulkBtnTextPrimary: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: -0.05,
  },
  bulkBtnTextDisabled: {
    color: 'rgba(255,255,255,0.40)',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  rowInBundle: {
    backgroundColor: 'rgba(52,211,153,0.03)',
  },
  col: {
    paddingHorizontal: 6,
  },
  cellLineItem: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  cellNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
  },
  cellMuted: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  tariffChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tariffText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.40)',
  },
  pushBtnHover: {
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  pushBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.05,
  },
  inBundleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.32)',
  },
  inBundleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: -0.05,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  checkboxOn: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  checkboxDisabled: {
    opacity: 0.3,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  emptyBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 16,
  },
});
