/**
 * AssemblyTable — Wave 8.
 *
 * Table of `blueprint_assemblies` derived by Drew. Columns:
 *   Type | Quantity | Unit | Truth | Source sheet | Actions (sort)
 *
 * Truth badges (matching Wave 7 truth model where applicable):
 *   asserted — solid green chip
 *   derived  — solid amber chip
 *   assumed  — outlined amber chip (highlighted row, low confidence)
 *
 * Sortable by type, quantity, truth class. Click a row to expand a source
 * sheet preview (visual stub — Wave 9 wires the preview hover-card).
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TakeoffAssembly, TakeoffSymbolTruth, BlueprintSheet } from '@/lib/api/blueprintsApi';

type SortKey = 'type' | 'quantity' | 'truth';
type SortDir = 'asc' | 'desc';

interface Props {
  assemblies: TakeoffAssembly[];
  sheets: BlueprintSheet[];
  isLoading?: boolean;
  endpointMissing?: boolean;
}

const TRUTH_ORDER: Record<TakeoffSymbolTruth, number> = {
  asserted: 0,
  derived: 1,
  assumed: 2,
};

const TRUTH_STYLES: Record<TakeoffSymbolTruth, { bg: string; border: string; fg: string; label: string }> = {
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

export function AssemblyTable({
  assemblies,
  sheets,
  isLoading,
  endpointMissing,
}: Props): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('type');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const arr = [...assemblies];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'type') cmp = a.type.localeCompare(b.type);
      else if (sortKey === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortKey === 'truth') cmp = TRUTH_ORDER[a.truth] - TRUTH_ORDER[b.truth];
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [assemblies, sortKey, sortDir]);

  const sheetMap = useMemo(() => {
    const m = new Map<string, BlueprintSheet>();
    for (const s of sheets) m.set(s.sheet_id, s);
    return m;
  }, [sheets]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <View style={styles.host} testID="assembly-table">
      <View style={styles.tableHeader}>
        <Text style={styles.title}>Derived Assemblies</Text>
        <Text style={styles.subtitle}>
          {assemblies.length} entr{assemblies.length === 1 ? 'y' : 'ies'}
        </Text>
      </View>

      <View style={styles.headerRow}>
        <HeaderCell label="Type" sortKey="type" current={sortKey} dir={sortDir} onPress={toggleSort} flex={2.2} />
        <HeaderCell label="Qty" sortKey="quantity" current={sortKey} dir={sortDir} onPress={toggleSort} flex={0.8} align="right" />
        <View style={[styles.col, { flex: 0.6 }]}>
          <Text style={styles.headerText}>Unit</Text>
        </View>
        <HeaderCell label="Truth" sortKey="truth" current={sortKey} dir={sortDir} onPress={toggleSort} flex={0.9} />
        <View style={[styles.col, { flex: 1 }]}>
          <Text style={styles.headerText}>Source</Text>
        </View>
      </View>

      <ScrollView style={styles.body} testID="assembly-table-body">
        {isLoading ? (
          <EmptyMessage icon="hourglass-outline" title="Loading assemblies…" />
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
            const isLowTruth = a.truth === 'assumed';
            return (
              <View
                key={a.assembly_id}
                style={[styles.row, isLowTruth && styles.rowLowTruth]}
                testID={`assembly-row-${a.assembly_id}`}
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
                <View style={[styles.col, { flex: 0.9 }]}>
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
                    {sourceSheet?.sheet_number ?? a.source_sheet_id ?? '—'}
                  </Text>
                </View>
              </View>
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
      testID={`assembly-sort-${sortKey}`}
      style={({ hovered }: any) => [
        styles.col,
        { flex, alignItems: align === 'right' ? 'flex-end' : 'flex-start' },
        hovered && styles.headerCellHover,
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
  },
  tableHeader: {
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
  },
  rowLowTruth: {
    backgroundColor: 'rgba(251,191,36,0.04)',
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
