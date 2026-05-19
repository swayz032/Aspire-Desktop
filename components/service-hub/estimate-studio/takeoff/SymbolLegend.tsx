/**
 * SymbolLegend — Wave 8.
 *
 * Filterable legend of CSI/AIA-derived symbol classes. Filter chips at the
 * top (A/S/M/E/P/FP/C) + search box. Legend entries come from a static
 * bundle here; the backend KB file (drew-symbol-legend.md) is currently
 * a scaffold (21 lines), so Wave 8 hand-curates the high-value entries
 * for the Commercial Blueprint mode. When the KB fleshes out, this can be
 * replaced with a static-import fetch.
 *
 * `disciplineFilter` lets the parent (ResidentialBlueprintMode) prefilter
 * to a smaller residential symbol set.
 */
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ALL_SYMBOL_DISCIPLINES,
  getDisciplineStyle,
  prettyClassName,
  type SymbolDiscipline,
} from './symbolClasses';

interface LegendEntry {
  classKey: string;
  discipline: SymbolDiscipline;
  /** Short symbol notation (e.g., "$WP" for weather-proof duplex). */
  symbol: string;
  description: string;
  /** True when the entry is part of the residential default set. */
  residential?: boolean;
}

const LEGEND: LegendEntry[] = [
  // Electrical
  {
    classKey: 'electrical.outlet.duplex',
    discipline: 'electrical',
    symbol: '⊕',
    description: '120V duplex receptacle',
    residential: true,
  },
  {
    classKey: 'electrical.outlet.gfci',
    discipline: 'electrical',
    symbol: '⊕GFCI',
    description: 'GFCI receptacle (wet area)',
    residential: true,
  },
  {
    classKey: 'electrical.outlet.weatherproof',
    discipline: 'electrical',
    symbol: '⊕WP',
    description: 'Weather-proof exterior receptacle',
  },
  {
    classKey: 'electrical.switch.single-pole',
    discipline: 'electrical',
    symbol: 'S',
    description: 'Single-pole light switch',
    residential: true,
  },
  {
    classKey: 'electrical.panel.main',
    discipline: 'electrical',
    symbol: '▭MP',
    description: 'Main electrical panel (200A typical)',
    residential: true,
  },
  {
    classKey: 'electrical.fixture.recessed',
    discipline: 'electrical',
    symbol: '○',
    description: 'Recessed downlight (4"/6" can)',
    residential: true,
  },
  // Plumbing
  {
    classKey: 'plumbing.fixture.toilet',
    discipline: 'plumbing',
    symbol: 'WC',
    description: 'Water closet',
    residential: true,
  },
  {
    classKey: 'plumbing.fixture.lavatory',
    discipline: 'plumbing',
    symbol: 'LAV',
    description: 'Lavatory (bath sink)',
    residential: true,
  },
  {
    classKey: 'plumbing.fixture.sink',
    discipline: 'plumbing',
    symbol: 'S',
    description: 'Kitchen / utility sink',
    residential: true,
  },
  {
    classKey: 'plumbing.fixture.shower',
    discipline: 'plumbing',
    symbol: 'SH',
    description: 'Shower stall',
    residential: true,
  },
  {
    classKey: 'plumbing.cleanout.floor',
    discipline: 'plumbing',
    symbol: '○CO',
    description: 'Floor cleanout',
  },
  // Structural
  {
    classKey: 'structural.column.steel',
    discipline: 'structural',
    symbol: '■',
    description: 'Steel column (HSS / wide-flange)',
  },
  {
    classKey: 'structural.beam.steel',
    discipline: 'structural',
    symbol: '═',
    description: 'Steel beam',
  },
  {
    classKey: 'structural.wall.bearing',
    discipline: 'structural',
    symbol: '▮▮',
    description: 'Load-bearing wall callout',
    residential: true,
  },
  // Mechanical (HVAC)
  {
    classKey: 'mechanical.diffuser.supply',
    discipline: 'mechanical',
    symbol: '▢',
    description: 'Supply air diffuser',
  },
  {
    classKey: 'mechanical.return.grille',
    discipline: 'mechanical',
    symbol: '╪',
    description: 'Return air grille',
  },
  {
    classKey: 'mechanical.equipment.furnace',
    discipline: 'mechanical',
    symbol: 'F',
    description: 'Furnace / AHU',
    residential: true,
  },
  // Architectural
  {
    classKey: 'architectural.door.swing',
    discipline: 'architectural',
    symbol: '◜',
    description: 'Swing door (with arc)',
    residential: true,
  },
  {
    classKey: 'architectural.door.sliding',
    discipline: 'architectural',
    symbol: '↔',
    description: 'Sliding door',
    residential: true,
  },
  {
    classKey: 'architectural.window.fixed',
    discipline: 'architectural',
    symbol: '▭',
    description: 'Fixed window',
    residential: true,
  },
  {
    classKey: 'architectural.stair.up',
    discipline: 'architectural',
    symbol: 'UP↑',
    description: 'Stair (direction of travel)',
  },
  // Fire / Life-Safety
  {
    classKey: 'fire.sprinkler.pendant',
    discipline: 'fire',
    symbol: '✚',
    description: 'Pendant sprinkler head',
  },
  {
    classKey: 'fire.detector.smoke',
    discipline: 'fire',
    symbol: 'SD',
    description: 'Smoke detector',
    residential: true,
  },
  {
    classKey: 'fire.alarm.pull',
    discipline: 'fire',
    symbol: '▣',
    description: 'Manual pull station',
  },
  // Civil
  {
    classKey: 'civil.basin.catch',
    discipline: 'civil',
    symbol: '◇',
    description: 'Catch basin / area drain',
  },
];

interface Props {
  /** When set, only show entries matching this discipline. */
  disciplineFilter?: SymbolDiscipline | null;
  /** When true, restrict to residential entries (Residential mode). */
  residentialOnly?: boolean;
}

export function SymbolLegend({
  disciplineFilter = null,
  residentialOnly = false,
}: Props): React.ReactElement {
  const [activeDisc, setActiveDisc] = useState<SymbolDiscipline | null>(disciplineFilter);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LEGEND.filter((entry) => {
      if (residentialOnly && !entry.residential) return false;
      if (activeDisc && entry.discipline !== activeDisc) return false;
      if (!q) return true;
      return (
        entry.description.toLowerCase().includes(q) ||
        entry.classKey.toLowerCase().includes(q) ||
        entry.symbol.toLowerCase().includes(q)
      );
    });
  }, [activeDisc, search, residentialOnly]);

  // Group by discipline for the rendered output.
  const grouped = useMemo(() => {
    const map = new Map<SymbolDiscipline, LegendEntry[]>();
    for (const e of filtered) {
      const arr = map.get(e.discipline) ?? [];
      arr.push(e);
      map.set(e.discipline, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <View style={styles.host} testID="symbol-legend">
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.title}>Symbol Legend</Text>
          <Text style={styles.subtitle}>
            {filtered.length} of {LEGEND.length} entries
            {residentialOnly ? ' · residential' : ''}
          </Text>
        </View>
        <View style={styles.searchHost}>
          <Ionicons name="search-outline" size={13} color="rgba(255,255,255,0.55)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search symbols…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.searchInput}
            testID="symbol-legend-search"
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.discFilterStrip}
        contentContainerStyle={styles.discFilterContent}
      >
        <FilterChip
          label="All"
          active={activeDisc === null}
          onPress={() => setActiveDisc(null)}
          testID="legend-filter-all"
        />
        {ALL_SYMBOL_DISCIPLINES.map((d) => {
          const s = getDisciplineStyle(d);
          return (
            <FilterChip
              key={d}
              label={`${s.code} · ${s.label}`}
              fg={s.fg}
              active={activeDisc === d}
              onPress={() => setActiveDisc(d)}
              testID={`legend-filter-${d}`}
            />
          );
        })}
      </ScrollView>

      <ScrollView style={styles.body}>
        {grouped.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={24} color="rgba(255,255,255,0.40)" />
            <Text style={styles.emptyText}>No symbols match.</Text>
          </View>
        ) : (
          grouped.map(([disc, entries]) => {
            const s = getDisciplineStyle(disc);
            return (
              <View key={disc} style={styles.group}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupCode, { backgroundColor: s.fg + '22' }]}>
                    <Text style={[styles.groupCodeText, { color: s.fg }]}>{s.code}</Text>
                  </View>
                  <Text style={styles.groupLabel}>{s.label}</Text>
                  <Text style={styles.groupCount}>{entries.length}</Text>
                </View>
                {entries.map((entry) => (
                  <View
                    key={entry.classKey}
                    style={styles.entryRow}
                    testID={`legend-entry-${entry.classKey}`}
                  >
                    <View style={[styles.symbolGlyph, { borderColor: s.fg + '55' }]}>
                      <Text style={[styles.symbolGlyphText, { color: s.fg }]}>
                        {entry.symbol}
                      </Text>
                    </View>
                    <View style={styles.entryBody}>
                      <Text style={styles.entryName}>{prettyClassName(entry.classKey)}</Text>
                      <Text style={styles.entryDesc}>{entry.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  fg,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  fg?: string;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      style={({ hovered }: any) => [
        styles.chip,
        active && styles.chipActive,
        active && fg ? { borderColor: fg + '88' } : null,
        hovered && !active && styles.chipHover,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          active && styles.chipLabelActive,
          active && fg ? { color: fg } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
    marginTop: 2,
  },
  searchHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    minWidth: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.92)',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  discFilterStrip: {
    flexGrow: 0,
  },
  discFilterContent: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  chipHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.2,
  },
  chipLabelActive: {
    color: '#fbbf24',
  },
  body: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
  },
  group: {
    marginBottom: 18,
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  groupCode: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCodeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  groupLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  groupCount: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    fontVariant: ['tabular-nums'],
  },
  entryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 4,
  },
  symbolGlyph: {
    width: 36,
    height: 36,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolGlyphText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  entryBody: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  entryName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
  },
  entryDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    lineHeight: 15,
  },
});
