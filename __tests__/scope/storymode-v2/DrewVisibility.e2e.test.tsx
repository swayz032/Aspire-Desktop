/**
 * Drew Visibility (DV) — End-to-End shape test (Pass 5 / Subagent B).
 *
 * Shape-test, not pixel-perfect. Confirms that StoryPanelV2 — when fed a
 * full BlueprintStoryV2 with tier / routing_summary / disqualifier_codes
 * populated AND when flipped into Sheet view on a RED sheet — mounts the
 * entire DV signal stack:
 *
 *   1. Tier dot per chapter card
 *   2. Routing summary badge per chapter card
 *   3. Disqualifier badge on the RED sheet tab
 *   4. SheetReceiptDrawer (compact row: tier + routing + disqualifier chips)
 *   5. MaterialStoryPanel with ≥ 3 MaterialInstanceCard rows
 *
 * Goal: catch regressions where a layout change unintentionally strips one
 * of these affordances out of the render tree. Future passes can refactor
 * the internals freely as long as this shape holds.
 *
 * Fixtures: synthesizes a BlueprintStoryV2 from greenChapter + mixedChapter +
 * redChapter (`_fixtures/tieredChapters`). Hooks mocked: useExtractionReceipt
 * (drawer expansion data) and useMaterialStory (material panel data).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Must run before StoryPanelV2 import — its transitive imports otherwise pull
// in lib/authenticatedFetch → supabase env-guard and trip the test bundle.
jest.mock('@/hooks/useExtractionReceipt', () => ({
  useExtractionReceipt: jest.fn(),
}));
jest.mock('@/hooks/useMaterialStory', () => ({
  useMaterialStory: jest.fn(),
}));

import { StoryPanelV2 } from '@/components/service-hub/estimate-studio/scope/StoryPanelV2';
import type {
  BlueprintStoryV2,
  ExtractionReceipt,
  MaterialInstance,
} from '@/lib/api/blueprintsStoryV2';
import {
  greenChapter,
  mixedChapter,
  redChapter,
} from './_fixtures/tieredChapters';

import { useExtractionReceipt } from '@/hooks/useExtractionReceipt';
import { useMaterialStory } from '@/hooks/useMaterialStory';

const mockedUseReceipt = useExtractionReceipt as jest.MockedFunction<
  typeof useExtractionReceipt
>;
const mockedUseMaterialStory = useMaterialStory as jest.MockedFunction<
  typeof useMaterialStory
>;

// ─── Fixture: synthesized BlueprintStoryV2 ──────────────────────────────────
const fixtureStory: BlueprintStoryV2 = {
  project_id: 'proj_dv_e2e',
  mean_confidence: 0.74,
  truth_distribution: {
    observed: 0,
    derived: 0,
    field_confirmed: 0,
    vendor_confirmed: 0,
    permit_confirmed: 0,
    assumed: 0,
    missing: 0,
  },
  coverage: {
    sheets_total: 17,
    sheets_read: 17,
    pages_total: 17,
    pages_read: 17,
  },
  updated_at: '2026-05-25T18:00:00Z',
  chapters: [greenChapter, mixedChapter, redChapter],
};

// ─── Fixture: ExtractionReceipt for the active RED sheet (E-201) ────────────
const fixtureReceipt: ExtractionReceipt = {
  receipt_id: 'rcpt_mix_red_02',
  sheet_id: 'E-201',
  doc_hash: 'sha256:e2etest',
  pipeline_version: 'prg_v29_r10',
  tier: 'RED',
  routing_action: 'OPEN_QUESTION',
  disqualifier_codes: ['BORDER_ABLATION_FAILED', 'TRAJECTORY_NULL_COLLAPSE'],
  evidence_ocr_tokens: [
    { text: 'POWER PLAN', confidence: 0.99, bbox: [0, 0, 10, 10] },
    { text: 'E-201', confidence: 0.97, bbox: [0, 0, 10, 10] },
    { text: 'PANEL P1', confidence: 0.95, bbox: [0, 0, 10, 10] },
    { text: 'CIRCUIT', confidence: 0.93, bbox: [0, 0, 10, 10] },
    { text: 'GFCI', confidence: 0.90, bbox: [0, 0, 10, 10] },
  ],
  iou: 0.31,
  primitive_recall: 0.42,
  primitive_precision: 0.38,
  ocr_engine: 'paddleocr-v3',
  runtime_ms: 1880,
  cost_usd: 0.0024,
  audit_trail: 's3://aspire-receipts/2026/05/rcpt_mix_red_02.jsonl',
  created_at: '2026-05-25T17:55:00Z',
};

// ─── Fixture: 4 MaterialInstance rows for E-201 ─────────────────────────────
function makeMaterial(overrides: Partial<MaterialInstance> = {}): MaterialInstance {
  return {
    instance_id: 'inst_default',
    sheet_id: 'E-201',
    sheet_code: 'E-201',
    symbol_name: 'Single-pole switch',
    legend_label: 'S1',
    legend_specification: 'Hubbell HBL5301WSP, 20A, white',
    cluster_id: 'cl_1',
    motif_hash: 'hash1',
    resolution_source: 'topology_match',
    confidence: 0.91,
    instance_count: 1,
    tier: 'GREEN',
    receipt_id: 'rcpt_mat_1',
    ...overrides,
  };
}

const fixtureMaterials: MaterialInstance[] = [
  makeMaterial({ instance_id: 'mat_e201_1', legend_label: 'S1', instance_count: 4 }),
  makeMaterial({
    instance_id: 'mat_e201_2',
    legend_label: 'R1',
    symbol_name: 'Duplex receptacle',
    legend_specification: 'Hubbell DR15, 15A',
    instance_count: 8,
    tier: 'YELLOW',
  }),
  makeMaterial({
    instance_id: 'mat_e201_3',
    legend_label: 'GFCI',
    symbol_name: 'GFCI receptacle',
    legend_specification: 'Leviton GFNT1-W, 15A, white',
    instance_count: 3,
    resolution_source: 'vlm_verified',
  }),
  makeMaterial({
    instance_id: 'mat_e201_4',
    legend_label: 'L1',
    symbol_name: 'Recessed downlight',
    legend_specification: 'Halo HLB6, 6", 2700K',
    instance_count: 6,
    resolution_source: 'cluster_propagation',
    tier: 'YELLOW',
  }),
];

describe('Drew Visibility — Story Mode SheetView e2e shape', () => {
  beforeEach(() => {
    mockedUseReceipt.mockReset();
    mockedUseMaterialStory.mockReset();

    mockedUseReceipt.mockReturnValue({
      receipt: fixtureReceipt,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExtractionReceipt>);

    const bySheet = new Map<string, MaterialInstance[]>();
    bySheet.set('E-201', fixtureMaterials);
    mockedUseMaterialStory.mockReturnValue({
      story: {
        project_id: 'proj_dv_e2e',
        chapters: [{ key: 'mixed-chapter', materials: fixtureMaterials }],
        updated_at: '2026-05-25T18:00:00Z',
      },
      materialsBySheet: bySheet,
      materialsByChapter: new Map(),
      isLoading: false,
      error: null,
    });
  });

  it('mounts the full DV signal stack on a RED sheet in mixed chapter', () => {
    render(
      <StoryPanelV2
        story={fixtureStory}
        activeChapterKey="mixed-chapter"
        onSelectChapter={() => {}}
        projectId="proj_dv_e2e"
      />,
    );

    // ─── 1. Tier dot per chapter card (3 chapters → 3 dots) ────────────────
    expect(screen.getByTestId(`chapter-card-${greenChapter.key}-tier-dot`)).toBeTruthy();
    expect(screen.getByTestId(`chapter-card-${mixedChapter.key}-tier-dot`)).toBeTruthy();
    expect(screen.getByTestId(`chapter-card-${redChapter.key}-tier-dot`)).toBeTruthy();

    // ─── 2. Routing summary badge per chapter card (3 badges) ──────────────
    expect(screen.getByTestId(`chapter-card-${greenChapter.key}-routing-summary`)).toBeTruthy();
    expect(screen.getByTestId(`chapter-card-${mixedChapter.key}-routing-summary`)).toBeTruthy();
    expect(screen.getByTestId(`chapter-card-${redChapter.key}-routing-summary`)).toBeTruthy();

    // ─── 3. Disqualifier badge on RED sheet tabs in active chapter strip ───
    // mixedChapter has 2 RED sheets with disqualifier_codes: E-101 + E-201.
    expect(screen.getByTestId('sheet-tab-disqualifier-E-101')).toBeTruthy();
    expect(screen.getByTestId('sheet-tab-disqualifier-E-201')).toBeTruthy();

    // ─── 4. SheetReceiptDrawer mounted (compact row visible by default) ────
    expect(screen.getByTestId('sheet-receipt-drawer')).toBeTruthy();
    expect(screen.getByTestId('sheet-receipt-drawer-tier-chip')).toBeTruthy();
    expect(screen.getByTestId('sheet-receipt-drawer-routing-chip')).toBeTruthy();
    // The default active sheet (first source_sheet = M-101, GREEN, no
    // disqualifiers) won't have disqualifier chips on its compact row. Jump
    // to E-201 (RED) to exercise the disqualifier-chip path.
    fireEvent.press(screen.getByTestId('sheet-tab-E-201'));
    expect(
      screen.getByTestId('sheet-receipt-drawer-disqualifier-BORDER_ABLATION_FAILED'),
    ).toBeTruthy();

    // ─── 5. MaterialStoryPanel mounted in SheetView with ≥ 3 cards ─────────
    // Flipping the right-pane sheet tab also flips viewMode → 'sheet',
    // which mounts the SheetView (and MaterialStoryPanel) in the left pane.
    expect(screen.getByTestId('material-story-panel')).toBeTruthy();
    expect(screen.getByTestId('material-story-panel-card-mat_e201_1')).toBeTruthy();
    expect(screen.getByTestId('material-story-panel-card-mat_e201_2')).toBeTruthy();
    expect(screen.getByTestId('material-story-panel-card-mat_e201_3')).toBeTruthy();
    expect(screen.getByTestId('material-story-panel-card-mat_e201_4')).toBeTruthy();

    // ─── Header content: "MATERIALS ON THIS SHEET · N items" ───────────────
    expect(screen.getByText(/MATERIALS ON THIS SHEET · \d+ items/)).toBeTruthy();
  });
});
