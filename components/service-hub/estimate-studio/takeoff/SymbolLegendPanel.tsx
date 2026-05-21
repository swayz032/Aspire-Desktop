/**
 * SymbolLegendPanel â€” Wave 13.
 *
 * Visual key for the 12-class CSI/AIA symbol palette Drew uses. Each
 * discipline is a row showing:
 *   - color swatch + code
 *   - human-readable name + description
 *   - count of detected symbols of that discipline (in current project)
 *   - eye toggle to show/hide that discipline on the overlay
 *
 * The eye toggle drives `takeoffUiStore.hiddenSymbolDisciplines`, which
 * SheetViewerWithOverlay reads to filter the overlay layer. This lets
 * contractors A/B compare e.g. "all electrical hidden" vs "all electrical
 * shown" without leaving the symbol view.
 *
 * Static catalog (hardcoded for v1): one canonical row per discipline +
 * representative class examples. When the backend KB fleshes out the full
 * CSI legend, we can fetch it instead.
 *
 * Aspire Laws:
 *   - Law #7 â€” render only. No backend writes; toggle state lives in store.
 */
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TakeoffSymbol } from '@/lib/api/blueprintsApi';
import {
  ALL_SYMBOL_DISCIPLINES,
  getDisciplineStyle,
  styleForSymbolClass,
  type SymbolDiscipline,
} from './symbolClasses';

// ---------------------------------------------------------------------------
// Catalog â€” 12-class palette. Each discipline carries 1â€“3 example classes
// so contractors learn the system. Pulled from the existing SymbolLegend
// LEGEND[] roster but condensed into per-discipline entries.
// ---------------------------------------------------------------------------

interface DisciplineRow {
  discipline: SymbolDiscipline;
  description: string;
  examples: string[];
}

const CATALOG: DisciplineRow[] = [
  {
    discipline: 'electrical',
    description: 'Outlets, switches, panels, fixtures.',
    examples: ['Duplex receptacle', 'GFCI', 'Main panel', 'Recessed downlight'],
  },
  {
    discipline: 'plumbing',
    description: 'Fixtures, drains, supply lines.',
    examples: ['Water closet', 'Lavatory', 'Shower', 'Floor cleanout'],
  },
  {
    discipline: 'structural',
    description: 'Columns, beams, load-bearing walls.',
    examples: ['Steel column', 'Steel beam', 'Bearing wall'],
  },
  {
    discipline: 'mechanical',
    description: 'HVAC equipment, diffusers, returns.',
    examples: ['Supply diffuser', 'Return grille', 'Furnace / AHU'],
  },
  {
    discipline: 'architectural',
    description: 'Doors, windows, stairs, partitions.',
    examples: ['Swing door', 'Fixed window', 'Stair'],
  },
  {
    discipline: 'fire',
    description: 'Life-safety, sprinklers, detectors.',
    examples: ['Pendant sprinkler', 'Smoke detector', 'Pull station'],
  },
  {
    discipline: 'civil',
    description: 'Drainage, grading, site features.',
    examples: ['Catch basin', 'Area drain'],
  },
  {
    discipline: 'other',
    description: 'Symbols outside the canonical eight.',
    examples: ['Reclassify recommended'],
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** All symbols on the project (used for per-discipline count badges). */
  symbols: TakeoffSymbol[];
  /** Disciplines currently hidden from the overlay. */
  hiddenDisciplines: ReadonlySet<SymbolDiscipline>;
  onToggleDiscipline: (d: SymbolDiscipline) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SymbolLegendPanel({
  symbols,
  hiddenDisciplines,
  onToggleDiscipline,
}: Props): React.ReactElement {
  const countByDiscipline = useMemo(() => {
    const map = new Map<SymbolDiscipline, number>();
    for (const sym of symbols) {
      const d = styleForSymbolClass(sym.override_class ?? sym.class).discipline;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [symbols]);

  const visibleCount = symbols.filter((sym) => {
    const d = styleForSymbolClass(sym.override_class ?? sym.class).discipline;
    return !hiddenDisciplines.has(d);
  }).length;

  return (
    <View style={styles.host} testID="symbol-legend-panel">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Symbol Legend</Text>
          <Text style={styles.subtitle}>
            {ALL_SYMBOL_DISCIPLINES.length} disciplines Â· {visibleCount} of {symbols.length} symbols visible
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              // Show all â€” clear hidden one-by-one via callbacks; we call
              // toggle for each hidden discipline.
              for (const d of hiddenDisciplines) onToggleDiscipline(d);
            }}
            accessibilityRole="button"
            accessibilityLabel="Show all disciplines"
            testID="legend-show-all"
            style={({ hovered }: any) => [
              styles.headerBtn,
              hovered ? styles.headerBtnHover : null,
            ]}
          >
            <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.78)" />
            <Text style={styles.headerBtnText}>Show all</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              for (const d of ALL_SYMBOL_DISCIPLINES) {
                if (!hiddenDisciplines.has(d)) onToggleDiscipline(d);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Hide all disciplines"
            testID="legend-hide-all"
            style={({ hovered }: any) => [
              styles.headerBtn,
              hovered ? styles.headerBtnHover : null,
            ]}
          >
            <Ionicons name="eye-off-outline" size={12} color="rgba(255,255,255,0.78)" />
            <Text style={styles.headerBtnText}>Hide all</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {CATALOG.map((row) => {
          const style = getDisciplineStyle(row.discipline);
          const count = countByDiscipline.get(row.discipline) ?? 0;
          const isHidden = hiddenDisciplines.has(row.discipline);

          return (
            <View
              key={row.discipline}
              style={[
                styles.row,
                isHidden ? styles.rowHidden : null,
              ]}
              testID={`legend-row-${row.discipline}`}
            >
              <View
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: style.fill,
                    borderColor: style.fg,
                  },
                ]}
              >
                <Text style={[styles.colorSwatchCode, { color: style.fg }]}>
                  {style.code}
                </Text>
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowHeader}>
                  <Text
                    style={[
                      styles.rowName,
                      isHidden ? styles.rowNameHidden : null,
                    ]}
                  >
                    {style.label}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      { borderColor: style.fg + '55' },
                    ]}
                  >
                    <Text style={[styles.countPillText, { color: style.fg }]}>
                      {count}
                    </Text>
                  </View>
                </View>
                <Text style={styles.rowDescription} numberOfLines={1}>
                  {row.description}
                </Text>
                <View style={styles.exampleStrip}>
                  {row.examples.map((ex, i) => (
                    <View
                      key={`${row.discipline}-${i}`}
                      style={styles.examplePill}
                    >
                      <Text style={styles.examplePillText} numberOfLines={1}>
                        {ex}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={() => onToggleDiscipline(row.discipline)}
                accessibilityRole="switch"
                accessibilityLabel={`Toggle ${style.label} overlay`}
                accessibilityState={{ checked: !isHidden }}
                testID={`legend-toggle-${row.discipline}`}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.eyeBtn,
                  isHidden ? styles.eyeBtnOff : styles.eyeBtnOn,
                  hovered ? styles.eyeBtnHover : null,
                  pressed ? styles.eyeBtnPressed : null,
                ]}
              >
                <Ionicons
                  name={isHidden ? 'eye-off-outline' : 'eye'}
                  size={14}
                  color={isHidden ? 'rgba(255,255,255,0.55)' : style.fg}
                />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Ionicons
          name="information-circle-outline"
          size={11}
          color="rgba(255,255,255,0.45)"
        />
        <Text style={styles.footerText}>
          Drew classifies symbols using CSI / AIA conventions. Toggle a row
          to filter the overlay layer in the Sheet Viewer.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.10)',
  },
  header: {
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
    letterSpacing: -0.05,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 120ms ease, border-color 120ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  headerBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.05,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'opacity 150ms ease, background-color 150ms ease',
        } as any)
      : {}),
  },
  rowHidden: {
    opacity: 0.45,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchCode: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.15,
  },
  rowNameHidden: {
    color: 'rgba(255,255,255,0.55)',
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  countPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  rowDescription: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  exampleStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  examplePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    maxWidth: 180,
  },
  examplePillText: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  eyeBtnOn: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  eyeBtnOff: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  eyeBtnHover: {
    ...(Platform.OS === 'web'
      ? ({ filter: 'brightness(1.15)' } as any)
      : { opacity: 0.85 }),
  },
  eyeBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
});

export default SymbolLegendPanel;
