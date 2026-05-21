/**
 * Estimate Tab — Wave 15 unit tests.
 *
 * Covers observable behavior:
 *   - Empty state when no projectId
 *   - Default chip = Bid Summary; canvas renders the bid
 *   - Line items table edit fires a console.info stub
 *   - Markup sliders recalc the live total
 *   - Bid Health = green when all line items are derived-or-better with no blockers
 *   - Tariff toggle changes the bid total
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
  BlueprintStory,
} from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/service-hub/estimate-studio/estimate',
}));

jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office-test-001' }),
}));

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    getStory: jest.fn(),
    getAssemblies: jest.fn(),
    getMaterials: jest.fn(),
    getMissingInputs: jest.fn(),
  };
});

const mockUploadSnap = {
  phase: 'success' as const,
  filename: 'plan-set.pdf',
  uploadedAt: Date.now(),
  response: {
    success: true,
    project_id: 'proj-test-001',
    filename: 'plan-set.pdf',
    size_bytes: 1024,
    correlation_id: 'corr-1',
    ingest: { status: 'ok', stage: 'ingest', project_id: 'proj-test-001' },
    classify: null,
    stage_progress: {
      ingest: 'ok',
      classify: 'ok',
      see: 'ok',
      reason: 'ok',
      procure: 'ok',
    },
  } as any,
  stageProgress: {
    ingest: 'ok',
    classify: 'ok',
    see: 'ok',
    reason: 'ok',
    procure: 'ok',
  } as any,
  error: null,
  uploadRatio: 0,
  startedAtMs: null,
  projectId: 'proj-test-001',
  file: null,
};

const mockEmptyUploadSnap = {
  phase: 'idle' as const,
  filename: null,
  uploadedAt: null,
  response: null,
  stageProgress: {
    ingest: 'pending',
    classify: 'pending',
    see: 'pending',
    reason: 'pending',
    procure: 'pending',
  } as any,
  error: null,
  uploadRatio: 0,
  startedAtMs: null,
  projectId: null,
  file: null,
};

let mockUploadSnapState: typeof mockEmptyUploadSnap | typeof mockUploadSnap =
  mockEmptyUploadSnap;
jest.mock('@/lib/blueprintUploadStore', () => ({
  useBlueprintUploadSnapshot: () => mockUploadSnapState,
  getBlueprintUpload: () => mockUploadSnapState,
  setBlueprintUpload: jest.fn(),
  resetBlueprintUpload: jest.fn(),
}));

jest.mock('@/hooks/useProjectAddress', () => ({
  useProjectAddress: () => ({
    address: '123 Mangonia Park, FL',
    setAddress: jest.fn(),
  }),
}));

// Story fixture — used by all populated scenarios.
const baseStory: BlueprintStory = {
  project_id: 'proj-test-001',
  mean_confidence: 0.88,
  truth_distribution: {
    observed: 4,
    derived: 2,
    assumed: 0,
    missing: 0,
    field_confirmed: 0,
    vendor_confirmed: 0,
    permit_confirmed: 0,
  },
  phases: [],
  updated_at: new Date().toISOString(),
  status: 'done',
};

// Build assemblies + materials with explicit unit prices so totals are
// deterministic across all assertions.
const baseAssemblies: BlueprintAssembly[] = [
  {
    assembly_id: 'asm_1',
    assembly_type: 'electrical_outlet',
    label: 'Electrical outlet rough-in — duplex 15A',
    quantity: 20,
    unit: 'ea',
    truth: 'observed',
    in_base_scope: true,
    // Synthetic unit_price_usd extension recognized by bidMath.
    unit_price_usd: 50,
  } as BlueprintAssembly & { unit_price_usd: number },
  {
    assembly_id: 'asm_2',
    assembly_type: 'drywall_partition',
    label: 'Drywall partition Type X',
    quantity: 320,
    unit: 'sf',
    truth: 'derived',
    in_base_scope: true,
    unit_price_usd: 4,
  } as BlueprintAssembly & { unit_price_usd: number },
];

const baseMaterials: BlueprintMaterial[] = [
  {
    material_id: 'mat_1',
    label: 'Type X drywall 5/8" — 4\'x8\' sheet',
    quantity: 50,
    unit: 'sheet',
    truth: 'observed',
    tariff_flagged: false,
    unit_price_usd: 20,
  } as BlueprintMaterial & { unit_price_usd: number },
  {
    material_id: 'mat_2',
    label: 'Steel stud 3-5/8" x 10ft',
    quantity: 100,
    unit: 'ea',
    truth: 'derived',
    tariff_flagged: true,
    tariff_note: 'Section 232 steel',
    tariff_impact_usd: 200,
    unit_price_usd: 12,
  } as BlueprintMaterial & { unit_price_usd: number },
];

let mockStoryState = makeStoryState({});

function makeStoryState(overrides: {
  assemblies?: BlueprintAssembly[];
  materials?: BlueprintMaterial[];
}): {
  story: BlueprintStory | null;
  assemblies: BlueprintAssembly[];
  materials: BlueprintMaterial[];
  missingInputs: any[];
  isLoading: boolean;
  isPolling: boolean;
  backendDeployed: boolean;
  error: null;
  refetch: () => Promise<void>;
} {
  return {
    story: baseStory,
    assemblies: overrides.assemblies ?? baseAssemblies,
    materials: overrides.materials ?? baseMaterials,
    missingInputs: [],
    isLoading: false,
    isPolling: false,
    backendDeployed: true,
    error: null,
    refetch: jest.fn(async () => {}),
  };
}

jest.mock('@/hooks/useBlueprintStory', () => ({
  useBlueprintStory: () => mockStoryState,
}));

// ---------------------------------------------------------------------------
// Imports under test — AFTER jest.mock declarations
// ---------------------------------------------------------------------------
import { EstimateTab } from '@/components/service-hub/estimate-studio/estimate/EstimateTab';
import { EstimateContextPayload } from '@/components/service-hub/estimate-studio/tim-rail/EstimateContextPayload';
import {
  __resetEstimateUiForTests,
  estimateUiActions,
} from '@/lib/estimateUiStore';
import {
  buildLineItems,
  computeBidHealth,
  computeMoneyStack,
} from '@/lib/estimate/bidMath';

beforeEach(() => {
  mockPush.mockClear();
  __resetEstimateUiForTests();
  mockUploadSnapState = mockUploadSnap;
  mockStoryState = makeStoryState({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EstimateTab — Wave 15 shell', () => {
  it('renders Bid Summary canvas by default', () => {
    const { getByTestId } = render(<EstimateTab />);
    expect(getByTestId('estimate-tab')).toBeTruthy();
    expect(getByTestId('bid-summary-canvas')).toBeTruthy();
    const summaryChip = getByTestId('bottom-chip-bid_summary');
    expect(summaryChip.props.accessibilityState?.selected).toBe(true);
  });

  it('renders empty state with CTA back to Plans & Photos when no projectId', () => {
    mockUploadSnapState = mockEmptyUploadSnap;
    const { getByTestId, getByText } = render(<EstimateTab />);
    expect(getByTestId('estimate-tab-empty')).toBeTruthy();
    expect(getByText(/Drop a plan set in Plans & Photos/)).toBeTruthy();
    fireEvent.press(getByTestId('estimate-tab-empty-cta'));
    expect(mockPush).toHaveBeenCalledWith(
      '/service-hub/estimate-studio/plans-photos',
    );
  });

  it('line items table inline edits emit console.info stubs', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { getByTestId } = render(<EstimateTab />);

    // Switch to Line Items chip + wait for cross-fade.
    fireEvent.press(getByTestId('bottom-chip-line_items'));
    await waitFor(() => expect(getByTestId('line-items-table')).toBeTruthy());

    // Edit the qty cell for asm_1 — change + blur to commit.
    const qtyInput = getByTestId('line-row-asm_1-qty');
    fireEvent.changeText(qtyInput, '25');
    fireEvent(qtyInput, 'blur');

    expect(infoSpy).toHaveBeenCalledWith(
      '[estimate] line qty edit (stub)',
      expect.objectContaining({ id: 'asm_1', qty: 25 }),
    );

    infoSpy.mockRestore();
  });
});

describe('bidMath — money + health invariants', () => {
  it('computes a deterministic money stack from baseline fixtures', () => {
    const built = buildLineItems({
      materials: baseMaterials,
      assemblies: baseAssemblies,
      baseScopeOnly: true,
    });
    // Subtotals:
    //   asm_1:  20 * 50  = 1000  (labor)
    //   asm_2: 320 *  4  = 1280  (labor) → laborSubtotal = 2280
    //   mat_1:  50 * 20  = 1000  (materials)
    //   mat_2: 100 * 12  = 1200  (materials) → materialsSubtotal = 2200
    const money = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 18, materialsPct: 22, contingencyPct: 5, tariffAbsorb: false },
    });
    expect(money.laborSubtotal).toBe(2280);
    expect(money.materialsSubtotal).toBe(2200);
    expect(money.subtotal).toBe(4480);
    // tariff pass-through = mat_2.tariff_impact_usd = 200
    expect(money.tariffPassThrough).toBe(200);
    // total never NaN, never negative
    expect(Number.isFinite(money.total)).toBe(true);
    expect(money.total).toBeGreaterThan(0);
  });

  it('markup changes recalc the total (slider scenario)', () => {
    const built = buildLineItems({
      materials: baseMaterials,
      assemblies: baseAssemblies,
      baseScopeOnly: true,
    });
    const low = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 10, materialsPct: 10, contingencyPct: 0, tariffAbsorb: true },
    });
    const high = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 40, materialsPct: 40, contingencyPct: 10, tariffAbsorb: true },
    });
    expect(high.total).toBeGreaterThan(low.total);
  });

  it('tariff absorb vs pass-through changes the total', () => {
    const built = buildLineItems({
      materials: baseMaterials,
      assemblies: baseAssemblies,
      baseScopeOnly: true,
    });
    const passThrough = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 18, materialsPct: 22, contingencyPct: 5, tariffAbsorb: false },
    });
    const absorbed = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 18, materialsPct: 22, contingencyPct: 5, tariffAbsorb: true },
    });
    expect(passThrough.total).toBeGreaterThan(absorbed.total);
    expect(absorbed.tariffPassThrough).toBe(0);
  });

  it('bid health is green when all lines are observed/derived with no blockers', () => {
    const built = buildLineItems({
      materials: baseMaterials,
      assemblies: baseAssemblies,
      baseScopeOnly: true,
    });
    const health = computeBidHealth(built.all);
    expect(health.level).toBe('green');
    expect(health.assumedCount).toBe(0);
    expect(health.missingCount).toBe(0);
    expect(health.rfqNeededCount).toBe(0);
  });

  it('bid health is red when any line is missing OR has no price', () => {
    const built = buildLineItems({
      materials: [
        {
          ...baseMaterials[0],
          truth: 'missing',
        },
      ],
      assemblies: [],
      baseScopeOnly: true,
    });
    const health = computeBidHealth(built.all);
    expect(health.level).toBe('red');
  });

  it('never returns NaN or negative totals on malformed inputs', () => {
    const built = buildLineItems({
      materials: [
        {
          material_id: 'bad',
          label: 'broken',
          quantity: Number.NaN as unknown as number,
          unit: 'ea',
          truth: 'observed',
          tariff_flagged: false,
        },
      ],
      assemblies: [],
      baseScopeOnly: true,
    });
    const money = computeMoneyStack({
      lines: built.all,
      markup: { laborPct: 18, materialsPct: 22, contingencyPct: 5, tariffAbsorb: false },
    });
    expect(Number.isFinite(money.total)).toBe(true);
    expect(money.total).toBeGreaterThanOrEqual(0);
  });
});

describe('EstimateTab — markup slider interaction', () => {
  it('moving the labor markup slider updates the live total in MarkupMarginsCanvas', async () => {
    const { getByTestId, getAllByText } = render(<EstimateTab />);

    fireEvent.press(getByTestId('bottom-chip-markup_margins'));
    await waitFor(() => expect(getByTestId('markup-margins-canvas')).toBeTruthy());

    const initialTotal = getByTestId('markup-live-total').props.children;

    // Drive the store directly (slider is a real <input type="range"> on web
    // and a stepper on native — both write through estimateUiActions).
    await act(async () => {
      estimateUiActions().setLaborPct(50);
    });

    await waitFor(() => {
      const next = getByTestId('markup-live-total').props.children;
      expect(next).not.toEqual(initialTotal);
    });

    // Sanity — the value is some non-empty USD-shaped string.
    expect(getAllByText(/\$/).length).toBeGreaterThan(0);
  });
});

describe('EstimateContextPayload bid-health intelligence', () => {
  // Smoke-test the payload via Context import. Full integration with
  // TimRailContextTab is covered in the existing scope-tab test pattern.
  it('exposes Health "green" + Confidence number for the baseline fixture', () => {
    const { getByTestId } = render(<EstimateContextPayload />);
    expect(getByTestId('estimate-context-payload')).toBeTruthy();
    expect(getByTestId('estimate-context-health')).toBeTruthy();
    expect(getByTestId('estimate-context-confidence')).toBeTruthy();
  });
});
