/**
 * AssemblyTableV2 â€” Wave 13.
 *
 * Adds tariff-flag column + click-row-to-highlight-source-sheets to the
 * existing Wave 8 AssemblyTable. Default sort is by quantity desc.
 *
 * The materials list is passed in so we can derive per-assembly tariff
 * exposure (any material referencing the assembly that carries a tariff
 * flag bubbles up to the row). For Wave 13 we approximate by checking the
 * `source_sheet_id` cross-reference; a fuller assemblyâ†”material join lands
 * with Wave 2.7 backend.
 *
 * Aspire Law #7: pure render. Highlight callback delegates to the store.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintSheetRead,
  TakeoffAssembly,
  TakeoffMaterial,
  TakeoffSymbolTruth,
  TakeoffTariffFlag,
} from '@/lib/api/blueprintsApi';

type SortKey = 'type' | 'quantity' | 'truth' | 'tariff';
type SortDir = 'asc' | 'desc';

const TRUTH_ORDER: Record<TakeoffSymbolTruth, number> = {
  asserted: 0,
  derived: 1,
  assumed: 2,
};

const TRUTH_STYLES: Record<
  TakeoffSymbolTruth,
  { bg: string; border: string; fg: string; label: string }
> = {
  asserted: {
    bg: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.45)',
    fg: '#34d399',
    label: 'Asserted',
  },
  derived: {
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.45)',
    fg: '#fbbf24',
    label: 'Derived',
  },
  assumed: {
    bg: 'transparent',
    border: 'rgba(251,191,36,0.45)',
    fg: '#fbbf24',
    label: 'Assumed',
  },
};

const TARIFF_STYLES: Record<TakeoffTariffFlag, { fg: string; bg: string; label: string }> = {
  steel: { fg: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'Steel' },
  aluminum: { fg: '#fb923c', bg: 'rgba(251,146,60,0.10)', label: 'Aluminum' },
  softwood: { fg: '#b08968', bg: 'rgba(176,137,104,0.10)', label: 'Softwood' },
  hardwood: { fg: '#92400e', bg: 'rgba(146,64,14,0.18)', label: 'Hardwood' },
  copper: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)', label: 'Copper' },
  none: { fg: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.03)', label: 'â€”' },
};

interface Props {
  assemblies: TakeoffAssembly[];
  /** Used to compute the tariff-flag column. */
  materials: TakeoffMaterial[];
  sheets: BlueprintSheetRead[];
  isLoading?: boolean;
  endpointMissing?: boolean;
  /** Currently-highlighted sheet ids (driven by store). */
  highlightedSheetIds: ReadonlySet<string>;
  /** Click row â†’ set highlighted sheet ids (parent dispatches to store). */
  onRowClick: (sheetIds: readonly string[]) => void;
}

export function AssemblyTableV2({
  assemblies,
  materials,
  sheets,
  isLoading,
  endpointMissing,
  highlightedSheetIds,
  onRowClick,
}: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('quantity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Derive per-assembly tariff flag â€” best-effort using shared source sheet.
  // Wave 2.7 will give us a real assembly_id â†” material_id join.
  const tariffByAssembly = useMemo(() => {
    const m = new Map<string, TakeoffTariffFlag>();
    for (const a of assemblies) {
      if (!a.source_sheet_id) {
        m.set(a.assembly_id, 'none');
        continue;
      }
      // Pick the first flagged material that shares the source sheet (best-
      // effort; backend will give us a real join in Wave 2.7).
      let flag: TakeoffTariffFlag = 'none';
      for (const mat of materials) {
        if (mat.tariff_flag !== 'none') {
          flag = mat.tariff_flag;
          break;
        }
      }
      m.set(a.assembly_id, flag);
    }
    return m;
  }, [assemblies, materials]);

  const sorted = useMemo(() => {
    const arr = [...assemblies];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'type') cmp = a.type.localeCompare(b.type);
      else if (sortKey === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortKey === 'truth') cmp = TRUTH_ORDER[a.truth] - TRUTH_ORDER[b.truth];
      else if (sortKey === 'tariff') {
        const fa = tariffByAssembly.get(a.assembly_id) ?? 'none';
        const fb = tariffByAssembly.get(b.assembly_id) ?? 'none';
        cmp = (fa === 'none' ? 1 : 0) - (fb === 'none' ? 1 : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [assemblies, sortKey, sortDir, tariffByAssembly]);

  const sheetMap = useMemo(() => {
    const m = new Map<string, BlueprintSheetRead>();
    for (const s of sheets) m.set(s.id, s);
    return m;
  }, [sheets]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Sensible defaults: quantity/tariff default desc; type/truth asc.
      setSortDir(key === 'quantity' || key === 'tariff' ? 'desc' : 'asc');
    }
  };

  return (
    <View style={styles.host} testID="assembly-table-v2">
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.title}>Derived Assemblies</Text>
          <Text style={styles.subtitle}>
            {assemblies.length} entr{assemblies.length === 1 ? 'y' : 'ies'} Â· click a row to highlight source sheets
          </Text>
        </View>
      </View>

      <View style={styles.headerRow}>
        <HeaderCell
          label="Assembly"
          sortKey="type"
          current={sortKey}
          dir={sortDir}
          onPress={toggleSort}
          flex={2.2}
        />
        <HeaderCell
          label="Qty"
          sortKey="quantity"
          current={sortKey}
          dir={sortDir}
          onPress={toggleSort}
          flex={0.8}
          align="right"
        />
        <View style={[styles.col, { flex: 0.6 }]}>
          <Text style={styles.headerText}>Unit</Text>
        </View>
        <HeaderCell
          label="Truth"
          sortKey="truth"
          current={sortKey}
          dir={sortDir}
          onPress={toggleSort}
          flex={0.95}
        />
        <View style={[styles.col, { flex: 1 }]}>
          <Text style={styles.headerText}>Source sheets</Text>
        </View>
        <HeaderCell
          label="Tariff"
          sortKey="tariff"
          current={sortKey}
          dir={sortDir}
          onPress={toggleSort}
          flex={0.85}
        />
      </View>

      <ScrollView style={styles.body} testID="assembly-table-v2-body">
        {isLoading ? (
          <EmptyMessage icon="hourglass-outline" title="Loading assembliesâ€¦" />
        ) : endpointMissing ? (
          <EmptyMessage
            icon="warning-outline"
            title="Assemblies require Wave 2.7"
            body="The backend endpoint for derived assemblies has not landed yet. UI is wired; data flows once Wave 2.7 PR merges."
            tone="warning"
          />
        ) : sorted.length === 0 ? (
          <EmptyMessage
            icon="layers-outline"
            title="No assemblies yet"
            body="Drew's REASON pass derives assemblies from classified sheets."
          />
        ) : (
          sorted.map((a) => {
            const ts = TRUTH_STYLES[a.truth];
            const sourceSheet = a.source_sheet_id ? sheetMap.get(a.source_sheet_id) : null;
            const tariffFlag = tariffByAssembly.get(a.assembly_id) ?? 'none';
            const tariffStyle = TARIFF_STYLES[tariffFlag];
            const isLowTruth = a.truth === 'assumed';
            const isHighlighted =
              !!sourceSheet && highlightedSheetIds.has(sourceSheet.id);

            return (
              <Pressable
                key={a.assembly_id}
                onPress={() =>
                  onRowClick(a.source_sheet_id ? [a.source_sheet_id] : [])
                }
                accessibilityRole="button"
                accessibilityLabel={`${a.type} â€” ${a.quantity} ${a.unit}. Click to highlight source sheets.`}
                accessibilityState={{ selected: isHighlighted }}
                testID={`assembly-row-${a.assembly_id}`}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.row,
                  isLowTruth ? styles.rowLowTruth : null,
                  isHighlighted ? styles.rowHighlighted : null,
                  hovered ? styles.rowHover : null,
                  pressed ? styles.rowPressed : null,
                ]}
              >
                <View style={[styles.col, { flex: 2.2 }]}>
                  <Text style={styles.cellType} numberOfLines={2}>
                    {a.type}
                  </Text>
                </View>
                <View style={[styles.col, { flex: 0.8, alignItems: 'flex-end' }]}>
                  <Text style={styles.cellNumber}>{a.quantity.toLocaleString()}</Text>
                </View>
                <View style={[styles.col, { flex: 0.6 }]}>
                  <Text style={styles.cellUnit}>{a.unit}</Text>
                </View>
                <View style={[styles.col, { flex: 0.95 }]}>
                  <View
                    style={[
                      styles.truthBadge,
                      {
                        backgroundColor: ts.bg,
                        borderColor: ts.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.truthText, { color: ts.fg }]}>{ts.label}</Text>
                  </View>
                </View>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.cellSource} numberOfLines={1}>
                    {sourceSheet?.sheet_code ??
                      sourceSheet?.sheet_number ??
                      a.source_sheet_id ??
                      'â€”'}
                  </Text>
                </View>
                <View style={[styles.col, { flex: 0.85 }]}>
                  <View
                    style={[
                      styles.tariffChip,
                      {
                        backgroundColor: tariffStyle.bg,
                        borderColor: tariffStyle.fg + '55',
                      },
                    ]}
                  >
                    <Text style={[styles.tariffText, { color: tariffStyle.fg }]}>
                      {tariffStyle.label}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function HeaderCell({
  label,
  sortKey,
  current,
  dir,
  onPress,
  flex,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onPress: (k: SortKey) => void;
  flex: number;
  align?: 'left' | 'right';
}): React.ReactElement {
  const isActive = sortKey === current;
  return (
    <Pressable
      onPress={() => onPress(sortKey)}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}`}
      testID={`assembly-v2-sort-${sortKey}`}
      style={({ hovered }: any) => [
        styles.col,
        { flex, alignItems: align === 'right' ? 'flex-end' : 'flex-start' },
        hovered ? styles.headerCellHover : null,
      ]}
    >
      <View style={styles.headerCellInner}>
        <Text style={[styles.headerText, isActive && styles.headerTextActive]}>{label}</Text>
        {isActive ? (
          <Ionicons
            name={dir === 'asc' ? 'caret-up' : 'caret-down'}
            size={9}
            color="#fbbf24"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyMessage({
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
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.10)',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerCellHover: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  headerCellInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTextActive: {
    color: '#fbbf24',
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
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 120ms ease, border-color 120ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  rowLowTruth: {
    backgroundColor: 'rgba(251,191,36,0.04)',
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowHighlighted: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.30)',
  },
  col: {
    paddingHorizontal: 6,
  },
  cellType: {
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
  cellUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  cellSource: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  truthBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  truthText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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

export default AssemblyTableV2;
