/**
 * TakeoffTab â€” Wave 13 (Commercial Blueprint mode, canvas-on-stage).
 *
 * Owner of the Takeoff UX. Layout:
 *
 *   [ModeSwitcher: Commercial Â· Residential Â· Smart Room (soon) Â· Roofing (soon)]
 *   [Canvas â€” switches on activeCard via store]
 *   [BottomChipStrip: Sheet Viewer Â· Assemblies Â· Quantities Â· Symbol Legend]
 *
 * Wave 13 deltas vs Wave 8:
 *   - UI state moved to `takeoffUiStore` so the Tim Rail Context tab can
 *     observe (and Wave 14 Controls can drive) without prop-drilling.
 *   - Sheet Viewer card uses the new `SheetViewerWithOverlay` (big sheet
 *     on stage + bottom chip strip + slide-in side panel) â€” replaces the
 *     left-thumbnail-strip layout from Wave 8.
 *   - Quantities card swaps to `QuantityTableEditable` (inline-edit cells,
 *     truth dropdown, Save-all).
 *   - Assemblies card swaps to `AssemblyTableV2` (adds tariff column +
 *     row-click highlights source sheets on the bottom chip strip).
 *   - Legend card swaps to `SymbolLegendPanel` (12-discipline visual key
 *     with per-discipline show/hide toggle wired to the store).
 *
 * Backward compatibility: the original Wave 8 components (SheetViewer,
 * AssemblyTable, QuantityTable, SymbolLegend) remain on disk and continue
 * to power Residential mode + tests that target older selectors.
 *
 * Aspire Law #7: render layer only. Hooks own all fetch logic.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import { useTakeoffSymbols } from '@/hooks/useTakeoffSymbols';
import { useTakeoffAssemblies } from '@/hooks/useTakeoffAssemblies';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import { usePushToMaterials } from '@/hooks/usePushToMaterials';
import type {
  BlueprintSheet,
  BlueprintSheetRead,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import {
  takeoffUiActions,
  useTakeoffUi,
  type TakeoffCard,
  type TakeoffMode,
} from '@/lib/takeoffUiStore';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { ModeSwitcher, type TakeoffMode as LegacyMode } from './ModeSwitcher';
import { CommercialBlueprintMode } from './CommercialBlueprintMode';
import { ResidentialBlueprintMode } from './ResidentialBlueprintMode';
import type { TakeoffCardKey, TakeoffSharedState } from './takeoffShared';

const WAVE_27_NOTE =
  'Symbol overlay + assemblies require Wave 2.7 backend reads (PR pending merge).';

// ---------------------------------------------------------------------------
// Card-key adapter â€” store uses snake_case ('sheet_viewer'), the shared
// TakeoffSharedState uses kebab ('sheet-viewer'). Map between them so
// existing tests + Residential mode keep working without churn.
// ---------------------------------------------------------------------------

const CARD_TO_LEGACY: Record<TakeoffCard, TakeoffCardKey> = {
  sheet_viewer: 'sheet-viewer',
  assemblies: 'assemblies',
  quantities: 'quantities',
  symbol_legend: 'legend',
};
const LEGACY_TO_CARD: Record<TakeoffCardKey, TakeoffCard> = {
  'sheet-viewer': 'sheet_viewer',
  assemblies: 'assemblies',
  quantities: 'quantities',
  legend: 'symbol_legend',
};

// Mode adapter â€” store uses snake_case, legacy ModeSwitcher uses kebab.
const MODE_TO_LEGACY: Record<TakeoffMode, LegacyMode> = {
  commercial: 'commercial',
  residential: 'residential',
  smart_room: 'smart-room',
  roofing: 'roofing',
};
const LEGACY_TO_MODE: Record<LegacyMode, TakeoffMode> = {
  commercial: 'commercial',
  residential: 'residential',
  'smart-room': 'smart_room',
  roofing: 'roofing',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TakeoffTab(): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();
  const projectId =
    snap.response?.ingest?.project_id ??
    snap.response?.project_id ??
    snap.projectId ??
    null;

  // â”€â”€â”€â”€ UI store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ui = useTakeoffUi();
  const actions = takeoffUiActions();

  // â”€â”€â”€â”€ Live polling (drives the real sheet list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const poll = useBlueprintProjectPoll(projectId);

  // Real sheets from the poll hook â†’ fall back to synthesized stubs from
  // the upload response so the viewer has something to render before the
  // first poll lands.
  const sheetIdsFromUpload = snap.response?.ingest?.sheet_ids ?? [];
  const sheets: BlueprintSheetRead[] = useMemo(() => {
    if (poll.sheets.length > 0) return poll.sheets;
    return sheetIdsFromUpload.map((id, idx) => ({
      id,
      sheet_number: `A${(idx + 1).toString().padStart(3, '0')}`,
      sheet_code: null,
      sheet_title: null,
      discipline: null,
      scale: null,
      revision: 0,
      supersedes_id: null,
      thumbnail_url: null,
      seal_detected: false,
      created_at: new Date().toISOString(),
    }));
  }, [poll.sheets, sheetIdsFromUpload]);

  // Legacy BlueprintSheet shape â€” required by the Wave 8 Residential mode
  // + CommercialBlueprintMode shared shell (kept for backward compat).
  const legacySheets: BlueprintSheet[] = useMemo(
    () =>
      sheets.map((s) => ({
        sheet_id: s.id,
        sheet_number: s.sheet_number ?? '',
        discipline: s.discipline,
        revision: s.revision ?? 0,
        superseded_by_sheet_id: null,
        thumbnail_url: s.thumbnail_url,
      })),
    [sheets],
  );

  // Auto-select first sheet when sheets land.
  useEffect(() => {
    if (!ui.activeSheetId && sheets.length > 0) {
      actions.setActiveSheetId(sheets[0].id);
    }
    // actions is a stable factory call â€” safe to exclude.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, ui.activeSheetId]);

  // â”€â”€â”€â”€ Data hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sym = useTakeoffSymbols(projectId, {
    sheet_id: ui.activeSheetId ?? undefined,
  });
  const asm = useTakeoffAssemblies(projectId);
  const mat = useTakeoffMaterials(projectId);
  const push = usePushToMaterials(projectId);

  // Local override map (Wave 8 contract â€” confirm/reclassify/drop on
  // the legacy SymbolActionModal still uses this). New side panel actions
  // are pure console.info stubs.
  const [symbolOverrides, setSymbolOverrides] = useState<
    Record<string, { status?: TakeoffSymbol['status']; override_class?: string }>
  >({});

  const mergedSymbols = useMemo(
    () =>
      sym.symbols.map((s) => {
        const ov = symbolOverrides[s.symbol_id];
        return ov ? { ...s, ...ov } : s;
      }),
    [sym.symbols, symbolOverrides],
  );

  const applySymbolAction = useCallback(
    (
      symbol: TakeoffSymbol,
      action: 'confirm' | 'reclassify' | 'drop',
      newClass?: string,
    ) => {
      setSymbolOverrides((prev) => ({
        ...prev,
        [symbol.symbol_id]:
          action === 'confirm'
            ? { status: 'confirmed' }
            : action === 'reclassify'
              ? { status: 'reclassified', override_class: newClass ?? symbol.class }
              : { status: 'dropped' },
      }));
      actions.setSelectedSymbolId(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Selected-symbol object for downstream consumers.
  const selectedSymbol = useMemo(
    () => mergedSymbols.find((s) => s.symbol_id === ui.selectedSymbolId) ?? null,
    [mergedSymbols, ui.selectedSymbolId],
  );

  const sharedState: TakeoffSharedState = {
    activeCard: CARD_TO_LEGACY[ui.activeCard],
    activeSheetId: ui.activeSheetId,
    setActiveSheetId: actions.setActiveSheetId,
    symbols: mergedSymbols,
    symbolsEndpointMissing: sym.endpointMissing,
    isLoadingSymbols: sym.isLoading,
    assemblies: asm.assemblies,
    assembliesEndpointMissing: asm.endpointMissing,
    isLoadingAssemblies: asm.isLoading,
    materials: mat.materials,
    materialsEndpointMissing: mat.endpointMissing,
    isLoadingMaterials: mat.isLoading,
    selectedSymbol,
    setSelectedSymbol: (s) => actions.setSelectedSymbolId(s?.symbol_id ?? null),
    overlayVisible: ui.overlayVisible,
    toggleOverlay: actions.toggleOverlayVisible,
    applySymbolAction,
    push,
    markMaterialsInBundle: mat.markInBundle,
  };

  // â”€â”€â”€â”€ Chip strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const chips: BottomChip<TakeoffCard>[] = useMemo(
    () => [
      {
        key: 'sheet_viewer',
        icon: 'map-outline',
        label: 'Sheet Viewer',
        stat: sheets.length > 0 ? `${sheets.length} sheets` : 'Upload first',
        badge: sheets.length > 0 ? `${sheets.length}` : undefined,
      },
      {
        key: 'assemblies',
        icon: 'construct-outline',
        label: 'Assemblies',
        stat: asm.endpointMissing
          ? 'Wave 2.7 pending'
          : asm.isLoading
            ? 'Loadingâ€¦'
            : `${asm.assemblies.length} derived`,
        badge: asm.assemblies.length > 0 ? `${asm.assemblies.length}` : undefined,
      },
      {
        key: 'quantities',
        icon: 'calculator-outline',
        label: 'Quantities',
        stat: mat.endpointMissing
          ? 'Wave 2.7 pending'
          : mat.isLoading
            ? 'Loadingâ€¦'
            : `${mat.materials.length} items`,
        badge: mat.materials.length > 0 ? `${mat.materials.length}` : undefined,
      },
      {
        key: 'symbol_legend',
        icon: 'pricetags-outline',
        label: 'Symbol Legend',
        stat: 'CSI / AIA refs',
      },
    ],
    [sheets.length, asm, mat],
  );

  // â”€â”€â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!projectId) {
    return (
      <View style={styles.tab} testID="takeoff-tab">
        <View style={styles.emptyHost} testID="takeoff-empty-state">
          <View style={styles.emptyIconCircle}>
            <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.emptyTitle}>Takeoff is empty</Text>
          <Text style={styles.emptyBody}>
            Drop a plan set in Plans & Photos to see the takeoff here.
          </Text>
          <Link href="/service-hub/estimate-studio/plans-photos" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Go to Plans & Photos"
              testID="takeoff-empty-link"
              style={({ hovered }: any) => [
                styles.emptyCta,
                hovered ? styles.emptyCtaHover : null,
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={14} color="#fbbf24" />
              <Text style={styles.emptyCtaText}>Open Plans & Photos</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  const isResidential = ui.activeMode === 'residential';

  return (
    <View style={styles.tab} testID="takeoff-tab">
      {/* Top mode-switcher pills */}
      <View style={styles.modeBar}>
        <ModeSwitcher
          active={MODE_TO_LEGACY[ui.activeMode]}
          onChange={(legacy) => actions.setActiveMode(LEGACY_TO_MODE[legacy])}
        />
      </View>

      {/* Wave 2.7 banner â€” visible while any GET returns 404/501. */}
      {sym.endpointMissing || asm.endpointMissing || mat.endpointMissing ? (
        <View
          style={styles.wave27Banner}
          testID="takeoff-wave-27-banner"
          accessibilityRole="alert"
        >
          <Ionicons name="information-circle-outline" size={13} color="#fbbf24" />
          <Text style={styles.wave27Text}>{WAVE_27_NOTE}</Text>
        </View>
      ) : null}

      {/* Canvas â€” Commercial uses new Wave 13 surface; Residential keeps Wave 8 shell. */}
      <View style={styles.canvas}>
        {isResidential ? (
          <ResidentialBlueprintMode state={sharedState} sheets={legacySheets} />
        ) : (
          <CommercialBlueprintMode
            state={sharedState}
            sheets={legacySheets}
            sheetsV2={sheets}
            materialsForAssemblyTable={mat.materials}
            highlightedSheetIds={ui.highlightedSheetIds}
            hiddenDisciplines={ui.hiddenSymbolDisciplines}
            onAssemblyRowClick={actions.setHighlightedSheetIds}
            onToggleSymbolDiscipline={actions.toggleSymbolDiscipline}
          />
        )}
      </View>

      <BottomChipStrip
        chips={chips}
        activeKey={ui.activeCard}
        onChange={(k) => actions.setActiveCard(k)}
        testID="takeoff-chip-strip"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Re-export for testing helpers and the Context tab.
// ---------------------------------------------------------------------------

export { LEGACY_TO_CARD, CARD_TO_LEGACY };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  modeBar: {
    paddingHorizontal: 2,
  },
  wave27Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  wave27Text: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  canvas: {
    flex: 1,
    minHeight: 320,
  },
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 36,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 18,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.40)',
    marginTop: 6,
  },
  emptyCtaHover: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  emptyCtaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.05,
  },
});
