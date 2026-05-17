/**
 * Shared types for Wave 8 Takeoff tab — the chip-card keys and the
 * orchestrator state shape passed to mode containers.
 */
import type {
  TakeoffSymbol,
  TakeoffAssembly,
  TakeoffMaterial,
} from '@/lib/api/blueprintsApi';
import type { UsePushToMaterialsResult } from '@/hooks/usePushToMaterials';

export type TakeoffCardKey = 'sheet-viewer' | 'assemblies' | 'quantities' | 'legend';

export interface TakeoffSharedState {
  activeCard: TakeoffCardKey;
  activeSheetId: string | null;
  setActiveSheetId: (id: string) => void;
  symbols: TakeoffSymbol[];
  symbolsEndpointMissing: boolean;
  isLoadingSymbols: boolean;
  assemblies: TakeoffAssembly[];
  assembliesEndpointMissing: boolean;
  isLoadingAssemblies: boolean;
  materials: TakeoffMaterial[];
  materialsEndpointMissing: boolean;
  isLoadingMaterials: boolean;
  selectedSymbol: TakeoffSymbol | null;
  setSelectedSymbol: (sym: TakeoffSymbol | null) => void;
  overlayVisible: boolean;
  toggleOverlay: () => void;
  applySymbolAction: (
    symbol: TakeoffSymbol,
    action: 'confirm' | 'reclassify' | 'drop',
    newClass?: string,
  ) => void;
  push: UsePushToMaterialsResult;
  markMaterialsInBundle: (ids: string[]) => void;
}
