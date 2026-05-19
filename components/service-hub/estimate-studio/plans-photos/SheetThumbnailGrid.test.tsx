/**
 * SheetThumbnailGrid — Wave 9e P0-9 regression test.
 *
 * Verifies that when stageProgress.ingest is the NORMALIZED terminal value
 * 'ok' (not the pre-normalization backend 'done'), the grid drops the
 * shimmer and renders either real sheets or the empty state.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/lib/plansPhotosUiStore', () => ({
  usePlansPhotosUi: () => ({ filterKey: null }),
}));

import { SheetThumbnailGrid } from './SheetThumbnailGrid';
import type { StageProgress } from '@/lib/api/blueprintsApi';

const EMPTY_STAGE_OK: StageProgress = {
  ingest: 'ok',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

const EMPTY_STAGE_RUNNING: StageProgress = {
  ingest: 'running',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

describe('SheetThumbnailGrid — P0-9 normalized stage values', () => {
  it('shows empty state (not shimmer) when ingest=ok and sheets=[]', () => {
    const { queryByTestId, getByTestId } = render(
      <SheetThumbnailGrid
        sheets={[]}
        revisions={[]}
        isLoading={false}
        stageProgress={EMPTY_STAGE_OK}
      />,
    );
    expect(getByTestId('sheet-thumb-grid-empty')).toBeTruthy();
    expect(queryByTestId('sheet-thumb-skeleton-0')).toBeNull();
  });

  it('shows shimmer when ingest=running and sheets=[]', () => {
    const { getByTestId, queryByTestId } = render(
      <SheetThumbnailGrid
        sheets={[]}
        revisions={[]}
        isLoading={false}
        stageProgress={EMPTY_STAGE_RUNNING}
      />,
    );
    expect(getByTestId('sheet-thumb-skeleton-0')).toBeTruthy();
    expect(queryByTestId('sheet-thumb-grid-empty')).toBeNull();
  });
});
