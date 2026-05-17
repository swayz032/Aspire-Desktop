/**
 * TakeoffTab — Wave 8 (Commercial Blueprint mode).
 *
 * Owner of the Takeoff UX. Layout:
 *
 *   [ModeSwitcher: Commercial · Residential · Smart Room (Phase 8) · Roofing (Phase 8)]
 *   [CanvasCardSwitcher hosts ONE focused card]
 *   [BottomChipStrip: Sheet Viewer · Assemblies · Quantities · Symbol Legend]
 *
 * Empty state (no project yet): a centered hint pointing users back to
 * Plans & Photos. Once a project is uploaded the shell switches into
 * Commercial mode by default with the Sheet Viewer card active.
 *
 * Wave 2.7 degradation: if symbol/assembly/material GET endpoints return
 * 404/501, the per-card body renders a "Wave 2.7 backend pending" hint
 * and the rest of the UX is fully exercisable.
 *
 * Law #7: pure render layer. Hooks (`useTakeoff*`) own all fetch logic.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useTakeoffSymbols } from '@/hooks/useTakeoffSymbols';
import { useTakeoffAssemblies } from '@/hooks/useTakeoffAssemblies';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import { usePushToMaterials } from '@/hooks/usePushToMaterials';
import type {
  BlueprintSheet,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { ModeSwitcher, type TakeoffMode } from './ModeSwitcher';
import { CommercialBlueprintMode } from './CommercialBlueprintMode';
import { ResidentialBlueprintMode } from './ResidentialBlueprintMode';
import type { TakeoffCardKey, TakeoffSharedState } from './takeoffShared';

const WAVE_27_NOTE =
  'Symbol overlay + assemblies require Wave 2.7 backend reads (PR pending merge).';

export function TakeoffTab(): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();
  const projectId = snap.response?.project_id ?? null;
  const sheetIdsFromUpload = snap.response?.ingest.sheet_ids ?? [];

  // Wave 6.5 backend `listSheets()` not yet wired — synthesize sheets from
  // the upload response so the SheetViewer has something to render.
  // Wave 6.5 / 9 will replace this with the real `useBlueprintProject` data.
  const sheets: BlueprintSheet[] = useMemo(
    () =>
      sheetIdsFromUpload.map((id, idx) => ({
        sheet_id: id,
        sheet_number: `A${(idx + 1).toString().padStart(3, '0')}`,
        discipline: null,
        revision: 0,
        superseded_by_sheet_id: null,
        thumbnail_url: null,
      })),
    [sheetIdsFromUpload],
  );

  const [mode, setMode] = useState<TakeoffMode>('commercial');
  const [activeCard, setActiveCard] = useState<TakeoffCardKey>('sheet-viewer');
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<TakeoffSymbol | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Auto-select first sheet when sheets land.
  React.useEffect(() => {
    if (!activeSheetId && sheets.length > 0) {
      setActiveSheetId(sheets[0].sheet_id);
    }
  }, [sheets, activeSheetId]);

  // Hooks (degrade gracefully on Wave 2.7 404).
  const sym = useTakeoffSymbols(projectId, { sheet_id: activeSheetId ?? undefined });
  const asm = useTakeoffAssemblies(projectId);
  const mat = useTakeoffMaterials(projectId);
  const push = usePushToMaterials(projectId);

  // Local override map for symbol confirm/reclassify/drop actions (Wave 8
  // persists nothing; Wave 9 wires the PATCH endpoint).
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
      setSelectedSymbol(null);
    },
    [],
  );

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  const sharedState: TakeoffSharedState = {
    activeCard,
    activeSheetId,
    setActiveSheetId,
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
    setSelectedSymbol,
    overlayVisible,
    toggleOverlay,
    applySymbolAction,
    push,
    markMaterialsInBundle: mat.markInBundle,
  };

  // Chip strip
  const chips: BottomChip<TakeoffCardKey>[] = useMemo(
    () => [
      {
        key: 'sheet-viewer',
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
            ? 'Loading…'
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
            ? 'Loading…'
            : `${mat.materials.length} items`,
        badge: mat.materials.length > 0 ? `${mat.materials.length}` : undefined,
      },
      {
        key: 'legend',
        icon: 'pricetags-outline',
        label: 'Symbol Legend',
        stat: 'CSI / AIA refs',
      },
    ],
    [sheets.length, asm, mat],
  );

  // Empty state
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
              style={({ hovered }: any) => [styles.emptyCta, hovered && styles.emptyCtaHover]}
            >
              <Ionicons name="cloud-upload-outline" size={14} color="#fbbf24" />
              <Text style={styles.emptyCtaText}>Open Plans & Photos</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  const ModeBody = mode === 'residential' ? ResidentialBlueprintMode : CommercialBlueprintMode;

  return (
    <View style={styles.tab} testID="takeoff-tab">
      <View style={styles.modeBar}>
        <ModeSwitcher active={mode} onChange={setMode} />
      </View>

      {(sym.endpointMissing || asm.endpointMissing || mat.endpointMissing) ? (
        <View style={styles.wave27Banner} testID="takeoff-wave-27-banner" accessibilityRole="alert">
          <Ionicons name="information-circle-outline" size={13} color="#fbbf24" />
          <Text style={styles.wave27Text}>{WAVE_27_NOTE}</Text>
        </View>
      ) : null}

      <View style={styles.canvas}>
        <ModeBody state={sharedState} sheets={sheets} />
      </View>

      <BottomChipStrip
        chips={chips}
        activeKey={activeCard}
        onChange={setActiveCard}
        testID="takeoff-chip-strip"
      />
    </View>
  );
}

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
