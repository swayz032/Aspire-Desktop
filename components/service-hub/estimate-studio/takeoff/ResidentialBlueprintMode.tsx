/**
 * ResidentialBlueprintMode — Wave 8 (preserved through Wave 13).
 *
 * Wave 13 split: Commercial mode runs on the new canvas-on-stage surface
 * (SheetViewerWithOverlay + AssemblyTableV2 + QuantityTableEditable +
 * SymbolLegendPanel). Residential mode keeps the original Wave 8 thumb-strip
 * surface intact so we don't churn the residential symbol set / push flow
 * mid-stream — that's a follow-up wave.
 */
import React from 'react';
import type { BlueprintSheet, TakeoffSymbol } from '@/lib/api/blueprintsApi';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { SheetViewer } from './SheetViewer';
import { AssemblyTable } from './AssemblyTable';
import { QuantityTable } from './QuantityTable';
import { SymbolLegend } from './SymbolLegend';
import { SymbolActionModal } from './SymbolActionModal';
import { PushToMaterialsConfirm } from './PushToMaterialsConfirm';
import type { TakeoffCardKey, TakeoffSharedState } from './takeoffShared';

interface Props {
  state: TakeoffSharedState;
  sheets: BlueprintSheet[];
}

export function ResidentialBlueprintMode({
  state,
  sheets,
}: Props): React.ReactElement {
  const cards: Record<TakeoffCardKey, React.ReactNode> = {
    'sheet-viewer': (
      <SheetViewer
        sheets={sheets}
        activeSheetId={state.activeSheetId}
        onSheetChange={state.setActiveSheetId}
        symbols={state.symbols}
        symbolsEndpointMissing={state.symbolsEndpointMissing}
        selectedSymbolId={state.selectedSymbol?.symbol_id ?? null}
        onSelectSymbol={(sym: TakeoffSymbol | null) => state.setSelectedSymbol(sym)}
        overlayVisible={state.overlayVisible}
        onToggleOverlay={state.toggleOverlay}
      />
    ),
    assemblies: (
      <AssemblyTable
        assemblies={state.assemblies}
        sheets={sheets}
        isLoading={state.isLoadingAssemblies}
        endpointMissing={state.assembliesEndpointMissing}
      />
    ),
    quantities: (
      <QuantityTable
        materials={state.materials}
        isLoading={state.isLoadingMaterials}
        endpointMissing={state.materialsEndpointMissing}
        push={state.push}
        onPushedIds={state.markMaterialsInBundle}
      />
    ),
    legend: <SymbolLegend residentialOnly />,
  };

  return (
    <>
      <CanvasCardSwitcher
        activeCardKey={state.activeCard}
        cards={cards}
        testID="takeoff-canvas-switcher"
      />
      <SymbolActionModal
        visible={state.selectedSymbol != null}
        symbol={state.selectedSymbol}
        onClose={() => state.setSelectedSymbol(null)}
        onAction={state.applySymbolAction}
      />
      <PushToMaterialsConfirm push={state.push} materials={state.materials} />
    </>
  );
}
