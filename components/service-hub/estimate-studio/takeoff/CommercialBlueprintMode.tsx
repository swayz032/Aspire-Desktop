/**
 * CommercialBlueprintMode — Wave 13.
 *
 * Routes the active card chip to the Wave 13 surfaces:
 *   sheet-viewer  → <SheetViewerWithOverlay />   (replaces SheetViewer)
 *   assemblies    → <AssemblyTableV2 />          (adds tariff + highlight)
 *   quantities    → <QuantityTableEditable />    (inline-edit cells)
 *   legend        → <SymbolLegendPanel />        (per-discipline toggles)
 *
 * The legacy SymbolActionModal + PushToMaterialsConfirm stay mounted so the
 * old confirm/reclassify/drop and YELLOW push-to-bundle paths keep working
 * during the v1 stub period. The new side panel inside SheetViewerWithOverlay
 * delegates Confirm/RFI/Edit to console.info per spec.
 */
import React from 'react';
import type {
  BlueprintSheet,
  BlueprintSheetRead,
  TakeoffMaterial,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { SheetViewerWithOverlay } from './SheetViewerWithOverlay';
import { AssemblyTableV2 } from './AssemblyTableV2';
import { QuantityTableEditable } from './QuantityTableEditable';
import { SymbolLegendPanel } from './SymbolLegendPanel';
import { SymbolActionModal } from './SymbolActionModal';
import { PushToMaterialsConfirm } from './PushToMaterialsConfirm';
import type { TakeoffCardKey, TakeoffSharedState } from './takeoffShared';
import type { SymbolDiscipline } from './symbolClasses';

interface Props {
  state: TakeoffSharedState;
  /** Legacy BlueprintSheet[] — for the Residential mode + SymbolActionModal. */
  sheets: BlueprintSheet[];
  /** Wave 13 BlueprintSheetRead[] — full live shape from the poll hook. */
  sheetsV2: BlueprintSheetRead[];
  /** Used by AssemblyTableV2 to compute the tariff column. */
  materialsForAssemblyTable: TakeoffMaterial[];
  /** Sheet ids currently highlighted on the bottom chip strip. */
  highlightedSheetIds: ReadonlySet<string>;
  /** Disciplines hidden in the symbol overlay. */
  hiddenDisciplines: ReadonlySet<SymbolDiscipline>;
  /** Called when a row in AssemblyTableV2 is clicked. */
  onAssemblyRowClick: (sheetIds: readonly string[]) => void;
  /** Called when a discipline eye-toggle is clicked in SymbolLegendPanel. */
  onToggleSymbolDiscipline: (d: SymbolDiscipline) => void;
}

export function CommercialBlueprintMode({
  state,
  sheets,
  sheetsV2,
  materialsForAssemblyTable,
  highlightedSheetIds,
  hiddenDisciplines,
  onAssemblyRowClick,
  onToggleSymbolDiscipline,
}: Props): React.ReactElement {
  // Symbols filtered to the active sheet for the overlay.
  const sheetScopedSymbols = state.activeSheetId
    ? state.symbols.filter((s) => s.sheet_id === state.activeSheetId)
    : state.symbols;

  const cards: Record<TakeoffCardKey, React.ReactNode> = {
    'sheet-viewer': (
      <SheetViewerWithOverlay
        sheets={sheetsV2}
        symbols={sheetScopedSymbols}
        totalSymbolCount={state.symbols.length}
        hiddenDisciplines={hiddenDisciplines}
        activeSheetId={state.activeSheetId}
        onActiveSheetChange={state.setActiveSheetId}
        selectedSymbolId={state.selectedSymbol?.symbol_id ?? null}
        onSelectSymbol={(sym: TakeoffSymbol | null) => state.setSelectedSymbol(sym)}
        overlayVisible={state.overlayVisible}
        onToggleOverlay={state.toggleOverlay}
        highlightedSheetIds={highlightedSheetIds}
        symbolsEndpointMissing={state.symbolsEndpointMissing}
      />
    ),
    assemblies: (
      <AssemblyTableV2
        assemblies={state.assemblies}
        materials={materialsForAssemblyTable}
        sheets={sheetsV2}
        isLoading={state.isLoadingAssemblies}
        endpointMissing={state.assembliesEndpointMissing}
        highlightedSheetIds={highlightedSheetIds}
        onRowClick={onAssemblyRowClick}
      />
    ),
    quantities: (
      <QuantityTableEditable
        materials={state.materials}
        isLoading={state.isLoadingMaterials}
        endpointMissing={state.materialsEndpointMissing}
      />
    ),
    legend: (
      <SymbolLegendPanel
        symbols={state.symbols}
        hiddenDisciplines={hiddenDisciplines}
        onToggleDiscipline={onToggleSymbolDiscipline}
      />
    ),
  };

  return (
    <>
      <CanvasCardSwitcher
        activeCardKey={state.activeCard}
        cards={cards}
        testID="takeoff-canvas-switcher"
      />
      {/* Legacy modal — still used by the action-modal click path in the
          Residential mode's SymbolOverlay (Wave 8 contract). The new
          SheetViewerWithOverlay handles clicks via its own side panel. */}
      <SymbolActionModal
        visible={false}
        symbol={null}
        onClose={() => state.setSelectedSymbol(null)}
        onAction={state.applySymbolAction}
      />
      <PushToMaterialsConfirm push={state.push} materials={state.materials} />
    </>
  );
}
