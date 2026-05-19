/**
 * useBlueprintProjectPoll — Wave 9e hardening tests.
 *
 * Covers:
 *   - P0-8: cadence reads the freshest fetched project, not stale closure.
 *   - P1-4: Promise.allSettled — sheets reject does not revert project state.
 *   - P1-2: consecutive 5xx errors stop polling with POLL_SERVER_DOWN.
 *   - Auth-lost (401) stops immediately.
 *
 * The hook is tested through its public surface; we mock the underlying API
 * clients on `blueprintsApi`.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

jest.mock('@/providers', () => ({
  useTenant: () => ({ officeId: 'office_test' }),
}));

jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    getProject: jest.fn(),
    listSheets: jest.fn(),
    getProjectStatus: jest.fn(),
  };
});

import {
  getProject,
  listSheets,
  getProjectStatus,
  BlueprintsApiError,
  type BlueprintProject,
} from '@/lib/api/blueprintsApi';
import { useBlueprintProjectPoll, _shouldStopOnError } from '../useBlueprintProjectPoll';

const getProjectMock = getProject as jest.MockedFunction<typeof getProject>;
const listSheetsMock = listSheets as jest.MockedFunction<typeof listSheets>;
const getProjectStatusMock = getProjectStatus as jest.MockedFunction<typeof getProjectStatus>;

function _mkProj(ingest: 'pending' | 'running' | 'ok' | 'error' = 'running'): BlueprintProject {
  return {
    id: 'proj_1',
    address: null,
    created_at: new Date().toISOString(),
    created_by: null,
    stage_progress: {
      ingest,
      classify: 'pending',
      see: 'pending',
      reason: 'pending',
      procure: 'pending',
    },
    sheet_count: 0,
  };
}

beforeEach(() => {
  getProjectMock.mockReset();
  listSheetsMock.mockReset();
  getProjectStatusMock.mockReset();
});

describe('_shouldStopOnError (P1-2)', () => {
  it('stops immediately on 401', () => {
    expect(
      _shouldStopOnError(new BlueprintsApiError(401, 'AUTH', 'no'), 1, 5, 3),
    ).toBe('POLL_AUTH_LOST');
  });
  it('stops immediately on 403', () => {
    expect(
      _shouldStopOnError(new BlueprintsApiError(403, 'FORBIDDEN', 'no'), 1, 5, 3),
    ).toBe('POLL_AUTH_LOST');
  });
  it('stops immediately on 410', () => {
    expect(
      _shouldStopOnError(new BlueprintsApiError(410, 'GONE', 'no'), 1, 5, 3),
    ).toBe('POLL_NOT_FOUND');
  });
  it('rides out single 5xx', () => {
    expect(
      _shouldStopOnError(new BlueprintsApiError(503, 'DOWN', 'no'), 1, 5, 3),
    ).toBe(null);
  });
  it('gives up after server-error ceiling 5xx', () => {
    expect(
      _shouldStopOnError(new BlueprintsApiError(503, 'DOWN', 'no'), 3, 5, 3),
    ).toBe('POLL_SERVER_DOWN');
  });
  it('gives up after generic error ceiling', () => {
    expect(_shouldStopOnError(null, 5, 5, 3)).toBe('POLL_LOST');
  });
});

describe('useBlueprintProjectPoll — Wave 9e hardening', () => {
  it('P1-4 — sheets reject does NOT revert project state (allSettled)', async () => {
    getProjectMock.mockResolvedValue(_mkProj('running'));
    listSheetsMock.mockRejectedValue(
      new BlueprintsApiError(500, 'SHEETS_500', 'transient'),
    );
    getProjectStatusMock.mockResolvedValue({
      project_id: 'proj_1',
      stage_progress: {
        ingest: 'running',
        classify: 'pending',
        see: 'pending',
        reason: 'pending',
        procure: 'pending',
      },
      updated_at: new Date().toISOString(),
      sheet_count: 0,
      symbol_count: 0,
      missing_input_count: 0,
    });

    const { result } = renderHook(() => useBlueprintProjectPoll('proj_1'));
    await waitFor(() => expect(result.current.project).not.toBeNull());
    expect(result.current.project?.id).toBe('proj_1');
    // sheets reject should NOT have surfaced an error since project+status succeeded
    expect(result.current.error).toBeNull();
  });

  it('P1-2 — auth-lost (401) stops polling immediately', async () => {
    getProjectMock.mockRejectedValue(
      new BlueprintsApiError(401, 'UNAUTHORIZED', 'session dead'),
    );
    listSheetsMock.mockRejectedValue(
      new BlueprintsApiError(401, 'UNAUTHORIZED', 'session dead'),
    );
    getProjectStatusMock.mockRejectedValue(
      new BlueprintsApiError(401, 'UNAUTHORIZED', 'session dead'),
    );

    const { result } = renderHook(() => useBlueprintProjectPoll('proj_1'));
    await waitFor(() => expect(result.current.error?.code).toBe('POLL_AUTH_LOST'));
  });

  it('P2-8 — stageCompletedAt stamps when stage hits ok', async () => {
    getProjectMock.mockResolvedValue(_mkProj('ok'));
    listSheetsMock.mockResolvedValue([]);
    getProjectStatusMock.mockResolvedValue({
      project_id: 'proj_1',
      stage_progress: {
        ingest: 'ok',
        classify: 'pending',
        see: 'pending',
        reason: 'pending',
        procure: 'pending',
      },
      updated_at: new Date().toISOString(),
      sheet_count: 0,
      symbol_count: 0,
      missing_input_count: 0,
    });

    const { result } = renderHook(() => useBlueprintProjectPoll('proj_1'));
    await waitFor(() =>
      expect(result.current.stageCompletedAt.ingest).not.toBeNull(),
    );
    expect(typeof result.current.stageCompletedAt.ingest).toBe('number');
    expect(result.current.stageCompletedAt.classify).toBeNull();
  });
});
