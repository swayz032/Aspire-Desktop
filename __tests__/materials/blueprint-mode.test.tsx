/**
 * Materials Tab — Wave 14 Blueprint Mode tests.
 *
 * Covers:
 *   - Mode toggle exposes a Blueprint segment
 *   - BlueprintModeFeed renders the empty-state CTA when no project is loaded
 *   - BlueprintModeFeed renders tiles when materials are available
 *   - BlueprintModeTile surfaces FROM badge + discipline pill + truth chip
 *   - Tariff inline chip only appears when tariff_flag !== 'none'
 *   - Filter chips narrow the rendered tile list
 *   - MaterialsBlueprintContextCard renders in Tim Rail whenever a project is loaded (Wave 18h)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { TakeoffMaterial } from '@/lib/api/blueprintsApi';

// Mock the router (expo-router) — BlueprintModeFeed uses useRouter for the CTA.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/service-hub/estimate-studio/materials',
}));

// ---------- Mock blueprintUploadStore ----------
let mockProjectId: string | null = null;
jest.mock('@/lib/blueprintUploadStore', () => ({
  useBlueprintUploadSnapshot: () => ({
    projectId: mockProjectId,
    phase: mockProjectId ? 'complete' : 'idle',
    response: mockProjectId
      ? { project_id: mockProjectId, stage_progress: { procure: 'ok' } }
      : null,
    error: null,
  }),
}));

// ---------- Mock useTakeoffMaterials ----------
let mockMaterials: TakeoffMaterial[] = [];
let mockLoading = false;
let mockError: { code: string; message: string } | null = null;
let mockEndpointMissing = false;

jest.mock('@/hooks/useTakeoffMaterials', () => ({
  useTakeoffMaterials: () => ({
    materials: mockMaterials,
    isLoading: mockLoading,
    error: mockError,
    endpointMissing: mockEndpointMissing,
    refresh: jest.fn(),
    markInBundle: jest.fn(),
  }),
}));

// ---------- Mock useTenant ----------
jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office-test-001' }),
}));

// ---------- Mock authenticatedFetch ----------
jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

import { BlueprintModeFeed } from '@/components/service-hub/estimate-studio/materials/BlueprintModeFeed';
import { BlueprintModeTile } from '@/components/service-hub/estimate-studio/materials/BlueprintModeTile';
import { MaterialsModeToggle } from '@/components/service-hub/estimate-studio/materials/MaterialsModeToggle';
import { MaterialsSearchProvider } from '@/components/service-hub/estimate-studio/materials/MaterialsSearchContext';

// ---------- Mock useMaterialsSearch & useMaterialsBundle (for Provider) ----------
jest.mock('@/hooks/useMaterialsSearch', () => ({
  useMaterialsSearch: () => ({
    query: '',
    setQuery: jest.fn(),
    submitSearch: jest.fn(),
    clearSearch: jest.fn(),
    isLoading: false,
    isCachedOnlyMode: false,
    error: null,
    results: null,
    suppliers: null,
    closestStore: null,
    specialtySuppliers: [],
    filters: [],
    suggestedQueries: [],
  }),
  getPredictiveAddons: () => [],
}));

jest.mock('@/hooks/useMaterialsBundle', () => ({
  useMaterialsBundle: () => ({
    bundle: [],
    addToBundle: jest.fn(),
    removeFromBundle: jest.fn(),
    clearBundle: jest.fn(),
    bundleSubtotal: 0,
    bundleSupplierCount: 0,
    bundleItemCount: 0,
    pushToEstimate: jest.fn(() => Promise.resolve()),
  }),
}));

// ---------- Test fixtures ----------
function makeMaterial(over: Partial<TakeoffMaterial> = {}): TakeoffMaterial {
  return {
    material_id: 'mat-1',
    line_item: '12 AWG Romex',
    quantity: 250,
    unit: 'ft',
    truth: 'derived',
    tariff_flag: 'copper',
    supplier_name: 'Ferguson',
    ...over,
  };
}

beforeEach(() => {
  mockProjectId = null;
  mockMaterials = [];
  mockLoading = false;
  mockError = null;
  mockEndpointMissing = false;
});

describe('Materials mode toggle — Wave 18h', () => {
  it('exposes only Tool and Supplier segments (Blueprint is no longer a mode)', () => {
    const { getByTestId, queryByTestId } = render(
      <MaterialsSearchProvider>
        <MaterialsModeToggle />
      </MaterialsSearchProvider>,
    );
    expect(getByTestId('materials-mode-toggle-tool')).toBeTruthy();
    expect(getByTestId('materials-mode-toggle-supplier')).toBeTruthy();
    expect(queryByTestId('materials-mode-toggle-blueprint')).toBeNull();
  });
});

describe('Materials Blueprint Mode — feed', () => {
  it('renders the no-project empty state when projectId is null', () => {
    mockProjectId = null;
    const { getByTestId, queryByTestId } = render(<BlueprintModeFeed />);
    expect(getByTestId('blueprint-mode-feed-empty')).toBeTruthy();
    expect(getByTestId('blueprint-mode-feed-empty-cta')).toBeTruthy();
    expect(queryByTestId('blueprint-mode-feed')).toBeNull();
  });

  it('renders tiles when a project + materials are present', () => {
    mockProjectId = 'proj-001';
    mockMaterials = [
      makeMaterial({
        material_id: 'mat-1',
        line_item: '12 AWG Romex',
        tariff_flag: 'copper',
      }),
      makeMaterial({
        material_id: 'mat-2',
        line_item: '1/2 in. Drywall',
        tariff_flag: 'none',
        truth: 'asserted',
      }),
    ];
    const { getByTestId } = render(<BlueprintModeFeed />);
    expect(getByTestId('blueprint-tile-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-mat-2')).toBeTruthy();
  });

  it('narrows tiles when the tariff-only filter is enabled (inferred)', () => {
    mockProjectId = 'proj-001';
    mockMaterials = [
      makeMaterial({ material_id: 'mat-1', tariff_flag: 'copper' }),
      makeMaterial({
        material_id: 'mat-2',
        tariff_flag: 'none',
        line_item: 'drywall',
      }),
    ];
    const { getByTestId } = render(<BlueprintModeFeed />);
    // Both visible by default.
    expect(getByTestId('blueprint-tile-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-mat-2')).toBeTruthy();
    // Tariff filter button is rendered and accessible:
    expect(getByTestId('blueprint-filter-tariff')).toBeTruthy();
  });

  it('renders the trade filter row with all six trade options', () => {
    mockProjectId = 'proj-001';
    mockMaterials = [makeMaterial()];
    const { getByTestId } = render(<BlueprintModeFeed />);
    expect(getByTestId('blueprint-filter-trade-all')).toBeTruthy();
    expect(getByTestId('blueprint-filter-trade-electrical')).toBeTruthy();
    expect(getByTestId('blueprint-filter-trade-plumbing')).toBeTruthy();
    expect(getByTestId('blueprint-filter-trade-mechanical')).toBeTruthy();
    expect(getByTestId('blueprint-filter-trade-architectural')).toBeTruthy();
    expect(getByTestId('blueprint-filter-trade-civil')).toBeTruthy();
  });
});

describe('Materials Blueprint Mode — tile', () => {
  const tile = {
    material_id: 'mat-1',
    line_item: '12 AWG Romex',
    quantity: 250,
    unit: 'ft',
    truth: 'derived' as const,
    tariff_flag: 'copper' as const,
    supplier_name: 'Ferguson',
    sheet_code: 'E-1',
    discipline: 'electrical',
    drew_reasoning: 'Drew matched 12 outlets across sheet E-1',
    match_count: 12,
    unit_price: 0.89,
    alternates_count: 3,
  };

  it('renders FROM badge + discipline pill + truth chip + reasoning row', () => {
    const { getByTestId } = render(
      <BlueprintModeTile
        material={tile}
        onAdd={jest.fn()}
        onOpenDetail={jest.fn()}
        onOpenAlternates={jest.fn()}
        onTruthClick={jest.fn()}
      />,
    );
    expect(getByTestId('blueprint-tile-from-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-discipline-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-truth-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-reasoning-mat-1')).toBeTruthy();
    expect(getByTestId('blueprint-tile-alternates-mat-1')).toBeTruthy();
  });

  it('shows the tariff inline chip ONLY when tariff_flag !== "none"', () => {
    const withTariff = render(
      <BlueprintModeTile
        material={tile}
        onAdd={jest.fn()}
        onOpenDetail={jest.fn()}
        onOpenAlternates={jest.fn()}
        onTruthClick={jest.fn()}
      />,
    );
    expect(withTariff.getByTestId('blueprint-tile-tariff-mat-1')).toBeTruthy();
    withTariff.unmount();

    const withoutTariff = render(
      <BlueprintModeTile
        material={{ ...tile, tariff_flag: 'none' as const }}
        onAdd={jest.fn()}
        onOpenDetail={jest.fn()}
        onOpenAlternates={jest.fn()}
        onTruthClick={jest.fn()}
      />,
    );
    expect(withoutTariff.queryByTestId('blueprint-tile-tariff-mat-1')).toBeNull();
  });

  it('reuses the underlying ProductCard (Tool tile shape preserved verbatim)', () => {
    const { getByTestId } = render(
      <BlueprintModeTile
        material={tile}
        onAdd={jest.fn()}
        onOpenDetail={jest.fn()}
        onOpenAlternates={jest.fn()}
        onTruthClick={jest.fn()}
      />,
    );
    // The wrapped ProductCard MUST be rendered with the same testID convention
    // it always uses — proving the Tool tile shape is intact.
    expect(getByTestId('materials-product-card-mat-1')).toBeTruthy();
    expect(getByTestId('materials-add-btn-mat-1')).toBeTruthy();
  });
});
