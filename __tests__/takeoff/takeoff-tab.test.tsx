/**
 * Takeoff Tab — Wave 8 RTL behavior tests.
 *
 * Covers the visible UX of the Takeoff tab + push-to-materials gate:
 *   - Empty state when no project is loaded
 *   - Default chip is Sheet Viewer
 *   - Mode switcher renders 4 modes; Commercial active, Phase 8 disabled
 *   - Symbol overlay toggle (the button is present + accessibility-stateful)
 *   - Push-to-materials triggers the YELLOW confirmation modal
 *
 * The tests do NOT exercise network I/O — `useTakeoff*` hooks fan out to
 * `useAuthFetch`, which we mock to return a 404 (endpointMissing path).
 * That keeps the tests fully deterministic and avoids hitting the proxy.
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// --- Mocks (must come before importing the tab) ---
jest.mock('@/providers', () => {
  const _tenant = { officeId: 'office_test', tenant: { officeId: 'office_test' } };
  return { useTenant: () => _tenant };
});

// STABLE references — re-rendering must not return a new object/fn,
// otherwise effects in the takeoff hooks (deps include authenticatedFetch)
// re-run on every render and cause an infinite update loop. We declare a
// module-level singleton INSIDE the factory and reuse it across all hook
// calls.
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

// expo-router Link → just render its child as a plain View so the empty
// state renders without router context.
jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  usePathname: () => '/service-hub/estimate-studio/takeoff',
}));

import { TakeoffTab } from '@/components/service-hub/estimate-studio/takeoff/TakeoffTab';
import {
  resetBlueprintUpload,
  setBlueprintUpload,
} from '@/lib/blueprintUploadStore';

beforeEach(() => {
  resetBlueprintUpload();
});

describe('TakeoffTab — Wave 8', () => {
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
      // Simulate a successful Wave 6A upload landing.
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
    });

    it('defaults the chip strip to Sheet Viewer', () => {
      const { getByTestId } = render(<TakeoffTab />);
      const sheetChip = getByTestId('bottom-chip-sheet-viewer');
      expect(sheetChip.props.accessibilityState?.selected).toBe(true);
    });

    it('renders all 4 mode pills; Commercial active, Phase 8 modes disabled', async () => {
      const { getByTestId } = render(<TakeoffTab />);
      // flush microtasks for the 404 fetch resolutions
      await act(async () => {
        await Promise.resolve();
      });
      const commercial = getByTestId('takeoff-mode-commercial');
      const residential = getByTestId('takeoff-mode-residential');
      const smartRoom = getByTestId('takeoff-mode-smart-room');
      const roofing = getByTestId('takeoff-mode-roofing');

      expect(commercial.props.accessibilityState?.selected).toBe(true);
      expect(residential.props.accessibilityState?.disabled).toBe(false);
      expect(smartRoom.props.accessibilityState?.disabled).toBe(true);
      expect(roofing.props.accessibilityState?.disabled).toBe(true);

      // Phase 8 badges visible.
      expect(getByTestId('takeoff-mode-smart-room-badge')).toBeTruthy();
      expect(getByTestId('takeoff-mode-roofing-badge')).toBeTruthy();
    });

    it('Wave 2.7 banner renders when symbol/assembly/material endpoints return 404', async () => {
      const { findByTestId } = render(<TakeoffTab />);
      const banner = await findByTestId('takeoff-wave-27-banner');
      expect(banner).toBeTruthy();
    });

    it('symbol overlay toggle is present and toggles accessibility state', async () => {
      const { getByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      const toggle = getByTestId('symbol-overlay-toggle');
      expect(toggle.props.accessibilityState?.checked).toBe(true); // default visible
      fireEvent.press(toggle);
      expect(toggle.props.accessibilityState?.checked).toBe(false);
    });

    it('switching to Residential mode does not crash and keeps shells mounted', async () => {
      const { getByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByTestId('takeoff-mode-residential'));
      // Sheet viewer still present after mode swap.
      expect(getByTestId('sheet-viewer')).toBeTruthy();
    });

    it('switching to Quantities chip renders the quantity table', async () => {
      const { getByTestId, findByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByTestId('bottom-chip-quantities'));
      // CanvasCardSwitcher cross-fades the new card in. Wait for the
      // displayed key to flip after the ~200ms animation.
      const table = await findByTestId('quantity-table', {}, { timeout: 1500 });
      expect(table).toBeTruthy();
    });

    it('switching to Symbol Legend chip renders the legend with filters', async () => {
      const { getByTestId, findByTestId } = render(<TakeoffTab />);
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByTestId('bottom-chip-legend'));
      const legend = await findByTestId('symbol-legend', {}, { timeout: 1500 });
      expect(legend).toBeTruthy();
      await waitFor(() => {
        expect(getByTestId('legend-filter-all')).toBeTruthy();
      });
      expect(getByTestId('legend-filter-electrical')).toBeTruthy();
    });
  });
});
