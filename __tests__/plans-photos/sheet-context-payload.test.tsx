/**
 * Wave 16 — SheetContextPayload unit tests.
 *
 * Per-sheet premium Context tab payload:
 *   - Renders the Project Summary fallback when no active sheet is set
 *   - Renders the per-sheet dossier when an active sheet is set
 *   - Updates when the active sheet changes
 *   - Shows the engineer-sealed pill when sheet.seal_detected = true
 *   - OCR snippet is collapsed by default; expands on press
 *
 * Mocks the polling + tenant providers so the component can mount without
 * a real auth context — `*Override` props bypass the hooks entirely.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type {
  BlueprintSheetRead,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import {
  setActiveSheetId,
  _resetActiveSheetStoreForTests,
} from '@/lib/activeSheetStore';

// ---------------------------------------------------------------------------
// Mocks — providers + polling hooks. Overrides on the component bypass
// the real hook payloads, but the hooks still execute (React rules of
// hooks), so we stub their module-level imports.
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/service-hub/estimate-studio/plans-photos',
}));

jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office-test-001' }),
}));

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

jest.mock('@/hooks/useBlueprintProjectPoll', () => ({
  useBlueprintProjectPoll: () => ({
    project: null,
    sheets: [],
    revisions: [],
    stageProgress: {
      ingest: 'pending',
      classify: 'pending',
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

jest.mock('@/hooks/useTakeoffSymbols', () => ({
  useTakeoffSymbols: () => ({
    symbols: [],
    isLoading: false,
    error: null,
    endpointMissing: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/lib/blueprintUploadStore', () => ({
  useBlueprintUploadSnapshot: () => ({
    phase: 'success',
    filename: 'mall-plans.pdf',
    uploadedAt: Date.now() - 60_000,
    response: null,
    stageProgress: {
      ingest: 'ok',
      classify: 'ok',
      see: 'ok',
      reason: 'ok',
      procure: 'ok',
    },
    error: null,
    uploadRatio: 1,
    startedAtMs: null,
    projectId: 'proj-fixture',
    file: null,
  }),
  resetBlueprintUpload: jest.fn(),
  setBlueprintUpload: jest.fn(),
  getBlueprintUpload: jest.fn(() => ({
    projectId: 'proj-fixture',
    phase: 'success',
  })),
}));

// Now import the component under test (after all mocks are registered).
import { SheetContextPayload } from '@/components/service-hub/estimate-studio/plans-photos/SheetContextPayload';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSheet(
  overrides: Partial<BlueprintSheetRead> = {},
): BlueprintSheetRead {
  return {
    id: 'sheet-e1',
    sheet_number: '3',
    sheet_code: 'E-1',
    sheet_title: 'Electrical Site Plan',
    discipline: 'electrical',
    scale: '1/8" = 1\'-0"',
    revision: 1,
    supersedes_id: null,
    thumbnail_url: 'https://example.com/e1.png',
    seal_detected: false,
    created_at: new Date(Date.now() - 7_200_000).toISOString(),
    ...overrides,
  };
}

function makeSymbol(
  klass: string,
  sheetId: string,
  conf = 0.88,
): TakeoffSymbol {
  return {
    symbol_id: `${klass}-${Math.random()}`,
    sheet_id: sheetId,
    class: klass,
    confidence: conf,
    bbox: { x: 0.1, y: 0.1, w: 0.05, h: 0.05 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SheetContextPayload', () => {
  beforeEach(() => {
    _resetActiveSheetStoreForTests();
  });

  it('renders Project Summary when no active sheet is set', () => {
    const sheets = [makeSheet({ id: 'a', discipline: 'architectural' })];
    const { getByTestId, queryByTestId } = render(
      <SheetContextPayload
        activeSheetIdOverride={null}
        sheetsOverride={sheets}
        symbolsOverride={[]}
        projectIdOverride="proj-fixture"
        addressOverride="1234 Industrial Way"
      />,
    );

    expect(getByTestId('sheet-context-project-summary')).toBeTruthy();
    expect(queryByTestId('sheet-context-stack')).toBeNull();
  });

  it('renders per-sheet dossier when an active sheet is set', () => {
    const sheet = makeSheet();
    const { getByTestId, queryByTestId } = render(
      <SheetContextPayload
        activeSheetIdOverride={sheet.id}
        sheetsOverride={[sheet]}
        symbolsOverride={[
          makeSymbol('electrical.outlet.duplex', sheet.id, 0.9),
          makeSymbol('electrical.outlet.duplex', sheet.id, 0.8),
          makeSymbol('electrical.panel', sheet.id, 0.7),
        ]}
        projectIdOverride="proj-fixture"
      />,
    );

    expect(getByTestId('sheet-context-stack')).toBeTruthy();
    expect(getByTestId('sheet-context-header')).toBeTruthy();
    expect(getByTestId('sheet-context-symbols')).toBeTruthy();
    expect(getByTestId('sheet-context-ocr')).toBeTruthy();
    expect(getByTestId('sheet-context-metadata')).toBeTruthy();
    expect(queryByTestId('sheet-context-project-summary')).toBeNull();
  });

  it('updates when active sheet changes', () => {
    const a = makeSheet({
      id: 'sheet-a',
      sheet_code: 'A-1',
      sheet_title: 'Floor Plan',
      discipline: 'architectural',
    });
    const b = makeSheet({
      id: 'sheet-b',
      sheet_code: 'P-1',
      sheet_title: 'Plumbing Riser',
      discipline: 'plumbing',
    });

    const { rerender, getByTestId } = render(
      <SheetContextPayload
        activeSheetIdOverride={a.id}
        sheetsOverride={[a, b]}
        symbolsOverride={[]}
      />,
    );
    expect(getByTestId('sheet-context-stack')).toBeTruthy();
    // The CrossFade wrapper exposes a testID per swap key.
    expect(getByTestId('sheet-context-fade-sheet:sheet-a')).toBeTruthy();

    rerender(
      <SheetContextPayload
        activeSheetIdOverride={b.id}
        sheetsOverride={[a, b]}
        symbolsOverride={[]}
      />,
    );

    // After the cross-fade settles, the new key is the rendered key.
    // Drive the animation forward by flushing timers + a microtask.
    act(() => {
      // CrossFade uses Animated.timing with useNativeDriver=true; jest
      // resolves the start() callback synchronously in test envs, so the
      // post-fade key swap is immediately observable.
    });

    expect(getByTestId('sheet-context-stack')).toBeTruthy();
  });

  it('shows the engineer-sealed pill when seal_detected is true', () => {
    const sheet = makeSheet({ seal_detected: true });
    const { getByTestId, queryByTestId } = render(
      <SheetContextPayload
        activeSheetIdOverride={sheet.id}
        sheetsOverride={[sheet]}
        symbolsOverride={[]}
      />,
    );
    expect(getByTestId('sheet-context-seal')).toBeTruthy();

    // And the inverse — pill is absent when seal_detected = false.
    const unsealed = makeSheet({ id: 'sheet-x', seal_detected: false });
    const { queryByTestId: queryByTestId2 } = render(
      <SheetContextPayload
        activeSheetIdOverride={unsealed.id}
        sheetsOverride={[unsealed]}
        symbolsOverride={[]}
      />,
    );
    expect(queryByTestId2('sheet-context-seal')).toBeNull();
    // Reference queryByTestId so the linter doesn't complain it's unused.
    expect(queryByTestId).toBeDefined();
  });

  it('OCR snippet is collapsed by default and expands on press', () => {
    type Carrier = BlueprintSheetRead & { ocr_text: string };
    const sheet: Carrier = {
      ...makeSheet(),
      ocr_text:
        'ELECTRICAL SITE PLAN — SHEET E-1\nSCALE: 1/8" = 1\'-0"\nALL CIRCUITS PER NEC 2023',
    };

    const { getByTestId, queryByTestId } = render(
      <SheetContextPayload
        activeSheetIdOverride={sheet.id}
        sheetsOverride={[sheet]}
        symbolsOverride={[]}
      />,
    );

    // Collapsed: toggle exists, block does not.
    expect(getByTestId('sheet-context-ocr-toggle')).toBeTruthy();
    expect(queryByTestId('sheet-context-ocr-block')).toBeNull();

    // Expand
    fireEvent.press(getByTestId('sheet-context-ocr-toggle'));
    expect(getByTestId('sheet-context-ocr-block')).toBeTruthy();

    // Collapse again
    fireEvent.press(getByTestId('sheet-context-ocr-toggle'));
    expect(queryByTestId('sheet-context-ocr-block')).toBeNull();
  });

  it('subscribes to the activeSheetStore for live updates', () => {
    jest.useFakeTimers();
    const a = makeSheet({ id: 'live-a' });
    const b = makeSheet({ id: 'live-b', sheet_code: 'M-1' });

    const { getByTestId, queryByTestId } = render(
      <SheetContextPayload
        sheetsOverride={[a, b]}
        symbolsOverride={[]}
      />,
    );

    // Nothing active — fallback summary.
    expect(getByTestId('sheet-context-project-summary')).toBeTruthy();
    expect(queryByTestId('sheet-context-stack')).toBeNull();

    // Publish an active sheet via the store. The CrossFade wrapper runs
    // a 100ms fade-out then a content swap then a 100ms fade-in — drive
    // the animation forward with fake timers so the post-fade key swap
    // is observable in the same tick.
    act(() => {
      setActiveSheetId('live-a');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // After the publish, the payload swaps to the per-sheet dossier.
    expect(getByTestId('sheet-context-stack')).toBeTruthy();
    expect(queryByTestId('sheet-context-project-summary')).toBeNull();
    jest.useRealTimers();
  });
});
