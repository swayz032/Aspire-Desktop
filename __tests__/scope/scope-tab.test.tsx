/**
 * Scope Tab — Wave 7 unit tests.
 *
 * Covers observable UX behavior:
 *   - Empty state renders the CTA back to Plans & Photos
 *   - Default chip selection is Story
 *   - Switching chips swaps the active canvas card
 *   - MissingInputCard Confirm flow calls resolveMissingInput and shows the
 *     resolved state on success
 *   - TruthBadge variants render correctly per truth class
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
  BlueprintMissingInput,
  BlueprintStory,
} from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Mocks — TenantProvider, authenticatedFetch, router, blueprint API, upload
// store. We mount ScopeTab with handcrafted state per test.
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/service-hub/estimate-studio/scope',
}));

jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office-test-001' }),
}));

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({
    authenticatedFetch: jest.fn(),
  }),
}));

const mockResolveMissingInput = jest.fn();
jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    getStory: jest.fn(),
    getAssemblies: jest.fn(),
    getMaterials: jest.fn(),
    getMissingInputs: jest.fn(),
    resolveMissingInput: (...args: unknown[]) => mockResolveMissingInput(...args),
  };
});

// Mock the upload store to return a project_id.
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
      classify: 'pending',
      see: 'pending',
      reason: 'pending',
      procure: 'pending',
    },
  } as any,
  stageProgress: {
    ingest: 'ok',
    classify: 'pending',
    see: 'pending',
    reason: 'pending',
    procure: 'pending',
  } as any,
  error: null,
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
};

let mockUploadSnapState = mockEmptyUploadSnap as
  | typeof mockEmptyUploadSnap
  | typeof mockUploadSnap;
jest.mock('@/lib/blueprintUploadStore', () => ({
  useBlueprintUploadSnapshot: () => mockUploadSnapState,
  getBlueprintUpload: () => mockUploadSnapState,
  setBlueprintUpload: jest.fn(),
  resetBlueprintUpload: jest.fn(),
}));

// Mock useBlueprintStory so we can stage scenarios.
const baseStory: BlueprintStory = {
  project_id: 'proj-test-001',
  mean_confidence: 0.82,
  truth_distribution: {
    observed: 12,
    derived: 5,
    assumed: 2,
    missing: 1,
    field_confirmed: 0,
    vendor_confirmed: 0,
    permit_confirmed: 0,
  },
  phases: [
    {
      key: 'phase_1',
      title: 'Demo & MEP rough-in',
      body_md: 'Demo existing partitions and run MEP rough.',
      facts: [
        {
          key: 'fact_1',
          label: 'Existing 9 ft ceiling',
          truth: 'observed',
          confidence: 1,
        },
        {
          key: 'fact_2',
          label: 'Likely 24" o.c. studs',
          truth: 'assumed',
          confidence: 0.62,
          missing_input_id: 'mi_1',
        },
      ],
    },
  ],
  updated_at: new Date().toISOString(),
  status: 'done',
};

const baseAssemblies: BlueprintAssembly[] = [
  {
    assembly_id: 'asm_1',
    assembly_type: 'drywall_partition',
    label: 'Drywall partition — Type X 5/8"',
    quantity: 320,
    unit: 'sf',
    truth: 'observed',
    in_base_scope: true,
  },
  {
    assembly_id: 'asm_2',
    assembly_type: 'demountable_partition',
    label: 'Demountable partition alt',
    quantity: 320,
    unit: 'sf',
    truth: 'derived',
    confidence: 0.74,
    in_base_scope: false,
    alternate_note: 'Bid as drywall OR demountable — 23% cost delta.',
  },
];

const baseMaterials: BlueprintMaterial[] = [
  {
    material_id: 'mat_1',
    label: 'Type X drywall 5/8" — 4\'x8\' sheet',
    quantity: 50,
    unit: 'sheet',
    truth: 'observed',
    tariff_flagged: false,
  },
  {
    material_id: 'mat_2',
    label: 'Steel stud 3-5/8" x 10ft',
    quantity: 120,
    unit: 'ea',
    truth: 'observed',
    tariff_flagged: true,
    tariff_note: 'Section 232 steel',
    tariff_impact_usd: 145,
  },
];

const baseMissing: BlueprintMissingInput[] = [
  {
    input_id: 'mi_1',
    description: 'Ceiling height not specified on sheet A-2',
    suggested_resolution: 'Confirm with owner — typical 9 ft for commercial-lite.',
    status: 'open',
  },
];

let mockStoryState: ReturnType<typeof makeStoryState> = makeStoryState({});

function makeStoryState(overrides: {
  story?: BlueprintStory | null;
  assemblies?: BlueprintAssembly[];
  materials?: BlueprintMaterial[];
  missingInputs?: BlueprintMissingInput[];
  backendDeployed?: boolean;
}): {
  story: BlueprintStory | null;
  assemblies: BlueprintAssembly[];
  materials: BlueprintMaterial[];
  missingInputs: BlueprintMissingInput[];
  isLoading: boolean;
  isPolling: boolean;
  backendDeployed: boolean;
  error: null;
  refetch: () => Promise<void>;
} {
  return {
    story: overrides.story === undefined ? baseStory : overrides.story,
    assemblies: overrides.assemblies ?? baseAssemblies,
    materials: overrides.materials ?? baseMaterials,
    missingInputs: overrides.missingInputs ?? baseMissing,
    isLoading: false,
    isPolling: false,
    backendDeployed: overrides.backendDeployed ?? true,
    error: null,
    refetch: jest.fn(async () => {}),
  };
}

jest.mock('@/hooks/useBlueprintStory', () => ({
  useBlueprintStory: () => mockStoryState,
}));

// useBlueprintActions: uses React state internally so a confirm flips the
// per-input phase + triggers a re-render exactly like the real hook would.
jest.mock('@/hooks/useBlueprintActions', () => {
  const React = jest.requireActual('react');
  return {
    useBlueprintActions: () => {
      const [phases, setPhases] = React.useState<Record<string, string>>({});
      return {
        phaseFor: (key: string) => phases[key] ?? 'idle',
        errorFor: () => null,
        confirmMissingInput: async (
          projectId: string,
          inputId: string,
          value: string,
        ) => {
          mockResolveMissingInput(projectId, inputId, value);
          setPhases((prev: Record<string, string>) => ({
            ...prev,
            [inputId]: 'success',
          }));
          return {
            input_id: inputId,
            description: 'mock',
            status: 'resolved',
            resolved_value: value,
            resolved_at: new Date().toISOString(),
          };
        },
        markAlternate: async () => {},
        requestRFI: async () => {},
      };
    },
  };
});

// ---------------------------------------------------------------------------
// Imports under test — done AFTER jest.mock declarations.
// ---------------------------------------------------------------------------

import { ScopeTab } from '@/components/service-hub/estimate-studio/scope/ScopeTab';
import { TruthBadge } from '@/components/service-hub/estimate-studio/scope/TruthBadge';

beforeEach(() => {
  mockPush.mockClear();
  mockResolveMissingInput.mockClear();
});

describe('Scope Tab — Wave 7 shell', () => {
  it('empty state renders the CTA back to Plans & Photos', () => {
    mockUploadSnapState = mockEmptyUploadSnap;
    mockStoryState = makeStoryState({});
    const { getByTestId, getByText } = render(<ScopeTab />);

    expect(getByTestId('scope-tab-empty')).toBeTruthy();
    expect(
      getByText(/Drop a plan set in Plans & Photos/),
    ).toBeTruthy();

    fireEvent.press(getByTestId('scope-tab-empty-cta'));
    expect(mockPush).toHaveBeenCalledWith(
      '/service-hub/estimate-studio/plans-photos',
    );
  });

  it('default chip selection is Story (and StoryPanel is rendered)', () => {
    mockUploadSnapState = mockUploadSnap;
    mockStoryState = makeStoryState({});
    const { getByTestId } = render(<ScopeTab />);

    expect(getByTestId('scope-tab')).toBeTruthy();
    // Story chip should be selected; StoryPanel is the visible canvas card.
    expect(getByTestId('story-panel')).toBeTruthy();
    const storyChip = getByTestId('bottom-chip-story');
    expect(storyChip.props.accessibilityState?.selected).toBe(true);
  });

  it('switching chips swaps the active canvas card', async () => {
    mockUploadSnapState = mockUploadSnap;
    mockStoryState = makeStoryState({});
    const { getByTestId, queryByTestId } = render(<ScopeTab />);

    // Click "Included Work" chip → IncludedWorkCard appears once the
    // CanvasCardSwitcher cross-fade (200ms) completes.
    fireEvent.press(getByTestId('bottom-chip-included'));
    await waitFor(() => expect(getByTestId('included-work-card')).toBeTruthy());

    // Click "Tariff Exposure" chip → TariffExposureCard appears.
    fireEvent.press(getByTestId('bottom-chip-tariff'));
    await waitFor(() => expect(getByTestId('tariff-exposure-card')).toBeTruthy());

    // Story panel should no longer be the visible card (CanvasCardSwitcher
    // mounts only the active card).
    expect(queryByTestId('story-panel')).toBeNull();
  });

  it('MissingInputCard Confirm flow calls resolveMissingInput and shows resolved state', async () => {
    mockUploadSnapState = mockUploadSnap;
    mockStoryState = makeStoryState({});
    const { getByTestId } = render(<ScopeTab />);

    // Switch to Missing Inputs chip (await the 200ms cross-fade).
    fireEvent.press(getByTestId('bottom-chip-missing'));
    await waitFor(() => expect(getByTestId('missing-inputs-list')).toBeTruthy());

    // Open the confirm form.
    fireEvent.press(getByTestId('missing-input-mi_1-open-confirm'));
    const textInput = await waitFor(() => getByTestId('missing-input-mi_1-text'));
    fireEvent.changeText(textInput, '9 ft 0 in');
    await act(async () => {
      fireEvent.press(getByTestId('missing-input-mi_1-submit'));
    });

    expect(mockResolveMissingInput).toHaveBeenCalledWith(
      'proj-test-001',
      'mi_1',
      '9 ft 0 in',
    );

    // The action mock set the per-input phase to 'success'. On next render
    // (which `act()` flushes), MissingInputCard's `isResolved` branch
    // takes over and the row swaps to the *-resolved testID. We assert via
    // `findByTestId` so the implicit waitFor walks the next paint.
    await waitFor(
      () => expect(getByTestId('missing-input-mi_1-resolved')).toBeTruthy(),
      { timeout: 2000 },
    );
  });

  it('shows the Wave 2.7 banner when backend GETs return 404', () => {
    mockUploadSnapState = mockUploadSnap;
    mockStoryState = makeStoryState({
      backendDeployed: false,
      story: null,
      assemblies: [],
      materials: [],
      missingInputs: [],
    });
    const { getByTestId } = render(<ScopeTab />);

    expect(getByTestId('scope-tab-wave-banner')).toBeTruthy();
  });
});

describe('TruthBadge — Wave 7 variant rendering', () => {
  it.each([
    ['observed', 'observed'],
    ['derived', 'derived'],
    ['assumed', 'assumed'],
    ['missing', 'missing'],
    ['field_confirmed', 'field confirmed'],
    ['vendor_confirmed', 'vendor confirmed'],
    ['permit_confirmed', 'permit confirmed'],
  ] as const)('renders the %s label', (truth, expectedLabel) => {
    const { getByText, getByTestId } = render(
      <TruthBadge truth={truth} />,
    );
    expect(getByTestId(`truth-badge-${truth}`)).toBeTruthy();
    expect(getByText(expectedLabel)).toBeTruthy();
  });

  it('appends confidence to derived / assumed variants', () => {
    const { getByText } = render(
      <TruthBadge truth="derived" confidence={0.91} />,
    );
    expect(getByText(/0\.91/)).toBeTruthy();
  });

  it('does NOT append confidence to observed', () => {
    const { queryByText } = render(
      <TruthBadge truth="observed" confidence={0.91} />,
    );
    expect(queryByText(/0\.91/)).toBeNull();
  });
});
