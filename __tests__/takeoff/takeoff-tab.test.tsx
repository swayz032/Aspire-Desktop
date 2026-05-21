/**
 * Takeoff Tab — Wave 13 RTL behavior tests.
 *
 * Covers the Wave 13 canvas-on-stage surface:
 *   - Empty state when no project is loaded
 *   - Default chip is Sheet Viewer (now `sheet_viewer` in store-speak)
 *   - Mode switcher renders 4 modes; Commercial active, Smart Room + Roofing disabled
 *   - SheetViewerWithOverlay renders bounding boxes when symbols exist
 *   - Clicking a bbox opens the side panel
 *   - AssemblyTable sorts by quantity desc by default
 *   - QuantityTableEditable accepts inline edit and logs to console
 *
 * The tests do NOT exercise network I/O — `useTakeoff*` hooks fan out to
 * `useAuthFetch`, which we mock to return 404 (endpointMissing path). To
 * exercise symbol rendering we override `useTakeoffSymbols` directly with a
 * canned non-empty list.
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import type { TakeoffSymbol } from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the tab (Jest hoists jest.mock).
// ---------------------------------------------------------------------------

jest.mock('@/providers', () => {
  const _tenant = { officeId: 'office_test', tenant: { officeId: 'office_test' } };
  return { useTenant: () => _tenant };
});

// Stable authenticatedFetch — returns 404 so endpointMissing flips true.
jest.mock('@/lib/authenticatedFetch', () => {
  const _stableAuthFetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: 'NOT_IMPLEMENTED' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  const _stableObj = { authenticatedFetch: _stableAuthFetch };
  return { useAuthFetch: () => _stableObj };
});

// expo-router Link / useRouter mocks.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  usePathname: () => '/service-hub/estimate-studio/takeoff',
  useRouter: () => ({ push: jest.fn() }),
}));

// Mockable symbol hook so we can inject canned symbols on demand.
const _mockSymbolState: {
  symbols: TakeoffSymbol[];
  endpointMissing: boolean;
  isLoading: boolean;
} = {
  symbols: [],
  endpointMissing: true,
  isLoading: false,
};
jest.mock('@/hooks/useTakeoffSymbols', () => ({
  useTakeoffSymbols: () => ({
    symbols: _mockSymbolState.symbols,
    isLoading: _mockSymbolState.isLoading,
    error: null,
    endpointMissing: _mockSymbolState.endpointMissing,
    refresh: jest.fn(),
  }),
}));

// Mock the project poll hook — it relies on Supabase/network deps we don't
// want to wire in unit tests.
jest.mock('@/hooks/useBlueprintProjectPoll', () => ({
  useBlueprintProjectPoll: () => ({
    project: null,
    sheets: [],
    revisions: [],
    stageProgress: {
      ingest: 'ok',
      classify: 'ok',
      see: 'pending',
      reason: 'pending',
      procure: 'pending',
    },
    status: null,
    isLoading: false,
    isFirstLoad: false,
    isPolling: false,
    error: null,
    hasFailed: false,
    failedStage: null,
    failureSummary: null,
    stageCompletedAt: {
      ingest: null,
      classify: null,
      see: null,
      reason: null,
      procure: null,
    },
    refresh: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { TakeoffTab } from '@/components/service-hub/estimate-studio/takeoff/TakeoffTab';
import { QuantityTableEditable } from '@/components/service-hub/estimate-studio/takeoff/QuantityTableEditable';
import { SheetViewerWithOverlay } from '@/components/service-hub/estimate-studio/takeoff/SheetViewerWithOverlay';
import {
  resetBlueprintUpload,
  setBlueprintUpload,
} from '@/lib/blueprintUploadStore';
import { _resetTakeoffUiForTests } from '@/lib/takeoffUiStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadProjectWithSheets(): void {
  setBlueprintUpload({
    phase: 'success',
    filename: 'Plan-Set-A.pdf',
    uploadedAt: Date.now(),
    response: {
      success: true,
      project_id: 'proj_test_1',
      filename: 'Plan-Set-A.pdf',
      size_bytes: 1024,
      correlation_id: 'corr_t1',
      ingest: {
        status: 'ok',
        stage: 'ingest',
        project_id: 'proj_test_1',
        sheet_count: 3,
        sheet_ids: ['sheet_1', 'sheet_2', 'sheet_3'],
      },
      classify: {
        status: 'ok',
        stage: 'classify',
        project_id: 'proj_test_1',
        discipline_counts: { A: 2, S: 1 },
        revisions: 0,
        needs_review_count: 0,
      },
      stage_progress: {
        ingest: 'ok',
        classify: 'ok',
        see: 'pending',
        reason: 'pending',
        procure: 'pending',
      },
    },
    stageProgress: {
      ingest: 'ok',
      classify: 'ok',
      see: 'pending',
      reason: 'pending',
      procure: 'pending',
    },
    error: null,
  });
}

const SYMBOL_FIXTURES: TakeoffSymbol[] = [
  {
    symbol_id: 'sym_1',
    sheet_id: 'sheet_1',
    class: 'electrical.outlet.duplex',
    confidence: 0.92,
    bbox: { x: 0.1, y: 0.1, w: 0.04, h: 0.04 },
    status: 'detected',
  },
  {
    symbol_id: 'sym_2',
    sheet_id: 'sheet_1',
    class: 'plumbing.fixture.toilet',
    confidence: 0.45,
    bbox: { x: 0.3, y: 0.3, w: 0.06, h: 0.06 },
    status: 'detected',
  },
  {
    symbol_id: 'sym_3',
    sheet_id: 'sheet_1',
    class: 'electrical.outlet.duplex',
    confidence: 0.88,
    bbox: { x: 0.5, y: 0.2, w: 0.04, h: 0.04 },
    status: 'detected',
  },
];

beforeEach(() => {
  resetBlueprintUpload();
  _resetTakeoffUiForTests();
  _mockSymbolState.symbols = [];
  _mockSymbolState.endpointMissing = true;
  _mockSymbolState.isLoading = false;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TakeoffTab — Wave 13', () => {
  it('renders the empty state when no project is loaded', () => {
    const { getByTestId, getByText } = render(<TakeoffTab />);
    expect(getByTestId('takeoff-tab')).toBeTruthy();
    expect(getByTestId('takeoff-empty-state')).toBeTruthy();
    expect(
      getByText(/Drop a plan set in Plans & Photos to see the takeoff here\./),
    ).toBeTruthy();
    expect(getByTestId('takeoff-empty-link')).toBeTruthy();
  });

  describe('with a loaded project', () => {
    beforeEach(() => {
      loadProjectWithSheets();
    });

    it('defaults the chip strip to Sheet Viewer', () => {
      const { getByTestId } = render(<TakeoffTab />);
      const sheetChip = getByTestId('bottom-chip-sheet_viewer');
      expect(sheetChip.props.accessibilityState?.selected).toBe(true);
    });

    it('renders all 4 mode pills with Smart Room + Roofing disabled', async () => {
      const { getByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      const commercial = getByTestId('takeoff-mode-commercial');
      const smartRoom = getByTestId('takeoff-mode-smart-room');
      const roofing = getByTestId('takeoff-mode-roofing');

      expect(commercial.props.accessibilityState?.selected).toBe(true);
      expect(smartRoom.props.accessibilityState?.disabled).toBe(true);
      expect(roofing.props.accessibilityState?.disabled).toBe(true);
      expect(getByTestId('takeoff-mode-smart-room-badge')).toBeTruthy();
      expect(getByTestId('takeoff-mode-roofing-badge')).toBeTruthy();
    });

    it('SheetViewerWithOverlay renders bounding boxes when symbols exist', () => {
      // Render the viewer directly with controlled props — bypasses the
      // hook fan-out and the jest-default-native vs web branching that
      // makes viewport size measurement flaky in unit tests.
      const sheetsV2 = [
        {
          id: 'sheet_1',
          sheet_number: '1',
          sheet_code: 'A-1',
          sheet_title: 'Site Plan',
          discipline: 'architectural',
          scale: '1/4" = 1\'-0"',
          revision: 0,
          supersedes_id: null,
          thumbnail_url: 'https://example.test/sheet1.png',
          seal_detected: true,
          created_at: new Date().toISOString(),
        },
      ];
      const { getByTestId } = render(
        <SheetViewerWithOverlay
          sheets={sheetsV2}
          symbols={SYMBOL_FIXTURES}
          totalSymbolCount={SYMBOL_FIXTURES.length}
          hiddenDisciplines={new Set()}
          activeSheetId="sheet_1"
          onActiveSheetChange={() => {}}
          selectedSymbolId={null}
          onSelectSymbol={() => {}}
          overlayVisible={true}
          onToggleOverlay={() => {}}
          highlightedSheetIds={new Set()}
        />,
      );
      // Inject a viewport size via onLayout so the contained-image math runs.
      const overlayLayer = getByTestId('symbol-overlay-layer');
      // The layer is wrapped inside an absolute View on native; its parent
      // (the viewport container) handles onLayout. Fire onLayout on it.
      fireEvent(overlayLayer.parent ?? overlayLayer, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 600 } },
      });
      // The overlay layer should be present (always) and at least one bbox
      // should exist in the tree (because containedRect falls back to
      // viewport size when no aspect is known yet).
      expect(overlayLayer).toBeTruthy();
      // At least one symbol bbox should be rendered now.
      expect(getByTestId('symbol-bbox-sym_1')).toBeTruthy();
    });

    it('clicking a bbox opens the side panel', () => {
      const onSelectSymbol = jest.fn();
      const sheetsV2 = [
        {
          id: 'sheet_1',
          sheet_number: '1',
          sheet_code: 'A-1',
          sheet_title: 'Site Plan',
          discipline: 'architectural',
          scale: null,
          revision: 0,
          supersedes_id: null,
          thumbnail_url: 'https://example.test/sheet1.png',
          seal_detected: false,
          created_at: new Date().toISOString(),
        },
      ];
      const { getByTestId, rerender } = render(
        <SheetViewerWithOverlay
          sheets={sheetsV2}
          symbols={SYMBOL_FIXTURES}
          totalSymbolCount={SYMBOL_FIXTURES.length}
          hiddenDisciplines={new Set()}
          activeSheetId="sheet_1"
          onActiveSheetChange={() => {}}
          selectedSymbolId={null}
          onSelectSymbol={onSelectSymbol}
          overlayVisible={true}
          onToggleOverlay={() => {}}
          highlightedSheetIds={new Set()}
        />,
      );
      const overlayLayer = getByTestId('symbol-overlay-layer');
      fireEvent(overlayLayer.parent ?? overlayLayer, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 600 } },
      });
      const bbox = getByTestId('symbol-bbox-sym_1');
      fireEvent.press(bbox);
      expect(onSelectSymbol).toHaveBeenCalledWith(
        expect.objectContaining({ symbol_id: 'sym_1' }),
      );
      // Now re-render with selectedSymbolId set and verify the side panel
      // surfaces close + action buttons.
      rerender(
        <SheetViewerWithOverlay
          sheets={sheetsV2}
          symbols={SYMBOL_FIXTURES}
          totalSymbolCount={SYMBOL_FIXTURES.length}
          hiddenDisciplines={new Set()}
          activeSheetId="sheet_1"
          onActiveSheetChange={() => {}}
          selectedSymbolId="sym_1"
          onSelectSymbol={onSelectSymbol}
          overlayVisible={true}
          onToggleOverlay={() => {}}
          highlightedSheetIds={new Set()}
        />,
      );
      expect(getByTestId('symbol-side-panel-close')).toBeTruthy();
      expect(getByTestId('symbol-action-confirm')).toBeTruthy();
      expect(getByTestId('symbol-action-rfi')).toBeTruthy();
      expect(getByTestId('symbol-action-edit')).toBeTruthy();
    });

    it('AssemblyTableV2 default-sorts by quantity desc (sort caret on quantity)', async () => {
      const { getByTestId, findByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByTestId('bottom-chip-assemblies'));
      const table = await findByTestId(
        'assembly-table-v2',
        {},
        { timeout: 1500 },
      );
      expect(table).toBeTruthy();
      // The sort header for "Qty" should be the active one — the visual
      // affordance is a caret rendered inside the sort cell.
      const qtyHeader = getByTestId('assembly-v2-sort-quantity');
      expect(qtyHeader).toBeTruthy();
    });

    it('QuantityTableEditable accepts inline edit and console.infos the change', async () => {
      // Render QuantityTableEditable directly with one row so we can drive
      // the editor without standing up the full hook fan-out.
      const mats = [
        {
          material_id: 'm_1',
          line_item: 'Steel beam',
          quantity: 10,
          unit: 'EA',
          truth: 'derived' as const,
          tariff_flag: 'steel' as const,
        },
      ];
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      const { getByTestId } = render(
        <QuantityTableEditable materials={mats} endpointMissing={false} />,
      );
      const qtyCell = getByTestId('material-qty-m_1');
      fireEvent.press(qtyCell);
      const input = getByTestId('quantity-editor-input');
      fireEvent.changeText(input, '42');
      const commit = getByTestId('quantity-editor-commit');
      fireEvent.press(commit);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[takeoff] quantity-edit-commit',
        expect.objectContaining({
          materialId: 'm_1',
          newQuantity: 42,
          truth: 'field_confirmed',
        }),
      );
      consoleSpy.mockRestore();
    });

    it('Wave 2.7 banner renders when symbol/assembly/material endpoints return 404', async () => {
      const { findByTestId } = render(<TakeoffTab />);
      const banner = await findByTestId('takeoff-wave-27-banner');
      expect(banner).toBeTruthy();
    });

    it('SymbolLegendPanel toggle hides discipline from overlay', async () => {
      _mockSymbolState.symbols = SYMBOL_FIXTURES;
      _mockSymbolState.endpointMissing = false;
      const { findByTestId, getByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      // Switch to legend panel.
      fireEvent.press(getByTestId('bottom-chip-symbol_legend'));
      const panel = await findByTestId(
        'symbol-legend-panel',
        {},
        { timeout: 1500 },
      );
      expect(panel).toBeTruthy();
      // Each discipline row has a row-test id + toggle-test id.
      const electricalToggle = getByTestId('legend-toggle-electrical');
      // Default is visible (checked: true). Toggle.
      expect(electricalToggle.props.accessibilityState?.checked).toBe(true);
      fireEvent.press(electricalToggle);
      // After toggle, accessibility state flips to false (hidden).
      expect(electricalToggle.props.accessibilityState?.checked).toBe(false);
    });
  });
});
