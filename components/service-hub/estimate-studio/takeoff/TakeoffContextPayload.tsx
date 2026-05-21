/**
 * TakeoffContextPayload â€” Wave 13.
 *
 * Tim Rail Context tab payload for the Takeoff tab. Mirrors the
 * PlansPhotosContextPayload pattern (uses the shared `<ContextTabPayload />`
 * shell with titled sections).
 *
 * Sections:
 *   1. Current sheet meta â€” sheet code, discipline, revision, scale
 *   2. Symbol confidence â€” mini horizontal bar showing average per active sheet
 *   3. Selected symbol â€” present when a bbox is clicked; class, count, bbox
 *      area, confidence
 *   4. Tariff exposure â€” count of tariff-flagged materials on this sheet
 *   5. Cross-link â€” "Open in Plans & Photos" jumps back with same sheet
 *
 * Wave 13 implements section 1, 2, 3, 4 in render; section 5 calls
 * `useRouter().push()` to switch tabs. Reads UI state from `useTakeoffUi()`.
 *
 * Aspire Law #7: render only.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type {
  BlueprintSheetRead,
  TakeoffMaterial,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import {
  ContextTabPayload,
  type ContextSection,
} from '../shell/ContextTabPayload';
import { getDisciplineStyle as getSheetDisciplineStyle } from '../plans-photos/disciplines';
import {
  styleForSymbolClass,
  prettyClassName,
  type SymbolDiscipline,
} from './symbolClasses';
import { useTakeoffUi } from '@/lib/takeoffUiStore';

interface Props {
  sheets: BlueprintSheetRead[];
  symbols: TakeoffSymbol[];
  materials: TakeoffMaterial[];
  /** True when the symbols endpoint is missing (Wave 2.7 pending). */
  endpointMissing?: boolean;
  testID?: string;
}

export function TakeoffContextPayload({
  sheets,
  symbols,
  materials,
  endpointMissing = false,
  testID = 'takeoff-context-payload',
}: Props): React.ReactElement {
  const ui = useTakeoffUi();
  const router = useRouter();

  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === ui.activeSheetId) ?? null,
    [sheets, ui.activeSheetId],
  );

  const sheetSymbols = useMemo(
    () =>
      activeSheet
        ? symbols.filter((sym) => sym.sheet_id === activeSheet.id)
        : [],
    [symbols, activeSheet],
  );

  const selectedSymbol = useMemo(
    () => symbols.find((sym) => sym.symbol_id === ui.selectedSymbolId) ?? null,
    [symbols, ui.selectedSymbolId],
  );

  const avgConfidence = useMemo(() => {
    if (sheetSymbols.length === 0) return 0;
    const sum = sheetSymbols.reduce((acc, s) => acc + s.confidence, 0);
    return sum / sheetSymbols.length;
  }, [sheetSymbols]);

  const confidenceBuckets = useMemo(() => {
    let high = 0;
    let mid = 0;
    let low = 0;
    for (const s of sheetSymbols) {
      if (s.confidence >= 0.75) high += 1;
      else if (s.confidence >= 0.5) mid += 1;
      else low += 1;
    }
    return { high, mid, low, total: sheetSymbols.length };
  }, [sheetSymbols]);

  // Tariff exposure scoped to current sheet (best-effort â€” Wave 2.7 will
  // give us a real materialâ†”sheet join).
  const tariffCount = useMemo(() => {
    if (!activeSheet) return 0;
    return materials.filter((m) => m.tariff_flag !== 'none').length;
  }, [materials, activeSheet]);

  const sections: ContextSection[] = [];

  // â”€â”€ Section 1: Current sheet meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sections.push({
    key: 'current-sheet',
    title: 'Current Sheet',
    subtitle: activeSheet
      ? `${sheetSymbols.length} symbols on this sheet`
      : 'No sheet selected',
    render: () => {
      if (!activeSheet) {
        return (
          <Text style={styles.mutedText}>
            Pick a sheet in the bottom strip to see its metadata here.
          </Text>
        );
      }
      const discStyle = getSheetDisciplineStyle(activeSheet.discipline);
      return (
        <View style={styles.sheetMetaBlock}>
          <View style={styles.sheetCodeRow}>
            <View
              style={[
                styles.sheetCodePill,
                { backgroundColor: discStyle.fg + '22', borderColor: discStyle.fg + '55' },
              ]}
            >
              <Text style={[styles.sheetCodePillText, { color: discStyle.fg }]}>
                {discStyle.code}
              </Text>
            </View>
            <Text style={styles.sheetCodeText}>
              {activeSheet.sheet_code ??
                `${discStyle.code} ${activeSheet.sheet_number ?? 'â€”'}`}
            </Text>
          </View>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {activeSheet.sheet_title ?? discStyle.label}
          </Text>
          <View style={styles.metaGrid}>
            <MetaCell label="Discipline" value={discStyle.label} />
            <MetaCell
              label="Revision"
              value={activeSheet.revision != null ? `Rev ${activeSheet.revision}` : 'â€”'}
            />
            <MetaCell label="Scale" value={activeSheet.scale ?? 'â€”'} />
            <MetaCell
              label="Seal"
              value={activeSheet.seal_detected ? 'Detected' : 'None'}
              accent={activeSheet.seal_detected ? '#34d399' : undefined}
            />
          </View>
        </View>
      );
    },
  });

  // â”€â”€ Section 2: Symbol confidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sections.push({
    key: 'confidence',
    title: 'Symbol Confidence',
    subtitle: activeSheet
      ? `Avg ${Math.round(avgConfidence * 100)}% across ${confidenceBuckets.total} symbols`
      : 'Awaiting sheet selection',
    render: () => {
      if (!activeSheet || confidenceBuckets.total === 0) {
        return (
          <Text style={styles.mutedText}>
            {endpointMissing
              ? 'Confidence stats unlock when Wave 2.7 backend lands.'
              : 'No symbols detected on this sheet yet.'}
          </Text>
        );
      }
      return (
        <View style={styles.confidenceBlock}>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFillHigh,
                {
                  flex: confidenceBuckets.high,
                  minWidth: confidenceBuckets.high > 0 ? 4 : 0,
                },
              ]}
            />
            <View
              style={[
                styles.confidenceFillMid,
                {
                  flex: confidenceBuckets.mid,
                  minWidth: confidenceBuckets.mid > 0 ? 4 : 0,
                },
              ]}
            />
            <View
              style={[
                styles.confidenceFillLow,
                {
                  flex: confidenceBuckets.low,
                  minWidth: confidenceBuckets.low > 0 ? 4 : 0,
                },
              ]}
            />
          </View>
          <View style={styles.confidenceLegend}>
            <ConfidenceDot color="#34d399" label={`High ${confidenceBuckets.high}`} />
            <ConfidenceDot color="#fbbf24" label={`Mid ${confidenceBuckets.mid}`} />
            <ConfidenceDot color="#f87171" label={`Low ${confidenceBuckets.low}`} />
          </View>
        </View>
      );
    },
  });

  // â”€â”€ Section 3: Selected symbol detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (selectedSymbol) {
    const symStyle = styleForSymbolClass(
      selectedSymbol.override_class ?? selectedSymbol.class,
    );
    const sameTypeCount = symbols.filter(
      (s) =>
        s.sheet_id === selectedSymbol.sheet_id &&
        s.class === selectedSymbol.class,
    ).length;
    const bboxAreaPct = (
      selectedSymbol.bbox.w *
      selectedSymbol.bbox.h *
      100
    ).toFixed(2);

    sections.push({
      key: 'selected-symbol',
      title: 'Selected Symbol',
      subtitle: 'Inspector',
      render: () => (
        <View style={styles.selectedBlock}>
          <View style={styles.selectedHeader}>
            <View
              style={[
                styles.selectedCode,
                { backgroundColor: symStyle.fg + '22', borderColor: symStyle.fg + '55' },
              ]}
            >
              <Text style={[styles.selectedCodeText, { color: symStyle.fg }]}>
                {symStyle.code}
              </Text>
            </View>
            <View style={styles.selectedTitleBlock}>
              <Text style={styles.selectedTitle} numberOfLines={2}>
                {prettyClassName(
                  selectedSymbol.override_class ?? selectedSymbol.class,
                )}
              </Text>
              <Text style={styles.selectedSubtitle}>{symStyle.label}</Text>
            </View>
          </View>
          <View style={styles.metaGrid}>
            <MetaCell
              label="Confidence"
              value={`${Math.round(selectedSymbol.confidence * 100)}%`}
              accent={
                selectedSymbol.confidence >= 0.75
                  ? '#34d399'
                  : selectedSymbol.confidence >= 0.5
                    ? '#fbbf24'
                    : '#f87171'
              }
            />
            <MetaCell label="Status" value={selectedSymbol.status ?? 'detected'} />
            <MetaCell label="Same type" value={`${sameTypeCount}Ã—`} />
            <MetaCell label="Bbox area" value={`${bboxAreaPct}%`} />
          </View>
        </View>
      ),
    });
  }

  // â”€â”€ Section 4: Tariff exposure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sections.push({
    key: 'tariff',
    title: 'Tariff Exposure',
    subtitle:
      tariffCount > 0
        ? `${tariffCount} flagged material${tariffCount === 1 ? '' : 's'}`
        : 'No flagged materials',
    render: () => (
      <View style={styles.tariffBlock}>
        {tariffCount === 0 ? (
          <Text style={styles.mutedText}>
            No materials on this sheet carry a tariff flag. Push-to-Bundle
            unlocks once PROCURE pass finishes.
          </Text>
        ) : (
          <View style={styles.tariffRow}>
            <Ionicons name="flag-outline" size={13} color="#f87171" />
            <Text style={styles.tariffText}>
              {tariffCount} line{tariffCount === 1 ? '' : 's'} flagged. Review in Quantities.
            </Text>
          </View>
        )}
      </View>
    ),
  });

  // â”€â”€ Section 5: Cross-link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sections.push({
    key: 'cross-link',
    title: 'Cross-tab',
    render: () => (
      <Pressable
        onPress={() => {
          // Plans & Photos uses its own UI store for the active sheet, so
          // this just navigates â€” Wave 14 will sync the active sheet across
          // the two stores via a shared activeSheetStore.
          router.push('/service-hub/estimate-studio/plans-photos');
        }}
        accessibilityRole="link"
        accessibilityLabel="Open this sheet in Plans & Photos"
        testID="takeoff-context-open-plans-photos"
        style={({ hovered }: any) => [
          styles.crossLink,
          hovered ? styles.crossLinkHover : null,
        ]}
      >
        <Ionicons name="open-outline" size={12} color="#fbbf24" />
        <Text style={styles.crossLinkText}>Open in Plans & Photos</Text>
      </Pressable>
    ),
  });

  return <ContextTabPayload sections={sections} testID={testID} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetaCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): React.ReactElement {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

function ConfidenceDot({
  color,
  label,
}: {
  color: string;
  label: string;
}): React.ReactElement {
  return (
    <View style={styles.confidenceDotRow}>
      <View style={[styles.confidenceDot, { backgroundColor: color }]} />
      <Text style={styles.confidenceDotLabel}>{label}</Text>
    </View>
  );
}

// Re-export the SymbolDiscipline type so consumers can wire their own
// discipline-aware components without reaching into symbolClasses.
export type { SymbolDiscipline };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  mutedText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    lineHeight: 15,
  },
  // Current sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sheetMetaBlock: {
    gap: 8,
  },
  sheetCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetCodePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  sheetCodePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sheetCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.2,
  },
  sheetTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaCell: {
    minWidth: 80,
    flexGrow: 1,
    gap: 2,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  // Confidence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  confidenceBlock: {
    gap: 8,
  },
  confidenceBar: {
    height: 6,
    flexDirection: 'row',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  confidenceFillHigh: {
    backgroundColor: '#34d399',
  },
  confidenceFillMid: {
    backgroundColor: '#fbbf24',
  },
  confidenceFillLow: {
    backgroundColor: '#f87171',
  },
  confidenceLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  confidenceDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confidenceDotLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.70)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  // Selected symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectedBlock: {
    gap: 8,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  selectedCode: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCodeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectedTitleBlock: {
    flex: 1,
    gap: 2,
  },
  selectedTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.15,
  },
  selectedSubtitle: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  // Tariff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tariffBlock: {
    gap: 6,
  },
  tariffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(248,113,113,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.30)',
  },
  tariffText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  // Cross-link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  crossLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
    alignSelf: 'flex-start',
  },
  crossLinkHover: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  crossLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.05,
  },
});

export default TakeoffContextPayload;
