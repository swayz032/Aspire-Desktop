/**
 * MaterialStoryPanel — DV Pass 4 (Subagent C).
 *
 * Covers all 5 render states: loading, populated, empty (no materials),
 * UNKNOWN_REVIEW (all instances unknown), error.
 *
 * Mocks `useMaterialStory` so we control the returned story / loading /
 * error state. The MaterialInstanceCard primitive is rendered for real
 * (Subagent B's component) so we exercise the integration.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { MaterialStoryPanel } from '@/components/service-hub/estimate-studio/scope/MaterialStoryPanel';
import type {
  MaterialInstance,
  MaterialStoryResponse,
} from '@/lib/api/blueprintsStoryV2';

// Mock the hook so each test controls the returned shape.
jest.mock('@/hooks/useMaterialStory', () => ({
  useMaterialStory: jest.fn(),
}));

import { useMaterialStory } from '@/hooks/useMaterialStory';
const mockedUseMaterialStory = useMaterialStory as jest.MockedFunction<
  typeof useMaterialStory
>;

function makeInstance(overrides: Partial<MaterialInstance> = {}): MaterialInstance {
  return {
    instance_id: 'inst_default',
    sheet_id: 'A-101',
    sheet_code: 'A-101',
    symbol_name: 'Single-pole switch',
    legend_label: 'S1',
    legend_specification: 'Hubbell HBL5301WSP, 20A, white',
    cluster_id: 'cl_1',
    motif_hash: 'hash1',
    resolution_source: 'topology_match',
    confidence: 0.94,
    instance_count: 1,
    tier: 'GREEN',
    receipt_id: 'rcpt_default',
    ...overrides,
  };
}

function makeStory(materials: MaterialInstance[]): MaterialStoryResponse {
  return {
    project_id: 'proj_1',
    chapters: [{ key: 'electrical', materials }],
    updated_at: null,
  };
}

function setHookResult(args: {
  story?: MaterialStoryResponse | null;
  materials?: MaterialInstance[];
  isLoading?: boolean;
  error?: Error | null;
  emptySheetEntry?: { sheetId: string };
}) {
  const bySheet = new Map<string, MaterialInstance[]>();
  if (args.materials) {
    for (const m of args.materials) {
      const arr = bySheet.get(m.sheet_id);
      if (arr) arr.push(m);
      else bySheet.set(m.sheet_id, [m]);
    }
  }
  if (args.emptySheetEntry) {
    bySheet.set(args.emptySheetEntry.sheetId, []);
  }
  mockedUseMaterialStory.mockReturnValue({
    story: args.story ?? null,
    materialsBySheet: bySheet,
    materialsByChapter: new Map(),
    isLoading: args.isLoading ?? false,
    error: args.error ?? null,
  });
}

describe('MaterialStoryPanel', () => {
  beforeEach(() => {
    mockedUseMaterialStory.mockReset();
  });

  it('renders loading skeleton when isLoading=true', () => {
    setHookResult({ isLoading: true });
    const { getByTestId, queryByTestId } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-loading')).toBeTruthy();
    expect(queryByTestId('material-story-panel-header')).toBeNull();
  });

  it('renders header + N MaterialInstanceCard rows when populated', () => {
    const materials = [
      makeInstance({ instance_id: 'i1', sheet_id: 'A-101' }),
      makeInstance({ instance_id: 'i2', sheet_id: 'A-101' }),
      makeInstance({ instance_id: 'i3', sheet_id: 'A-101' }),
    ];
    setHookResult({ story: makeStory(materials), materials });
    const { getByTestId, getByText } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-header').props.children).toMatch(
      /MATERIALS ON THIS SHEET · 3 items/,
    );
    expect(getByTestId('material-story-panel-card-i1')).toBeTruthy();
    expect(getByTestId('material-story-panel-card-i2')).toBeTruthy();
    expect(getByTestId('material-story-panel-card-i3')).toBeTruthy();
    // 3 cards mean 3 symbol-name text occurrences from the MaterialInstanceCard.
    expect(getByText(/MATERIALS ON THIS SHEET/)).toBeTruthy();
  });

  it('uses singular "1 item" form when exactly one material', () => {
    const materials = [makeInstance({ instance_id: 'i1', sheet_id: 'A-101' })];
    setHookResult({ story: makeStory(materials), materials });
    const { getByTestId } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-header').props.children).toMatch(
      /MATERIALS ON THIS SHEET · 1 item$/,
    );
  });

  it('renders no-materials empty state when sheet has no materials', () => {
    // Empty sheet entry exists in the index but is empty.
    setHookResult({
      story: makeStory([]),
      emptySheetEntry: { sheetId: 'A-101' },
    });
    const { getByTestId, getByText } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-empty')).toBeTruthy();
    expect(getByText(/No materials bound on this sheet/)).toBeTruthy();
    expect(
      getByText(/The buy list lives on the schedule or plan sheets/),
    ).toBeTruthy();
  });

  it('also renders empty state when no entry exists for the sheet at all', () => {
    setHookResult({ story: makeStory([]) });
    const { getByTestId } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-empty')).toBeTruthy();
  });

  it('renders UNKNOWN_REVIEW subvariant when all instances are resolution_source="unknown"', () => {
    const materials = [
      makeInstance({ instance_id: 'i1', sheet_id: 'A-101', resolution_source: 'unknown' }),
      makeInstance({ instance_id: 'i2', sheet_id: 'A-101', resolution_source: 'unknown' }),
    ];
    setHookResult({ story: makeStory(materials), materials });
    const { getByTestId, getByText, queryByTestId } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-unknown-review')).toBeTruthy();
    expect(getByText(/2 symbols awaiting Tim review on this sheet/)).toBeTruthy();
    // populated path NOT rendered
    expect(queryByTestId('material-story-panel-header')).toBeNull();
  });

  it('uses singular "1 symbol" form in UNKNOWN_REVIEW with one unknown instance', () => {
    const materials = [
      makeInstance({ instance_id: 'i1', sheet_id: 'A-101', resolution_source: 'unknown' }),
    ];
    setHookResult({ story: makeStory(materials), materials });
    const { getByText } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByText(/1 symbol awaiting Tim review on this sheet/)).toBeTruthy();
  });

  it('renders error state when hook returns an error', () => {
    setHookResult({ error: new Error('boom') });
    const { getByTestId, getByText, queryByTestId } = render(
      <MaterialStoryPanel projectId="proj_1" sheetId="A-101" sheetCode="A-101" />,
    );
    expect(getByTestId('material-story-panel-error')).toBeTruthy();
    expect(getByText(/Material story unavailable/)).toBeTruthy();
    expect(getByText(/Drew is still processing/)).toBeTruthy();
    expect(queryByTestId('material-story-panel-header')).toBeNull();
  });

  it('falls back to sheet_code scan when materialsBySheet has no entry for sheetId', () => {
    // Index is keyed by a UUID-style sheet_id but the SheetView only knows
    // the sheet_code. The panel should still find the materials by scanning.
    const materials = [
      makeInstance({
        instance_id: 'i1',
        sheet_id: 'uuid_abc',
        sheet_code: 'A-101',
      }),
    ];
    setHookResult({ story: makeStory(materials), materials });
    const { getByTestId } = render(
      <MaterialStoryPanel
        projectId="proj_1"
        sheetId="A-101"
        sheetCode="A-101"
      />,
    );
    // Direct lookup misses; scan succeeds.
    expect(getByTestId('material-story-panel-header').props.children).toMatch(
      /1 item/,
    );
    expect(getByTestId('material-story-panel-card-i1')).toBeTruthy();
  });

  it('uses a custom testID prefix when provided', () => {
    setHookResult({ isLoading: true });
    const { getByTestId } = render(
      <MaterialStoryPanel
        projectId="proj_1"
        sheetId="A-101"
        sheetCode="A-101"
        testID="custom-panel"
      />,
    );
    expect(getByTestId('custom-panel-loading')).toBeTruthy();
  });
});
