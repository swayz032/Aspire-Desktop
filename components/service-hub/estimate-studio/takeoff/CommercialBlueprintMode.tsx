/**
 * CommercialBlueprintMode — Wave 8.
 *
 * Container for the commercial blueprint takeoff workflow. Hosts the 4
 * canvas cards (Sheet Viewer / Assemblies / Quantities / Legend) and owns
 * the cross-card state: active sheet, selected symbol, overlay visibility.
 *
 * Renders <CanvasCardSwitcher /> (shared shell) with the active card. The
 * actual chip strip + tab-level state lives in <TakeoffTab />.
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
  /** True when residential filtering is wanted on the legend. */
  residentialLegend?: boolean;
}

export function CommercialBlueprintMode({
  state,
  sheets,
  residentialLegend = false,
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
    legend: <SymbolLegend residentialOnly={residentialLegend} />,
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
